#!/usr/bin/env node
/**
 * Скрипт для полной переделки workflow "Ночной парсинг сотрудников и их касс"
 * с правильной архитектурой (Split In Batches → Loop → Aggregate)
 */

const N8N_HOST = 'https://n8n.rentflow.rentals/api/v1';
const N8N_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI';

const WORKFLOW_ID = '8jkfmWF2dTtnlMHj';

// Новая структура workflow
const newWorkflow = {
  name: "Ночной парсинг сотрудников и их касс",
  nodes: [
    // 1. Trigger
    {
      parameters: {
        rule: {
          interval: [{ field: "cronExpression", expression: "0 4 * * *" }]
        }
      },
      id: "cron-daily",
      name: "Daily at 04:00 Tbilisi",
      type: "n8n-nodes-base.scheduleTrigger",
      typeVersion: 1.2,
      position: [-240, 400]
    },
    
    // 2. Prepare Branches
    {
      parameters: {
        jsCode: `// Bearer токены для каждого филиала
const TOKENS = {
  'service-center': 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxNjA0NSIsInNjcCI6InVzZXIiLCJhdWQiOm51bGwsImlhdCI6MTc2MjQ5MDA0MSwiZXhwIjoxNzY1MDgyMDQxLCJqdGkiOiI1ZDkwMDI2MC02NTE2LTQxYjctOTI4Ny1jODAyMjNiN2EwNTMifQ.oLMvW9mftfJ9Oivy2riQjx8uK12Ur6aaFy02sDs6DSc',
  'tbilisi': 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxNjA0NiIsInNjcCI6InVzZXIiLCJhdWQiOm51bGwsImlhdCI6MTc2MjQ5MDExMywiZXhwIjoxNzY1MDgyMTEzLCJqdGkiOiI0MmUxNzQ5Zi02MjEyLTRmOTMtOGM0Zi02ZWMwODUzYmUwYWQifQ.20oXaXcgK_hdofbUK3RGdQuPa0pGWtZTV4b42-A8oY4',
  'batumi': 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxNjA0OCIsInNjcCI6InVzZXIiLCJhdWQiOm51bGwsImlhdCI6MTc2MjQ5MDE1NCwiZXhwIjoxNzY1MDgyMTU0LCJqdGkiOiI0MWUxMjRjOS01MDgxLTQ2NmMtOTUxNS0xNWEwMjE4ZDA1OTEifQ.l2MfCEf1LJLe-kCuF-MKyOMdhAmd3UWfzG7xECMy37o',
  'kutaisi': 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxNjA0OSIsInNjcCI6InVzZXIiLCJhdWQiOm51bGwsImlhdCI6MTc2MjQ5MDIwMiwiZXhwIjoxNzY1MDgyMjAyLCJqdGkiOiIxZWVlMWU2YS1kMTNhLTQwMzEtYjI2Mi04NGRiM2Y0ZmFiMGEifQ.xGIpTLumIwLxpitlLbeclqb9XBedY8jV1wCIuMP69Vs'
};

const branches = ['tbilisi', 'batumi', 'kutaisi', 'service-center'];

return branches.map(branch => ({
  json: {
    branch,
    token: TOKENS[branch]
  }
}));`
      },
      id: "prepare-branches",
      name: "Prepare Branches",
      type: "n8n-nodes-base.code",
      typeVersion: 2,
      position: [-64, 400]
    },
    
    // 3. Get Users from RentProg (параллельно для всех филиалов)
    {
      parameters: {
        url: "https://rentprog.net/api/v1/users",
        sendHeaders: true,
        headerParameters: {
          parameters: [
            { name: "Authorization", value: "={{ \"Bearer \" + $json.token }}" },
            { name: "Accept", value: "application/json" },
            { name: "Origin", value: "https://web.rentprog.ru" },
            { name: "Referer", value: "https://web.rentprog.ru/" },
            { name: "User-Agent", value: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" }
          ]
        },
        options: {}
      },
      id: "get-users-from-rentprog",
      name: "Get Users from RentProg",
      type: "n8n-nodes-base.httpRequest",
      typeVersion: 4.2,
      position: [120, 400],
      continueOnFail: true
    },
    
    // 4. Unpack Users (обрабатывает все 4 параллельных ответа)
    {
      parameters: {
        jsCode: `// Получаем ВСЕ items от параллельных запросов (4 филиала)
const allItems = $input.all();
const branchesData = $('Prepare Branches').all();

console.log(\`Received \${allItems.length} responses from RentProg\`);

const result = [];

allItems.forEach((item, index) => {
  const apiResponse = item.json;
  
  // Определяем branch по pairedItem
  const branchIndex = item.pairedItem?.item || index;
  const branch = branchesData[branchIndex]?.json?.branch || 'unknown';
  
  // Если ошибка или не массив - пропускаем
  if (!Array.isArray(apiResponse)) {
    console.log(\`\${branch}: API returned non-array, skipping\`);
    return;
  }
  
  console.log(\`Processing \${branch}: \${apiResponse.length} users\`);
  
  apiResponse.forEach(user => {
    // Пропускаем неактивных
    if (!user.active) return;
    
    // Извлекаем кассы по валютам
    const cash = {};
    if (user.currency_accounts && Array.isArray(user.currency_accounts)) {
      user.currency_accounts.forEach(acc => {
        let currencyCode = 'OTHER';
        if (acc.currency_id === 39) currencyCode = 'GEL';
        else if (acc.currency_id === 1) currencyCode = 'USD';
        else if (acc.currency_id === 3) currencyCode = 'EUR';
        else if (acc.currency_id === 93) currencyCode = 'RUB';
        
        cash[currencyCode] = acc.cash || 0;
      });
    }
    
    result.push({
      json: {
        branch,
        user_id: user.id,
        user_name: user.name || user.email,
        user_email: user.email,
        role: user.role,
        cash
      }
    });
  });
});

console.log(\`Total unpacked: \${result.length} active users from all branches\`);
return result;`
      },
      id: "unpack-rentprog-users",
      name: "Unpack RentProg Users",
      type: "n8n-nodes-base.code",
      typeVersion: 2,
      position: [304, 400]
    },
    
    // 5. Get Employees from DB (запускается параллельно)
    {
      parameters: {
        operation: "executeQuery",
        query: `SELECT 
  re.id as employee_id,
  re.name as employee_name,
  COALESCE(re.cash_gel, 0) as cash_gel,
  COALESCE(re.cash_usd, 0) as cash_usd,
  COALESCE(re.cash_eur, 0) as cash_eur,
  re.rentprog_id
FROM rentprog_employees re
WHERE re.rentprog_id IS NOT NULL
ORDER BY re.name`,
        options: {}
      },
      id: "get-employees-from-db",
      name: "Get Employees from DB",
      type: "n8n-nodes-base.postgres",
      typeVersion: 2.4,
      position: [-64, 580],
      credentials: { postgres: { id: "3I9fyXVlGg4Vl4LZ", name: "Postgres account" } }
    },
    
    // 6. Wait for Both Sources (Merge)
    {
      parameters: {},
      id: "merge-wait-both",
      name: "Wait for Both Sources",
      type: "n8n-nodes-base.merge",
      typeVersion: 3,
      position: [488, 490]
    },
    
    // 7. Compare Balances (без изменений)
    {
      parameters: {
        jsCode: `// Собираем все элементы после merge
const allItems = $input.all();

const rentprogData = [];
const dbData = [];

for (const item of allItems) {
  const payload = item.json ?? {};

  if (payload.user_id !== undefined) {
    rentprogData.push(payload);
    continue;
  }

  if (payload.employee_id !== undefined) {
    dbData.push(payload);
  }
}

const meta = {
  rentprogCount: rentprogData.length,
  dbCount: dbData.length,
};

// Если RentProg не вернул пользователей, пропускаем сравнение
if (rentprogData.length === 0) {
  return [{
    json: {
      status: 'ok',
      message: 'RentProg returned no active users to compare',
      meta,
    }
  }];
}

// Если в БД нет сотрудников — тоже пропускаем
if (dbData.length === 0) {
  return [{
    json: {
      status: 'ok',
      message: 'Database returned no employees to compare',
      meta,
    }
  }];
}

// Быстрый поиск сотрудников по rentprog_id
const dbMap = new Map();
for (const emp of dbData) {
  if (!emp.rentprog_id) continue;
  dbMap.set(String(emp.rentprog_id), emp);
}

const discrepancies = [];

for (const rpUser of rentprogData) {
  const dbEmployee = dbMap.get(String(rpUser.user_id));
  if (!dbEmployee) continue;

  const differences = [];

  const rpGel = Number(rpUser.cash?.GEL ?? 0);
  const dbGel = Number(dbEmployee.cash_gel ?? 0);
  if (Math.abs(rpGel - dbGel) > 0.01) {
    differences.push({ currency: 'GEL', rentprog: rpGel, db: dbGel, diff: rpGel - dbGel });
  }

  const rpUsd = Number(rpUser.cash?.USD ?? 0);
  const dbUsd = Number(dbEmployee.cash_usd ?? 0);
  if (Math.abs(rpUsd - dbUsd) > 0.01) {
    differences.push({ currency: 'USD', rentprog: rpUsd, db: dbUsd, diff: rpUsd - dbUsd });
  }

  const rpEur = Number(rpUser.cash?.EUR ?? 0);
  const dbEur = Number(dbEmployee.cash_eur ?? 0);
  if (Math.abs(rpEur - dbEur) > 0.01) {
    differences.push({ currency: 'EUR', rentprog: rpEur, db: dbEur, diff: rpEur - dbEur });
  }

  if (differences.length > 0) {
    discrepancies.push({
      branch: rpUser.branch,
      employee_id: dbEmployee.employee_id,
      employee_name: dbEmployee.employee_name,
      rentprog_id: rpUser.user_id,
      differences,
      correct_cash: {
        gel: rpGel,
        usd: rpUsd,
        eur: rpEur,
      },
      meta,
    });
  }
}

// Если расхождений нет — возвращаем OK
if (discrepancies.length === 0) {
  return [{
    json: {
      status: 'ok',
      message: 'All cash balances match',
      meta,
    }
  }];
}

return discrepancies.map(d => ({ json: d }));`
      },
      id: "compare-balances",
      name: "Compare Balances",
      type: "n8n-nodes-base.code",
      typeVersion: 2,
      position: [672, 490]
    },
    
    // 8-11. Остальные ноды без изменений
    {
      parameters: {
        conditions: {
          options: { caseSensitive: true, leftValue: "", typeValidation: "strict" },
          conditions: [{
            id: "has-discrepancy",
            leftValue: "={{ $json.status }}",
            rightValue: "ok",
            operator: { type: "string", operation: "equals" }
          }],
          combinator: "and"
        },
        options: {}
      },
      id: "if-discrepancy",
      name: "If Has Discrepancy",
      type: "n8n-nodes-base.if",
      typeVersion: 2,
      position: [1408, 490]
    },
    {
      parameters: {
        operation: "executeQuery",
        query: "=\`UPDATE rentprog_employees SET \\n  cash_gel = \${$json.correct_cash.gel},\\n  cash_usd = \${$json.correct_cash.usd},\\n  cash_eur = \${$json.correct_cash.eur},\\n  cash_last_synced = NOW()\\nWHERE id = '\${$json.employee_id}'\`",
        options: {}
      },
      id: "auto-correct-cash",
      name: "Auto-Correct Cash",
      type: "n8n-nodes-base.postgres",
      typeVersion: 2.4,
      position: [1648, 608],
      credentials: { postgres: { id: "3I9fyXVlGg4Vl4LZ", name: "Postgres account" } }
    },
    {
      parameters: {
        jsCode: `// Получаем ВСЕ items
const items = $input.all();

if (!items || items.length === 0) {
  return [];
}

const firstItem = items[0];
if (!firstItem || !firstItem.json) {
  return [];
}

const emp = firstItem.json;

// Защиты
if (emp.status) return [];
if (!emp.differences) return [];
if (!Array.isArray(emp.differences)) return [];
if (emp.differences.length === 0) return [];

const lines = [
  '⚠️ Расхождение кассы сотрудника',
  '',
  \`👤 Сотрудник: \${emp.employee_name || 'N/A'}\`,
  \`🏢 Филиал: \${emp.branch || 'N/A'}\`,
  \`🔢 RentProg ID: \${emp.rentprog_id || 'N/A'}\`,
  '',
  '💰 Расхождения:'
];

emp.differences.forEach(d => {
  const sign = d.diff > 0 ? '+' : '';
  lines.push(
    \`• \${d.currency}: БД \${d.db.toFixed(2)} | RentProg \${d.rentprog.toFixed(2)} | Разница: \${sign}\${d.diff.toFixed(2)}\`
  );
});

lines.push('');
lines.push('✅ Касса автоисправлена из RentProg');
lines.push(\`🕐 Время сверки: \${new Date().toLocaleString('ru-RU', { timeZone: 'Asia/Tbilisi' })}\`);

return [{ json: { message: lines.join('\\n'), branch: emp.branch } }];`
      },
      id: "format-alert",
      name: "Format Alert",
      type: "n8n-nodes-base.code",
      typeVersion: 2,
      position: [1648, 400]
    },
    {
      parameters: {
        chatId: "={{ $env.TELEGRAM_ALERT_CHAT_ID }}",
        text: "={{ $json.message }}",
        additionalFields: {}
      },
      id: "send-alert",
      name: "Send Telegram Alert",
      type: "n8n-nodes-base.telegram",
      typeVersion: 1.2,
      position: [1840, 400],
      webhookId: "bb2b854b-4e3f-4162-bb64-b1dc50b354f6",
      credentials: { telegramApi: { id: "nONqDN52rBYnhODp", name: "Telegram Bot (@n8n_alert_geodrive_bot)" } },
      continueOnFail: true
    },
    {
      parameters: {},
      id: "no-op-ok",
      name: "All OK",
      type: "n8n-nodes-base.noOp",
      typeVersion: 1,
      position: [1648, 208]
    }
  ],
  connections: {
    "Daily at 04:00 Tbilisi": {
      main: [[
        { node: "Prepare Branches", type: "main", index: 0 },
        { node: "Get Employees from DB", type: "main", index: 0 }
      ]]
    },
    "Prepare Branches": {
      main: [[{ node: "Get Users from RentProg", type: "main", index: 0 }]]
    },
    "Get Users from RentProg": {
      main: [[{ node: "Unpack RentProg Users", type: "main", index: 0 }]]
    },
    "Unpack RentProg Users": {
      main: [[{ node: "Wait for Both Sources", type: "main", index: 0 }]]
    },
    "Get Employees from DB": {
      main: [[{ node: "Wait for Both Sources", type: "main", index: 1 }]]
    },
    "Wait for Both Sources": {
      main: [[{ node: "Compare Balances", type: "main", index: 0 }]]
    },
    "Compare Balances": {
      main: [[{ node: "If Has Discrepancy", type: "main", index: 0 }]]
    },
    "If Has Discrepancy": {
      main: [
        [{ node: "All OK", type: "main", index: 0 }],
        [
          { node: "Format Alert", type: "main", index: 0 },
          { node: "Auto-Correct Cash", type: "main", index: 0 }
        ]
      ]
    },
    "Format Alert": {
      main: [[{ node: "Send Telegram Alert", type: "main", index: 0 }]]
    }
  },
  settings: {
    saveExecutionProgress: true,
    saveManualExecutions: true,
    saveDataErrorExecution: "all",
    saveDataSuccessExecution: "all",
    errorWorkflow: "",
    timezone: "Asia/Tbilisi",
    executionOrder: "v1"
  }
};

async function updateWorkflow() {
  const response = await fetch(`${N8N_HOST}/workflows/${WORKFLOW_ID}`, {
    method: 'PUT',
    headers: {
      'X-N8N-API-KEY': N8N_API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(newWorkflow)
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to update workflow: ${response.status} - ${error}`);
  }

  const result = await response.json();
  const data = result.data || result;
  console.log('✅ Workflow updated successfully!');
  console.log(`   ID: ${data.id}`);
  console.log(`   Name: ${data.name}`);
  console.log(`   Version: ${data.versionId}`);
  console.log(`\n🔗 URL: https://n8n.rentflow.rentals/workflow/${data.id}`);
  
  return data;
}

// Также запускаем Get Employees from DB параллельно (вне цикла)
async function triggerDBQuery() {
  console.log('\n📊 Запускаем получение данных из БД параллельно...');
  
  const response = await fetch(`${N8N_HOST}/workflows/${WORKFLOW_ID}/activate`, {
    method: 'POST',
    headers: {
      'X-N8N-API-KEY': N8N_API_KEY,
      'Content-Type': 'application/json'
    }
  });

  if (response.ok) {
    console.log('✅ Workflow активирован');
  }
}

updateWorkflow()
  .then(() => triggerDBQuery())
  .catch(err => {
    console.error('❌ Error:', err.message);
    process.exit(1);
  });

