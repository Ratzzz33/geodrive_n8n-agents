#!/usr/bin/env node
/**
 * Добавление health-логгеров в активные workflow через MCP n8n
 * Для каждого workflow добавляет ноду, которая пишет успешные запуски в health таблицу
 */

import axios from 'axios';

const N8N_API_URL = 'https://n8n.rentflow.rentals/api/v1';
const N8N_API_KEY = process.env.N8N_API_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI';

const headers = {
  'X-N8N-API-KEY': N8N_API_KEY,
  'Content-Type': 'application/json'
};

// Конфигурация workflow для мониторинга
const WORKFLOW_CONFIG = {
  'Nc5GFhh5Ikhv1ivK': { branch: 'starline', label: 'Starline GPS Monitor', interval: 2 }, // уже есть logger
  'xSjwtwrrWUGcBduU': { branch: 'history-parser', label: 'History Parser', interval: 3 },
  'w8g8cJb0ccReaqIE': { branch: 'company-cash', label: 'Company Cash Parser', interval: 5 },
  'u3cOUuoaH5RSw7hm': { branch: 'cars-parser', label: 'Cars Parser', interval: 5 },
  'rCCVTgR2FcWWRxpq': { branch: 'active-bookings', label: 'Active Bookings Parser', interval: 5 },
  'DmgFVhxEeXl9AOjg': { branch: 'inactive-kutaisi-service', label: 'Inactive Kutaisi+Service', interval: 15 },
  '7gKTEFi1wyEaY8Ri': { branch: 'inactive-tbilisi', label: 'Inactive Tbilisi', interval: 60 },
  'FDMvu8P8DKilQTOK': { branch: 'inactive-batumi', label: 'Inactive Batumi', interval: 15 },
  'ihRLR0QCJySx319b': { branch: 'car-prices-daily', label: 'Car Prices Daily', interval: 1440 }, // раз в сутки
};

async function getWorkflow(id) {
  try {
    const response = await axios.get(`${N8N_API_URL}/workflows/${id}`, { headers });
    return response.data;
  } catch (error) {
    console.error(`❌ Ошибка получения workflow ${id}:`, error.message);
    return null;
  }
}

function findSuccessNode(workflow) {
  // Ищем ноду "Success" или последнюю ноду в успешной ветке
  const successNodes = workflow.nodes.filter(n => 
    n.name === 'Success' || 
    (n.type === 'n8n-nodes-base.noOp' && n.name?.toLowerCase().includes('success'))
  );
  
  if (successNodes.length > 0) {
    return successNodes[0];
  }
  
  // Ищем ноду перед "If Error" в false ветке
  const ifErrorNodes = workflow.nodes.filter(n => 
    n.name === 'If Error' || 
    (n.type === 'n8n-nodes-base.if' && n.name?.toLowerCase().includes('error'))
  );
  
  if (ifErrorNodes.length > 0) {
    const ifError = ifErrorNodes[0];
    const connections = workflow.connections[ifError.name];
    if (connections && connections.main && connections.main[1]) {
      // False branch (успех)
      const nextNodeName = connections.main[1][0]?.node;
      if (nextNodeName) {
        return workflow.nodes.find(n => n.name === nextNodeName);
      }
    }
  }
  
  return null;
}

function createHealthLoggerNode(branch, position) {
  return {
    parameters: {
      operation: 'executeQuery',
      query: "INSERT INTO health (ts, branch, ok, reason) VALUES (NOW(), $1, $2, $3)",
      options: {},
      additionalFields: {
        queryParams: `={{ ['${branch}', true, 'success'] }}`
      }
    },
    id: `health-logger-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    name: 'Log Success to Health',
    type: 'n8n-nodes-base.postgres',
    typeVersion: 2.5,
    position: position || [2000, 400],
    credentials: {
      postgres: {
        id: '3I9fyXVlGg4Vl4LZ',
        name: 'Postgres account'
      }
    },
    onError: 'continueRegularOutput'
  };
}

function hasHealthLogger(workflow, branch) {
  // Проверяем, есть ли уже нода, которая пишет в health с этим branch
  return workflow.nodes.some(node => {
    if (node.type === 'n8n-nodes-base.postgres' && node.parameters?.query) {
      const query = node.parameters.query;
      return query.includes("INSERT INTO health") && 
             (query.includes(`'${branch}'`) || 
              (node.parameters.additionalFields?.queryParams && 
               node.parameters.additionalFields.queryParams.includes(`'${branch}'`)));
    }
    return false;
  });
}

async function addHealthLoggerToWorkflow(workflowId, config) {
  console.log(`\n▶️  Processing workflow ${workflowId} (${config.label})`);
  
  const workflowData = await getWorkflow(workflowId);
  if (!workflowData || !workflowData.data) {
    console.log(`   ❌ Не удалось получить workflow`);
    return false;
  }
  
  const workflow = workflowData.data;
  
  // Проверяем, есть ли уже health logger
  if (hasHealthLogger(workflow, config.branch)) {
    console.log(`   ✅ Health logger уже есть для branch '${config.branch}'`);
    return true;
  }
  
  // Находим ноду Success
  const successNode = findSuccessNode(workflow);
  if (!successNode) {
    console.log(`   ⚠️  Не найдена нода Success, пропускаем`);
    return false;
  }
  
  console.log(`   📍 Найдена нода Success: ${successNode.name} (${successNode.id})`);
  
  // Создаем health logger ноду
  const healthLogger = createHealthLoggerNode(
    config.branch,
    [successNode.position[0] + 300, successNode.position[1]]
  );
  
  // Добавляем ноду в workflow
  workflow.nodes.push(healthLogger);
  
  // Обновляем connections: Success -> Health Logger
  if (!workflow.connections[successNode.name]) {
    workflow.connections[successNode.name] = { main: [[]] };
  }
  
  if (!workflow.connections[successNode.name].main) {
    workflow.connections[successNode.name].main = [[]];
  }
  
  // Добавляем connection к health logger
  const existingConnections = workflow.connections[successNode.name].main[0] || [];
  existingConnections.push({
    node: healthLogger.name,
    type: 'main',
    index: 0
  });
  workflow.connections[successNode.name].main[0] = existingConnections;
  
  // Health logger не имеет выходных connections (конечная нода)
  workflow.connections[healthLogger.name] = { main: [[]] };
  
  // Удаляем системные поля перед отправкой
  delete workflow.id;
  delete workflow.versionId;
  delete workflow.updatedAt;
  delete workflow.createdAt;
  delete workflow.triggerCount;
  delete workflow.meta;
  delete workflow.staticData;
  delete workflow.pinData;
  delete workflow.tags;
  delete workflow.shared;
  
  // Удаляем webhookId из нод (кроме webhook)
  workflow.nodes.forEach(node => {
    if (node.type !== 'n8n-nodes-base.webhook') {
      delete node.webhookId;
    }
    // НЕ удаляем node.id - он нужен для обновления существующих нод
  });
  
  // Обновляем workflow
  try {
    const updateResponse = await axios.put(
      `${N8N_API_URL}/workflows/${workflowId}`,
      workflow,
      { headers }
    );
    
    if (updateResponse.data) {
      console.log(`   ✅ Health logger добавлен успешно`);
      return true;
    }
  } catch (error) {
    console.error(`   ❌ Ошибка обновления workflow:`, error.response?.data || error.message);
    return false;
  }
  
  return false;
}

async function updateHealthStatusWorkflow() {
  console.log(`\n▶️  Обновление Health & Status workflow`);
  
  const workflowId = 'vNOWh8H7o5HL7fJ3';
  const workflowData = await getWorkflow(workflowId);
  
  if (!workflowData || !workflowData.data) {
    console.log(`   ❌ Не удалось получить workflow`);
    return false;
  }
  
  const workflow = workflowData.data;
  
  // Обновляем chatId в Telegram нодах на -1003484642420
  workflow.nodes.forEach(node => {
    if (node.type === 'n8n-nodes-base.telegram' && node.parameters?.chatId) {
      node.parameters.chatId = '-1003484642420';
      console.log(`   📝 Обновлен chatId в ноде: ${node.name}`);
    }
  });
  
  // Обновляем код в "Evaluate Workflows" для проверки успешных запусков
  const evaluateNode = workflow.nodes.find(n => n.name === 'Evaluate Workflows');
  if (evaluateNode) {
    const monitored = Object.entries(WORKFLOW_CONFIG)
      .filter(([id, config]) => id !== 'Nc5GFhh5Ikhv1ivK') // Starline уже мониторится
      .map(([id, config]) => ({
        branch: config.branch,
        label: config.label,
        maxLagMinutes: config.interval * 2
      }));
    
    evaluateNode.parameters.jsCode = `// Проверяем, что активные workflow присылают свежие статусы
const monitored = ${JSON.stringify(monitored, null, 2)};

const latestByBranch = {};
for (const item of $input.all()) {
  const data = item.json;
  if (!data.branch) continue;
  latestByBranch[data.branch] = data;
}

const now = Date.now();
const issues = [];

for (const config of monitored) {
  const latest = latestByBranch[config.branch];

  if (!latest || !latest.ts) {
    issues.push({
      branch: config.branch,
      label: config.label,
      details: 'Нет записей в health — workflow мог перестать работать',
      issue: 'no-data'
    });
    continue;
  }

  const lastTs = Date.parse(latest.ts);
  const minutesSince = Math.round((now - lastTs) / 60000);

  // Проверяем только успешные запуски (ok = true)
  if (latest.ok === false) {
    issues.push({
      branch: config.branch,
      label: config.label,
      details: \`Последнее выполнение завершилось с ошибкой: \${latest.reason || 'нет описания'}\`,
      lastTs: latest.ts,
      minutesSince,
      issue: 'failed'
    });
    continue;
  }

  // Проверяем, что есть успешный запуск за последние maxLagMinutes
  if (latest.ok === true && minutesSince > config.maxLagMinutes) {
    issues.push({
      branch: config.branch,
      label: config.label,
      details: \`Нет успешных запусков \${minutesSince} мин (лимит \${config.maxLagMinutes} мин). Последняя успешная запись: \${latest.ts || 'нет данных'}\`,
      lastTs: latest.ts,
      minutesSince,
      issue: 'stale'
    });
  } else if (latest.ok !== true) {
    // Если последняя запись не успешная, ищем последнюю успешную
    issues.push({
      branch: config.branch,
      label: config.label,
      details: \`Нет успешных запусков. Последняя запись: \${latest.ts || 'нет данных'} (ok=\${latest.ok})\`,
      lastTs: latest.ts,
      minutesSince,
      issue: 'no-success'
    });
  }
}

if (issues.length === 0) {
  return [];
}

const lines = [
  '🚨 Мониторинг workflow: обнаружены проблемы',
  '',
  ...issues.map((issue) => \`• \${issue.label} — \${issue.details}\`)
];

return [{
  json: {
    message: lines.join('\\n'),
    issues
  }
}];`;
    
    console.log(`   📝 Обновлен код в ноде: ${evaluateNode.name}`);
  }
  
  // Удаляем системные поля
  delete workflow.id;
  delete workflow.versionId;
  delete workflow.updatedAt;
  delete workflow.createdAt;
  delete workflow.triggerCount;
  delete workflow.meta;
  delete workflow.staticData;
  delete workflow.pinData;
  delete workflow.tags;
  delete workflow.shared;
  
  // Удаляем webhookId из нод (кроме webhook)
  workflow.nodes.forEach(node => {
    if (node.type !== 'n8n-nodes-base.webhook') {
      delete node.webhookId;
    }
    // НЕ удаляем node.id - он нужен для обновления существующих нод
  });
  
  // Обновляем workflow
  try {
    const updateResponse = await axios.put(
      `${N8N_API_URL}/workflows/${workflowId}`,
      workflow,
      { headers }
    );
    
    if (updateResponse.data) {
      console.log(`   ✅ Health & Status workflow обновлен успешно`);
      return true;
    }
  } catch (error) {
    console.error(`   ❌ Ошибка обновления workflow:`, error.response?.data || error.message);
    return false;
  }
  
  return false;
}

async function main() {
  console.log('🚀 Добавление health-логгеров в активные workflow\n');
  
  const results = [];
  
  // Добавляем health logger в каждый workflow
  for (const [workflowId, config] of Object.entries(WORKFLOW_CONFIG)) {
    if (workflowId === 'Nc5GFhh5Ikhv1ivK') {
      console.log(`\n▶️  Пропускаем ${config.label} (уже есть health logger)`);
      continue;
    }
    
    const success = await addHealthLoggerToWorkflow(workflowId, config);
    results.push({ workflowId, config, success });
    
    // Небольшая задержка между запросами
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  // Обновляем Health & Status workflow
  await updateHealthStatusWorkflow();
  
  console.log('\n✅ Готово!');
  console.log(`\n📊 Результаты:`);
  results.forEach(({ workflowId, config, success }) => {
    console.log(`   ${success ? '✅' : '❌'} ${config.label} (${workflowId})`);
  });
}

main().catch(console.error);

