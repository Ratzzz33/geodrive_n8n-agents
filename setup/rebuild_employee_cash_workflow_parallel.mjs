#!/usr/bin/env node
/**
 * Скрипт для создания НАСТОЯЩЕЙ параллельной архитектуры workflow
 * 4 отдельных HTTP Request узла для каждого филиала
 */

const N8N_HOST = 'https://n8n.rentflow.rentals/api/v1';
const N8N_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI';

const WORKFLOW_ID = '8jkfmWF2dTtnlMHj';

// Токены для каждого филиала
const TOKENS = {
  'tbilisi': 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxNjA0NiIsInNjcCI6InVzZXIiLCJhdWQiOm51bGwsImlhdCI6MTc2MjQ5MDExMywiZXhwIjoxNzY1MDgyMTEzLCJqdGkiOiI0MmUxNzQ5Zi02MjEyLTRmOTMtOGM0Zi02ZWMwODUzYmUwYWQifQ.20oXaXcgK_hdofbUK3RGdQuPa0pGWtZTV4b42-A8oY4',
  'batumi': 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxNjA0OCIsInNjcCI6InVzZXIiLCJhdWQiOm51bGwsImlhdCI6MTc2MjQ5MDE1NCwiZXhwIjoxNzY1MDgyMTU0LCJqdGkiOiI0MWUxMjRjOS01MDgxLTQ2NmMtOTUxNS0xNWEwMjE4ZDA1OTEifQ.l2MfCEf1LJLe-kCuF-MKyOMdhAmd3UWfzG7xECMy37o',
  'kutaisi': 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxNjA0OSIsInNjcCI6InVzZXIiLCJhdWQiOm51bGwsImlhdCI6MTc2MjQ5MDIwMiwiZXhwIjoxNzY1MDgyMjAyLCJqdGkiOiIxZWVlMWU2YS1kMTNhLTQwMzEtYjI2Mi04NGRiM2Y0ZmFiMGEifQ.xGIpTLumIwLxpitlLbeclqb9XBedY8jV1wCIuMP69Vs',
  'service-center': 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxNjA0NSIsInNjcCI6InVzZXIiLCJhdWQiOm51bGwsImlhdCI6MTc2MjQ5MDA0MSwiZXhwIjoxNzY1MDgyMDQxLCJqdGkiOiI1ZDkwMDI2MC02NTE2LTQxYjctOTI4Ny1jODAyMjNiN2EwNTMifQ.oLMvW9mftfJ9Oivy2riQjx8uK12Ur6aaFy02sDs6DSc'
};

// Новая структура workflow с НАСТОЯЩЕЙ параллельностью
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
      position: [120, 240]
    },
    
    // 2-5. Четыре параллельных HTTP Request (по одному на филиал)
    {
      parameters: {
        url: "https://rentprog.net/api/v1/users",
        sendHeaders: true,
        headerParameters: {
          parameters: [
            { name: "Authorization", value: `Bearer ${TOKENS.tbilisi}` },
            { name: "Accept", value: "application/json" },
            { name: "Origin", value: "https://web.rentprog.ru" },
            { name: "Referer", value: "https://web.rentprog.ru/" },
            { name: "User-Agent", value: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" }
          ]
        },
        options: {}
      },
      id: "get-users-tbilisi",
      name: "Get Users Tbilisi",
      type: "n8n-nodes-base.httpRequest",
      typeVersion: 4.2,
      position: [304, 160],
      continueOnFail: true
    },
    {
      parameters: {
        url: "https://rentprog.net/api/v1/users",
        sendHeaders: true,
        headerParameters: {
          parameters: [
            { name: "Authorization", value: `Bearer ${TOKENS.batumi}` },
            { name: "Accept", value: "application/json" },
            { name: "Origin", value: "https://web.rentprog.ru" },
            { name: "Referer", value: "https://web.rentprog.ru/" },
            { name: "User-Agent", value: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" }
          ]
        },
        options: {}
      },
      id: "get-users-batumi",
      name: "Get Users Batumi",
      type: "n8n-nodes-base.httpRequest",
      typeVersion: 4.2,
      position: [304, 320],
      continueOnFail: true
    },
    {
      parameters: {
        url: "https://rentprog.net/api/v1/users",
        sendHeaders: true,
        headerParameters: {
          parameters: [
            { name: "Authorization", value: `Bearer ${TOKENS.kutaisi}` },
            { name: "Accept", value: "application/json" },
            { name: "Origin", value: "https://web.rentprog.ru" },
            { name: "Referer", value: "https://web.rentprog.ru/" },
            { name: "User-Agent", value: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" }
          ]
        },
        options: {}
      },
      id: "get-users-kutaisi",
      name: "Get Users Kutaisi",
      type: "n8n-nodes-base.httpRequest",
      typeVersion: 4.2,
      position: [304, 480],
      continueOnFail: true
    },
    {
      parameters: {
        url: "https://rentprog.net/api/v1/users",
        sendHeaders: true,
        headerParameters: {
          parameters: [
            { name: "Authorization", value: `Bearer ${TOKENS['service-center']}` },
            { name: "Accept", value: "application/json" },
            { name: "Origin", value: "https://web.rentprog.ru" },
            { name: "Referer", value: "https://web.rentprog.ru/" },
            { name: "User-Agent", value: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" }
          ]
        },
        options: {}
      },
      id: "get-users-service",
      name: "Get Users Service Center",
      type: "n8n-nodes-base.httpRequest",
      typeVersion: 4.2,
      position: [304, 640],
      continueOnFail: true
    },
    
    // 6. Merge All Users (объединяет 4 параллельных потока)
    {
      parameters: {
        mode: "append",
        options: {}
      },
      id: "merge-all-users",
      name: "Merge All Users",
      type: "n8n-nodes-base.merge",
      typeVersion: 3,
      position: [488, 400]
    },
    
    // 7. Unpack Users (обрабатывает объединенные данные)
    {
      parameters: {
        jsCode: `// Получаем все items после merge
const allItems = $input.all();

console.log(\`Received \${allItems.length} responses from merge\`);

const result = [];

// Определяем branch по позиции в merge (0=tbilisi, 1=batumi, 2=kutaisi, 3=service-center)
const branches = ['tbilisi', 'batumi', 'kutaisi', 'service-center'];

allItems.forEach((item, globalIndex) => {
  const apiResponse = item.json;
  
  // Определяем branch по pairedItem или по порядку
  let branch = 'unknown';
  if (item.pairedItem?.item !== undefined) {
    branch = branches[item.pairedItem.item] || 'unknown';
  } else if (globalIndex < branches.length) {
    branch = branches[globalIndex];
  }
  
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
      id: "unpack-users",
      name: "Unpack RentProg Users",
      type: "n8n-nodes-base.code",
      typeVersion: 2,
      position: [672, 400]
    },
    
    // 8. Get Employees from DB (параллельно)
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
      position: [120, 560],
      credentials: { postgres: { id: "3I9fyXVlGg4Vl4LZ", name: "Postgres account" } }
    },
    
    // 9. Wait for Both Sources (Merge)
    {
      parameters: {},
      id: "merge-wait-both",
      name: "Wait for Both Sources",
      type: "n8n-nodes-base.merge",
      typeVersion: 3,
      position: [856, 480]
    },
    
    // 10. Compare Balances
    {
      parameters: {
        jsCode: `// Собираем все элементы после merge
const allItems = $input.all();

// Разделяем по источнику
const rentprogUsers = [];
const dbEmployees = [];

allItems.forEach(item => {
  if (item.json.branch) {
    rentprogUsers.push(item.json);
  } else if (item.json.employee_id) {
    dbEmployees.push(item.json);
  }
});

console.log(\`RentProg users: \${rentprogUsers.length}, DB employees: \${dbEmployees.length}\`);

// Создаем индекс по rentprog_id для быстрого поиска
const dbIndex = {};
dbEmployees.forEach(emp => {
  if (emp.rentprog_id) {
    dbIndex[emp.rentprog_id] = emp;
  }
});

// Сравниваем и ищем расхождения
const discrepancies = [];

rentprogUsers.forEach(rpUser => {
  const dbEmp = dbIndex[rpUser.user_id];
  
  if (!dbEmp) {
    // Новый сотрудник, которого нет в БД
    console.log(\`New employee: \${rpUser.user_name} (ID: \${rpUser.user_id})\`);
    return;
  }
  
  // Сравниваем кассы
  const rpGel = rpUser.cash.GEL || 0;
  const rpUsd = rpUser.cash.USD || 0;
  const rpEur = rpUser.cash.EUR || 0;
  
  const dbGel = parseFloat(dbEmp.cash_gel) || 0;
  const dbUsd = parseFloat(dbEmp.cash_usd) || 0;
  const dbEur = parseFloat(dbEmp.cash_eur) || 0;
  
  if (rpGel !== dbGel || rpUsd !== dbUsd || rpEur !== dbEur) {
    discrepancies.push({
      branch: rpUser.branch,
      employee_id: dbEmp.employee_id,
      employee_name: rpUser.user_name,
      rentprog_id: rpUser.user_id,
      old_gel: dbGel,
      new_gel: rpGel,
      old_usd: dbUsd,
      new_usd: rpUsd,
      old_eur: dbEur,
      new_eur: rpEur
    });
  }
});

console.log(\`Found \${discrepancies.length} discrepancies\`);

if (discrepancies.length === 0) {
  return [{
    json: {
      status: 'no_discrepancies',
      message: 'Все кассы совпадают с данными RentProg'
    }
  }];
}

return discrepancies.map(d => ({ json: d }));`
      },
      id: "compare-balances",
      name: "Compare Balances",
      type: "n8n-nodes-base.code",
      typeVersion: 2,
      position: [1040, 480]
    },
    
    // 11. If Has Discrepancy
    {
      parameters: {
        conditions: {
          options: { caseSensitive: true, leftValue: "", typeValidation: "strict" },
          conditions: [{
            id: "cond-1",
            leftValue: "={{ $json.status }}",
            rightValue: "no_discrepancies",
            operator: { type: "string", operation: "notEquals" }
          }],
          combinator: "and"
        },
        options: {}
      },
      id: "if-has-discrepancy",
      name: "If Has Discrepancy",
      type: "n8n-nodes-base.if",
      typeVersion: 2,
      position: [1224, 400]
    },
    
    // 12. Auto-Correct Cash
    {
      parameters: {
        operation: "executeQuery",
        query: "=`UPDATE rentprog_employees SET cash_gel = ${$json.new_gel}, cash_usd = ${$json.new_usd}, cash_eur = ${$json.new_eur}, updated_at = NOW() WHERE id = '${$json.employee_id}' RETURNING id, name, cash_gel, cash_usd, cash_eur`",
        options: {}
      },
      id: "auto-correct-cash",
      name: "Auto-Correct Cash",
      type: "n8n-nodes-base.postgres",
      typeVersion: 2.4,
      position: [1408, 320],
      credentials: { postgres: { id: "3I9fyXVlGg4Vl4LZ", name: "Postgres account" } }
    },
    
    // 13. Format Alert
    {
      parameters: {
        jsCode: `const items = $input.all();

let message = '🔔 Обновлены кассы сотрудников:\\n\\n';

items.forEach((item, idx) => {
  const d = item.json;
  message += \`\${idx + 1}. 👤 \${d.employee_name} (\${d.branch})\\n\`;
  
  if (d.old_gel !== d.new_gel) {
    message += \`   GEL: \${d.old_gel} → \${d.new_gel}\\n\`;
  }
  if (d.old_usd !== d.new_usd) {
    message += \`   USD: \${d.old_usd} → \${d.new_usd}\\n\`;
  }
  if (d.old_eur !== d.new_eur) {
    message += \`   EUR: \${d.old_eur} → \${d.new_eur}\\n\`;
  }
  message += '\\n';
});

message += \`\\nВсего обновлено: \${items.length} сотрудников\`;

return [{ json: { message } }];`
      },
      id: "format-alert",
      name: "Format Alert",
      type: "n8n-nodes-base.code",
      typeVersion: 2,
      position: [1592, 320]
    },
    
    // 14. Send Telegram Alert
    {
      parameters: {
        chatId: "={{ $env.TELEGRAM_ALERT_CHAT_ID }}",
        text: "={{ $json.message }}",
        operation: "sendMessage",
        additionalFields: {}
      },
      id: "send-alert",
      name: "Send Telegram Alert",
      type: "n8n-nodes-base.telegram",
      typeVersion: 1.2,
      position: [1776, 320],
      webhookId: "bb2b854b-4e3f-4162-bb64-b1dc50b354f6",
      credentials: { telegramApi: { id: "nONqDN52rBYnhODp", name: "Telegram Bot (@n8n_alert_geodrive_bot)" } },
      continueOnFail: true
    },
    
    // 15. All OK (NoOp)
    {
      parameters: {},
      id: "no-op-ok",
      name: "All OK",
      type: "n8n-nodes-base.noOp",
      typeVersion: 1,
      position: [1408, 480]
    }
  ],
  connections: {
    "Daily at 04:00 Tbilisi": {
      main: [[
        { node: "Get Users Tbilisi", type: "main", index: 0 },
        { node: "Get Users Batumi", type: "main", index: 0 },
        { node: "Get Users Kutaisi", type: "main", index: 0 },
        { node: "Get Users Service Center", type: "main", index: 0 },
        { node: "Get Employees from DB", type: "main", index: 0 }
      ]]
    },
    "Get Users Tbilisi": {
      main: [[{ node: "Merge All Users", type: "main", index: 0 }]]
    },
    "Get Users Batumi": {
      main: [[{ node: "Merge All Users", type: "main", index: 1 }]]
    },
    "Get Users Kutaisi": {
      main: [[{ node: "Merge All Users", type: "main", index: 2 }]]
    },
    "Get Users Service Center": {
      main: [[{ node: "Merge All Users", type: "main", index: 3 }]]
    },
    "Merge All Users": {
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
        [{ node: "Auto-Correct Cash", type: "main", index: 0 }],
        [{ node: "All OK", type: "main", index: 0 }]
      ]
    },
    "Auto-Correct Cash": {
      main: [[{ node: "Format Alert", type: "main", index: 0 }]]
    },
    "Format Alert": {
      main: [[{ node: "Send Telegram Alert", type: "main", index: 0 }]]
    }
  },
  settings: {
    executionOrder: "v1"
  }
};

// Функция обновления workflow
async function updateWorkflow() {
  try {
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
      throw new Error(`HTTP ${response.status}: ${error}`);
    }

    const result = await response.json();
    console.log('✅ Workflow updated successfully!');
    console.log(`   ID: ${result.id || result.data?.id}`);
    console.log(`   Name: ${result.name || result.data?.name}`);
    console.log(`   Version: ${result.versionId || result.data?.versionId}`);
    console.log(`\n🔗 URL: https://n8n.rentflow.rentals/workflow/${WORKFLOW_ID}`);
    console.log('\n📊 НАСТОЯЩАЯ параллельная архитектура: 4 HTTP Request узла запускаются одновременно!');
    
    // Активируем workflow
    const activateResponse = await fetch(`${N8N_HOST}/workflows/${WORKFLOW_ID}/activate`, {
      method: 'POST',
      headers: {
        'X-N8N-API-KEY': N8N_API_KEY,
        'Content-Type': 'application/json'
      }
    });

    if (activateResponse.ok) {
      console.log('✅ Workflow активирован');
    }

  } catch (error) {
    console.error('❌ Error updating workflow:', error.message);
    process.exit(1);
  }
}

updateWorkflow();

