#!/usr/bin/env node
import fetch from 'node-fetch';

const N8N_HOST = 'https://n8n.rentflow.rentals/api/v1';
const N8N_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI';

console.log('🚗 Создаю workflow для парсинга HTML страницы /cars...\n');

// JWT токены пользователей (вечные)
const BRANCH_TOKENS = {
  'tbilisi': 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjczOSIsImV4cCI6MTczNzQ5MDE0NX0.Q0HCQMvHeV1WvvVlDTRxI0I3uQ5-DJa7UjTIbVGxTYU',
  'batumi': 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiI0MTkxMiIsImV4cCI6MTczNzQ5MDE0NX0.E0HCQMvHeV1WvvVlDTRxI0I3uQ5-DJa7UjTIbVGxTZV',
  'kutaisi': 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiI0MTkxMiIsImV4cCI6MTczNzQ5MDE0NX0.F0HCQMvHeV1WvvVlDTRxI0I3uQ5-DJa7UjTIbVGxTaW',
  'service-center': 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiI0MTkxMiIsImV4cCI6MTczNzQ5MDE0NX0.G0HCQMvHeV1WvvVlDTRxI0I3uQ5-DJa7UjTIbVGxTbX'
};

const workflow = {
  name: '✅ Парсинг HTML страницы автомобилей раз в час',
  nodes: [
    // 1. Schedule
    {
      parameters: {
        rule: {
          interval: [{ field: 'hours', hoursInterval: 1 }]
        }
      },
      name: 'Every Hour',
      type: 'n8n-nodes-base.scheduleTrigger',
      typeVersion: 1.2,
      position: [240, 400],
      id: 'schedule-1'
    },
    
    // 2. Prepare Branches - создаем список филиалов с JWT токенами
    {
      parameters: {
        jsCode: `const BRANCH_TOKENS = ${JSON.stringify(BRANCH_TOKENS)};
const branches = ['tbilisi', 'batumi', 'kutaisi', 'service-center'];

return branches.map(branch => ({
  json: {
    branch: branch,
    auth_token: BRANCH_TOKENS[branch]
  }
}));`
      },
      name: 'Prepare Branches',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [440, 400],
      id: 'prepare-1'
    },
    
    // 3. Get Cars Page - получаем HTML
    {
      parameters: {
        method: 'GET',
        url: 'https://web.rentprog.ru/cars',
        sendHeaders: true,
        headerParameters: {
          parameters: [
            { name: 'Cookie', value: '=auth_token={{ $json.auth_token }}' },
            { name: 'Accept', value: 'text/html' },
            { name: 'User-Agent', value: 'Mozilla/5.0' }
          ]
        },
        options: {
          timeout: 30000,
          response: {
            response: {
              fullResponse: false,
              responseFormat: 'text'
            }
          }
        }
      },
      name: 'Get Cars Page',
      type: 'n8n-nodes-base.httpRequest',
      typeVersion: 4.2,
      position: [840, 400],
      retryOnFail: true,
      maxTries: 2,
      continueOnFail: true,
      id: 'get-html-1'
    },
    
    // 5. Parse HTML - извлекаем данные из таблицы
    {
      parameters: {
        jsCode: `const results = [];

for (const item of $input.all()) {
  const branch = item.json.branch;
  const html = item.json.data || '';
  
  if (!html || html.includes('signin')) {
    results.push({
      json: {
        branch: branch,
        error: true,
        error_message: 'Login failed or HTML not loaded'
      }
    });
    continue;
  }
  
  // Простой regex парсинг таблицы (без зависимостей)
  // Ищем строки таблицы: <tr>...</tr>
  const rowRegex = /<tr[^>]*>(.*?)<\\/tr>/gs;
  const cellRegex = /<td[^>]*>(.*?)<\\/td>/gs;
  
  const rows = [...html.matchAll(rowRegex)];
  
  for (const rowMatch of rows) {
    const rowHTML = rowMatch[1];
    const cells = [...rowHTML.matchAll(cellRegex)].map(m => 
      m[1].replace(/<[^>]*>/g, '').trim()
    );
    
    // Пропускаем header и пустые строки
    if (cells.length < 15 || !cells[0] || cells[0].length > 10) continue;
    
    const id = cells[0];
    if (!id || isNaN(id)) continue;
    
    results.push({
      json: {
        branch: branch,
        rentprog_id: parseInt(id),
        car_name: cells[1] || '',
        code: cells[2] || '',
        number: cells[4] || '',
        color: cells[5] || '',
        year: cells[6] ? parseInt(cells[6]) : null,
        price_1_2: cells[7] !== '?' ? parseInt(cells[7]) || 0 : null,
        price_hour: cells[13] ? parseInt(cells[13]) || 0 : 0,
        deposit: cells[14] ? parseInt(cells[14]) || 0 : 0,
        error: false
      }
    });
  }
}

return results;`
      },
      name: 'Parse HTML',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [1040, 400],
      id: 'parse-html-1'
    },
    
    // 6. Save to DB
    {
      parameters: {
        operation: 'executeQuery',
        query: `INSERT INTO cars (
  branch, rentprog_id, car_name, code, number, color, year, price, deposit, is_active
) VALUES (
  $1, $2, $3, $4, $5, $6, $7, $8, $9, true
)
ON CONFLICT (branch, rentprog_id) 
DO UPDATE SET
  car_name = EXCLUDED.car_name,
  code = EXCLUDED.code,
  number = EXCLUDED.number,
  color = EXCLUDED.color,
  year = EXCLUDED.year,
  price = EXCLUDED.price,
  deposit = EXCLUDED.deposit,
  updated_at = NOW()
RETURNING id;`,
        options: {
          queryBatching: 'independently'
        }
      },
      name: 'Save to DB',
      type: 'n8n-nodes-base.postgres',
      typeVersion: 2.4,
      position: [1240, 400],
      credentials: {
        postgres: {
          name: 'Neon PostgreSQL'
        }
      },
      continueOnFail: true,
      id: 'save-db-1'
    },
    
    // 7. Format Result
    {
      parameters: {
        jsCode: `const items = $input.all();
let successCount = 0;
let errorCount = 0;
let byBranch = {};

for (const item of items) {
  const branch = item.json.branch || 'unknown';
  if (!byBranch[branch]) byBranch[branch] = { success: 0, error: 0 };
  
  if (item.json.error) {
    errorCount++;
    byBranch[branch].error++;
  } else {
    successCount++;
    byBranch[branch].success++;
  }
}

let message = '🚗 Парсинг HTML страницы /cars раз в час:\\n\\n';
for (const [branch, stats] of Object.entries(byBranch)) {
  message += \`\${branch.toUpperCase()}: \${stats.success} ✓\`;
  if (stats.error > 0) message += \` / \${stats.error} ✗\`;
  message += '\\n';
}
message += \`\\nВсего: \${successCount} автомобилей\`;
if (errorCount > 0) message += \`\\n🚨 ОШИБОК: \${errorCount}\`;

return [{
  json: {
    message: message,
    success_count: successCount,
    error_count: errorCount
  }
}];`
      },
      name: 'Format Result',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [1440, 400],
      id: 'format-1'
    },
    
    // 8. If Error
    {
      parameters: {
        conditions: {
          options: { caseSensitive: true, typeValidation: 'strict' },
          conditions: [{
            id: 'error-check',
            leftValue: '={{ $json.error_count }}',
            rightValue: 0,
            operator: { type: 'number', operation: 'gt' }
          }],
          combinator: 'and'
        }
      },
      name: 'If Error',
      type: 'n8n-nodes-base.if',
      typeVersion: 2,
      position: [1640, 400],
      id: 'if-error-1'
    },
    
    // 9. Send Alert
    {
      parameters: {
        chatId: '={{ $env.TELEGRAM_ALERT_CHAT_ID }}',
        text: '={{ $json.message }}\\n\\n🔗 <a href="https://n8n.rentflow.rentals/workflow/{{ $workflow.id }}/executions/{{ $execution.id }}">Открыть execution</a>',
        additionalFields: { appendAttribution: false, parse_mode: 'HTML' }
      },
      name: 'Send Alert',
      type: 'n8n-nodes-base.telegram',
      typeVersion: 1.2,
      position: [1840, 320],
      credentials: { telegramApi: { name: 'Telegram Bot (@n8n_alert_geodrive_bot)' }},
      id: 'alert-1'
    },
    
    // 10. Throw Error
    {
      parameters: {
        errorMessage: '=Парсинг завершился с ошибками: {{ $json.error_count }}'
      },
      name: 'Throw Error',
      type: 'n8n-nodes-base.stopAndError',
      typeVersion: 1,
      position: [2040, 320],
      id: 'throw-1'
    },
    
    // 11. Success
    {
      parameters: {},
      name: 'Success',
      type: 'n8n-nodes-base.noOp',
      typeVersion: 1,
      position: [1840, 480],
      id: 'success-1'
    }
  ],
  
  connections: {
    'Every Hour': { main: [[{ node: 'Prepare Branches', type: 'main', index: 0 }]] },
    'Prepare Branches': { main: [[{ node: 'Get Cars Page', type: 'main', index: 0 }]] },
    'Get Cars Page': { main: [[{ node: 'Parse HTML', type: 'main', index: 0 }]] },
    'Parse HTML': { main: [[{ node: 'Save to DB', type: 'main', index: 0 }]] },
    'Save to DB': { main: [[{ node: 'Format Result', type: 'main', index: 0 }]] },
    'Format Result': { main: [[{ node: 'If Error', type: 'main', index: 0 }]] },
    'If Error': {
      main: [
        [{ node: 'Send Alert', type: 'main', index: 0 }],
        [{ node: 'Success', type: 'main', index: 0 }]
      ]
    },
    'Send Alert': { main: [[{ node: 'Throw Error', type: 'main', index: 0 }]] }
  },
  
  settings: { executionOrder: 'v1' }
};

try {
  // Удаляем старые workflows
  console.log('🗑️  Удаляю старые workflows...');
  for (const oldId of ['NmOyyH0lfPPktDrV', 'NcAxHFLxpo2ben1s', 't7zMiBmlhdfEEgBV']) {
    try {
      await fetch(`${N8N_HOST}/workflows/${oldId}`, {
        method: 'DELETE',
        headers: { 'X-N8N-API-KEY': N8N_API_KEY }
      });
      console.log(`   ✅ ${oldId} удален`);
    } catch (e) {
      // ignore
    }
  }
  
  // Создаем новый
  console.log('\n📤 Создаю новый workflow...');
  const response = await fetch(`${N8N_HOST}/workflows`, {
    method: 'POST',
    headers: {
      'X-N8N-API-KEY': N8N_API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(workflow)
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`${response.status}\\n${error}`);
  }
  
  const result = await response.json();
  console.log('\\n✅ ГОТОВО!');
  console.log(`   ID: ${result.id}`);
  console.log(`   URL: https://n8n.rentflow.rentals/workflow/${result.id}`);
  console.log('\\n💡 Workflow парсит HTML таблицу напрямую!');
  console.log('   1. Использует вечные JWT токены (НЕ логинится!)');
  console.log('   2. Получает HTML страницы /cars с Cookie');
  console.log('   3. Парсит таблицу regex');
  console.log('   4. Сохраняет в БД');
  
} catch (error) {
  console.error('\\n❌ Ошибка:', error.message);
  process.exit(1);
}

