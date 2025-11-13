#!/usr/bin/env node
/**
 * Обновление workflow "Парсинг броней RentProg" - добавление Save to DB и error handling
 */

import 'dotenv/config';

const WORKFLOW_ID = 'P3BnmX7Nrmh1cusF';
const N8N_API_URL = 'https://n8n.rentflow.rentals/api/v1';
const N8N_API_KEY = process.env.N8N_API_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI';

async function updateWorkflow() {
  console.log(`\n📝 Обновление workflow ${WORKFLOW_ID}...`);
  
  // Получаем текущий workflow
  const getResponse = await fetch(`${N8N_API_URL}/workflows/${WORKFLOW_ID}`, {
    headers: {
      'X-N8N-API-KEY': N8N_API_KEY
    }
  });
  
  if (!getResponse.ok) {
    throw new Error(`Failed to get workflow: ${getResponse.statusText}`);
  }
  
  const current = await getResponse.json();
  console.log(`✅ Получен текущий workflow: ${current.name}`);
  console.log(`   Нод: ${current.nodes.length}`);
  
  // Добавляем новые ноды
  const newNodes = [
    // Save to DB
    {
      "parameters": {
        "operation": "executeQuery",
        "query": "=INSERT INTO bookings (\n  branch_code,\n  booking_number,\n  status,\n  start_date,\n  end_date,\n  data,\n  created_at,\n  updated_at\n) VALUES (\n  {{ $json.branch ? \"'\" + $json.branch + \"'\" : 'NULL' }},\n  {{ $json.number ? $json.number : 'NULL' }},\n  {{ $json.is_active ? \"'active'\" : \"'inactive'\" }},\n  {{ $json.start_date ? \"'\" + $json.start_date.replace(/'/g, \"''\") + \"'\" : 'NULL' }},\n  {{ $json.end_date ? \"'\" + $json.end_date.replace(/'/g, \"''\") + \"'\" : 'NULL' }},\n  {{ $json.data ? \"'\" + $json.data.replace(/'/g, \"''\") + \"'::jsonb\" : \"'{}'::jsonb\" }},\n  NOW(),\n  NOW()\n)\nON CONFLICT (booking_number) DO UPDATE SET\n  branch_code = EXCLUDED.branch_code,\n  status = EXCLUDED.status,\n  start_date = EXCLUDED.start_date,\n  end_date = EXCLUDED.end_date,\n  data = EXCLUDED.data,\n  updated_at = NOW()\nRETURNING id, booking_number;",
        "options": {
          "queryBatching": "transaction"
        }
      },
      "name": "Save to DB",
      "type": "n8n-nodes-base.postgres",
      "typeVersion": 2.4,
      "position": [920, 500],
      "credentials": {
        "postgres": {
          "name": "Neon PostgreSQL"
        }
      },
      "retryOnFail": true,
      "maxTries": 2,
      "continueOnFail": true
    },
    // If Error
    {
      "parameters": {
        "conditions": {
          "options": {
            "caseSensitive": true,
            "typeValidation": "strict",
            "version": 1
          },
          "conditions": [
            {
              "id": "check-error-count",
              "leftValue": "={{ $json.error_count }}",
              "rightValue": 0,
              "operator": {
                "type": "number",
                "operation": "gt"
              }
            }
          ],
          "combinator": "and"
        }
      },
      "name": "If Error",
      "type": "n8n-nodes-base.if",
      "typeVersion": 2,
      "position": [1320, 500]
    },
    // Send Alert
    {
      "parameters": {
        "operation": "sendMessage",
        "chatId": "={{ $env.TELEGRAM_ALERT_CHAT_ID }}",
        "text": "={{ $json.message + '\\n\\n🔗 <a href=\"https://n8n.rentflow.rentals/workflow/' + $workflow.id + '/executions/' + $execution.id + '\">Открыть execution</a>' }}",
        "additionalFields": {
          "appendAttribution": false,
          "parse_mode": "HTML"
        }
      },
      "name": "Send Alert",
      "type": "n8n-nodes-base.telegram",
      "typeVersion": 1.2,
      "position": [1520, 400],
      "credentials": {
        "telegramApi": {
          "name": "Telegram Alert Bot"
        }
      }
    },
    // Throw Error
    {
      "parameters": {
        "jsCode": "// Выбрасываем ошибку чтобы execution был помечен как failed\nconst errorData = $input.first().json;\nconst errorMessage = errorData.message || 'Ошибка при парсинге броней RentProg';\n\nconsole.error('❌ Workflow failed:', errorMessage);\n\nthrow new Error(errorMessage);"
      },
      "name": "Throw Error",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [1720, 400]
    }
  ];
  
  // Обновляем существующую ноду Format Result
  const formatResultNode = current.nodes.find(n => n.name === 'Format Result');
  if (formatResultNode) {
    formatResultNode.parameters.jsCode = `// Формируем итоговое сообщение со статистикой
const allItems = $input.all();

const stats = {
  total: 0,
  saved: 0,
  errors: 0,
  by_branch: {},
  error_details: []
};

allItems.forEach(item => {
  const json = item.json;
  
  stats.total++;
  
  // Проверяем на ошибки сохранения
  if (json.error) {
    stats.errors++;
    stats.error_details.push({
      message: json.error_message || json.error || 'Unknown error',
      branch: json.branch || 'unknown',
      booking_number: json.number
    });
  } else if (json.id) {
    stats.saved++;
    
    // Получаем branch из оригинальных данных (нужно пробросить через Process)
    // Пока используем упрощенную логику
    const branch = 'all';
    
    if (!stats.by_branch[branch]) {
      stats.by_branch[branch] = { saved: 0, errors: 0 };
    }
    stats.by_branch[branch].saved++;
  }
});

let message = '📋 Парсинг броней RentProg через API раз в 15 минут:\\n';
message += \`Всего обработано: \${stats.total} записей\\n\`;
message += \`Сохранено: \${stats.saved} ✓\\n\`;

if (stats.errors > 0) {
  message += \`\\n🚨 ОШИБОК: \${stats.errors}\\n\`;
  
  // Группируем ошибки
  const errorGroups = {};
  stats.error_details.forEach(err => {
    const key = err.message.substring(0, 100);
    errorGroups[key] = (errorGroups[key] || 0) + 1;
  });
  
  Object.entries(errorGroups).forEach(([msg, count]) => {
    message += \`  • \${msg}\${count > 1 ? \` (x\${count})\` : ''}\\n\`;
  });
}

return [{
  json: {
    message,
    success: stats.errors === 0,
    total: stats.total,
    saved: stats.saved,
    error_count: stats.errors,
    by_branch: stats.by_branch,
    error_details: stats.error_details
  }
}];`;
    formatResultNode.position = [1120, 500];
  }
  
  // Обновляем Success ноду
  const successNode = current.nodes.find(n => n.name === 'Success');
  if (successNode) {
    successNode.position = [1520, 600];
  }
  
  // Добавляем новые ноды
  current.nodes.push(...newNodes);
  
  // Обновляем connections
  current.connections['Process All Bookings'] = {
    "main": [[{"node": "Save to DB", "type": "main", "index": 0}]]
  };
  
  current.connections['Save to DB'] = {
    "main": [[{"node": "Format Result", "type": "main", "index": 0}]]
  };
  
  current.connections['Format Result'] = {
    "main": [[{"node": "If Error", "type": "main", "index": 0}]]
  };
  
  current.connections['If Error'] = {
    "main": [
      [{"node": "Send Alert", "type": "main", "index": 0}],
      [{"node": "Success", "type": "main", "index": 0}]
    ]
  };
  
  current.connections['Send Alert'] = {
    "main": [[{"node": "Throw Error", "type": "main", "index": 0}]]
  };
  
  // Удаляем id из нод
  current.nodes.forEach(node => {
    delete node.id;
  });
  
  // Создаем чистый объект для обновления (ТОЛЬКО необходимые поля)
  const updateData = {
    name: current.name,
    nodes: current.nodes,
    connections: current.connections,
    settings: current.settings
  };
  
  // Обновляем workflow
  const updateResponse = await fetch(`${N8N_API_URL}/workflows/${WORKFLOW_ID}`, {
    method: 'PUT',
    headers: {
      'X-N8N-API-KEY': N8N_API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(updateData)
  });
  
  if (!updateResponse.ok) {
    const errorText = await updateResponse.text();
    throw new Error(`Failed to update workflow: ${updateResponse.statusText}\n${errorText}`);
  }
  
  const result = await updateResponse.json();
  console.log(`✅ Workflow обновлен успешно!`);
  console.log(`   Нод: ${result.nodes.length}`);
  console.log(`🔗 URL: https://n8n.rentflow.rentals/workflow/${WORKFLOW_ID}`);
}

updateWorkflow().catch(err => {
  console.error('❌ Ошибка:', err.message);
  process.exit(1);
});

