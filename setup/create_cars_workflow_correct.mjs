#!/usr/bin/env node
import fetch from 'node-fetch';

const N8N_HOST = 'https://n8n.rentflow.rentals/api/v1';
const N8N_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI';

console.log('🚀 Создаю workflow для парсинга автомобилей (правильный способ)...\n');

// Company tokens для двухэтапной авторизации
const COMPANY_TOKENS = {
  'tbilisi': '91b83b93963633649f29a04b612bab3f9fbb0471b5928622',
  'batumi': '7ad345720f8d92f10c187122427c6a2c2bb9494c6bf14e8d',
  'kutaisi': '5599ebb7b94827fdfd49ca3a5b7e259cfa99d8ea78edeb50',
  'service-center': '5y4j4gcs75o9n5s1e2vrxx4a'
};

const workflow = {
  name: '✅ Парсинг автомобилей по филиалам раз в час',
  nodes: [
    // 1. Schedule Trigger - каждый час
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
      id: 'schedule-trigger-1'
    },
    
    // 2. Get Request Tokens - получаем токены для всех филиалов
    {
      parameters: {
        jsCode: `const BASE_URL = 'https://rentprog.net/api/v1/public';

const COMPANY_TOKENS = {
  'tbilisi': '${COMPANY_TOKENS.tbilisi}',
  'batumi': '${COMPANY_TOKENS.batumi}',
  'kutaisi': '${COMPANY_TOKENS.kutaisi}',
  'service-center': '${COMPANY_TOKENS['service-center']}'
};

const BRANCHES = ['tbilisi', 'batumi', 'kutaisi', 'service-center'];

// Получаем request_token для каждого филиала
const results = [];

for (const branch of BRANCHES) {
  try {
    const response = await fetch(\`\${BASE_URL}/get_token?company_token=\${COMPANY_TOKENS[branch]}\`, {
      method: 'GET'
    });
    
    if (!response.ok) {
      throw new Error(\`\${response.status} \${response.statusText}\`);
    }
    
    const data = await response.json();
    const token = data.token || data.request_token;
    
    if (!token) {
      throw new Error('Token not found in response');
    }
    
    results.push({
      json: {
        branch: branch,
        token: token,
        exp: data.exp,
        page: 0
      }
    });
    
  } catch (error) {
    results.push({
      json: {
        branch: branch,
        error: true,
        error_message: error.message
      }
    });
  }
}

return results;`
      },
      name: 'Get Request Tokens',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [440, 400],
      id: 'get-tokens-1'
    },
    
    // 3. HTTP Request - получаем автомобили для каждого филиала
    {
      parameters: {
        method: 'GET',
        url: '=https://rentprog.net/api/v1/public/all_cars_full',
        sendQuery: true,
        queryParameters: {
          parameters: [
            { name: 'limit', value: '100' },
            { name: 'page', value: '={{ $json.page }}' }
          ]
        },
        sendHeaders: true,
        headerParameters: {
          parameters: [
            { name: 'Authorization', value: '=Bearer {{ $json.token }}' },
            { name: 'Accept', value: 'application/json' },
            { name: 'Origin', value: 'https://web.rentprog.ru' },
            { name: 'Referer', value: 'https://web.rentprog.ru/' },
            { name: 'User-Agent', value: 'Mozilla/5.0' }
          ]
        },
        options: {
          timeout: 30000
        }
      },
      name: 'Get Cars',
      type: 'n8n-nodes-base.httpRequest',
      typeVersion: 4.2,
      position: [640, 400],
      retryOnFail: true,
      maxTries: 2,
      continueOnFail: true,
      id: 'http-get-cars-1'
    },
    
    // 4. Process All Cars - обработка данных
    {
      parameters: {
        jsCode: `const results = [];

for (const item of $input.all()) {
  const branch = item.json.branch;
  
  // Проверяем ошибки HTTP запроса
  if (item.json.error) {
    results.push({
      json: {
        branch: branch,
        error: true,
        error_message: item.json.error_message || 'HTTP request failed'
      }
    });
    continue;
  }
  
  // Получаем массив автомобилей
  const carsData = Array.isArray(item.json) ? item.json : (item.json.data || []);
  
  if (carsData.length === 0) {
    results.push({
      json: {
        branch: branch,
        error: false,
        processed: 0
      }
    });
    continue;
  }
  
  // Обрабатываем каждый автомобиль
  for (const car of carsData) {
    results.push({
      json: {
        branch: branch,
        rentprog_id: car.id,
        car_name: car.car_name || car.name,
        code: car.code,
        number: car.number,
        vin: car.vin,
        body_number: car.body_number,
        pts: car.pts,
        registration_certificate: car.registration_certificate,
        year: car.year,
        color: car.color,
        transmission: car.transmission,
        is_air: car.is_air || false,
        engine_capacity: car.engine_capacity,
        is_active: car.active !== false,
        location: car.location,
        mileage: car.mileage || 0,
        avatar_url: car.avatar_url,
        price: car.price || 0,
        deposit: car.deposit || 0,
        data: car,
        error: false
      }
    });
  }
}

return results;`
      },
      name: 'Process All Cars',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [840, 400],
      id: 'process-cars-1'
    },
    
    // 5. Postgres - сохранение в БД
    {
      parameters: {
        operation: 'executeQuery',
        query: `INSERT INTO cars (
  branch, rentprog_id, car_name, code, number, vin, body_number,
  pts, registration_certificate, year, color, transmission,
  is_air, engine_capacity, is_active, location, mileage,
  avatar_url, price, deposit, data
) VALUES (
  $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21::jsonb
)
ON CONFLICT (branch, rentprog_id) 
DO UPDATE SET
  car_name = EXCLUDED.car_name,
  code = EXCLUDED.code,
  number = EXCLUDED.number,
  vin = EXCLUDED.vin,
  body_number = EXCLUDED.body_number,
  pts = EXCLUDED.pts,
  registration_certificate = EXCLUDED.registration_certificate,
  year = EXCLUDED.year,
  color = EXCLUDED.color,
  transmission = EXCLUDED.transmission,
  is_air = EXCLUDED.is_air,
  engine_capacity = EXCLUDED.engine_capacity,
  is_active = EXCLUDED.is_active,
  location = EXCLUDED.location,
  mileage = EXCLUDED.mileage,
  avatar_url = EXCLUDED.avatar_url,
  price = EXCLUDED.price,
  deposit = EXCLUDED.deposit,
  data = EXCLUDED.data,
  updated_at = NOW()
RETURNING id;`,
        options: {
          queryBatching: 'independently',
          nodeVersion: 2.4
        }
      },
      name: 'Save to DB',
      type: 'n8n-nodes-base.postgres',
      typeVersion: 2.4,
      position: [1040, 400],
      credentials: {
        postgres: {
          name: 'Neon PostgreSQL'
        }
      },
      executeOnce: false,
      continueOnFail: true,
      id: 'postgres-save-1'
    },
    
    // 6. Format Result - подготовка отчета
    {
      parameters: {
        jsCode: `const items = $input.all();

let successCount = 0;
let errorCount = 0;
let byBranch = {};

for (const item of items) {
  const branch = item.json.branch || 'unknown';
  
  if (!byBranch[branch]) {
    byBranch[branch] = { success: 0, error: 0 };
  }
  
  if (item.json.error) {
    errorCount++;
    byBranch[branch].error++;
  } else {
    successCount++;
    byBranch[branch].success++;
  }
}

let message = '🚗 Парсинг автомобилей по филиалам раз в час:\\n\\n';

for (const [branch, stats] of Object.entries(byBranch)) {
  message += \`\${branch.toUpperCase()}: \${stats.success} ✓\`;
  if (stats.error > 0) {
    message += \` / \${stats.error} ✗\`;
  }
  message += '\\n';
}

message += \`\\nВсего: \${successCount} автомобилей сохранено\`;

if (errorCount > 0) {
  message += \`\\n\\n🚨 ОШИБОК: \${errorCount}\`;
}

return [{
  json: {
    message: message,
    success_count: successCount,
    error_count: errorCount,
    by_branch: byBranch
  }
}];`
      },
      name: 'Format Result',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [1240, 400],
      id: 'format-result-1'
    },
    
    // 7. If Error - проверка наличия ошибок
    {
      parameters: {
        conditions: {
          options: {
            caseSensitive: true,
            typeValidation: 'strict'
          },
          conditions: [
            {
              id: 'check-error-count',
              leftValue: '={{ $json.error_count }}',
              rightValue: 0,
              operator: {
                type: 'number',
                operation: 'gt'
              }
            }
          ],
          combinator: 'and'
        }
      },
      name: 'If Error',
      type: 'n8n-nodes-base.if',
      typeVersion: 2,
      position: [1440, 400],
      id: 'if-error-1'
    },
    
    // 8. Send Alert - отправка уведомления при ошибках
    {
      parameters: {
        chatId: '={{ $env.TELEGRAM_ALERT_CHAT_ID }}',
        text: '={{ $json.message }}\\n\\n🔗 <a href="https://n8n.rentflow.rentals/workflow/{{ $workflow.id }}/executions/{{ $execution.id }}">Открыть execution</a>',
        additionalFields: {
          appendAttribution: false,
          parse_mode: 'HTML'
        }
      },
      name: 'Send Alert',
      type: 'n8n-nodes-base.telegram',
      typeVersion: 1.2,
      position: [1640, 320],
      credentials: {
        telegramApi: {
          name: 'Telegram Bot (@n8n_alert_geodrive_bot)'
        }
      },
      id: 'telegram-alert-1'
    },
    
    // 9. Throw Error - помечаем execution как failed
    {
      parameters: {
        errorMessage: '=Парсинг автомобилей завершился с ошибками: {{ $json.error_count }}'
      },
      name: 'Throw Error',
      type: 'n8n-nodes-base.stopAndError',
      typeVersion: 1,
      position: [1840, 320],
      id: 'throw-error-1'
    },
    
    // 10. Success - визуальная индикация успешного завершения
    {
      parameters: {},
      name: 'Success',
      type: 'n8n-nodes-base.noOp',
      typeVersion: 1,
      position: [1640, 480],
      id: 'success-1'
    }
  ],
  
  connections: {
    'Every Hour': {
      main: [[{ node: 'Get Request Tokens', type: 'main', index: 0 }]]
    },
    'Get Request Tokens': {
      main: [[{ node: 'Get Cars', type: 'main', index: 0 }]]
    },
    'Get Cars': {
      main: [[{ node: 'Process All Cars', type: 'main', index: 0 }]]
    },
    'Process All Cars': {
      main: [[{ node: 'Save to DB', type: 'main', index: 0 }]]
    },
    'Save to DB': {
      main: [[{ node: 'Format Result', type: 'main', index: 0 }]]
    },
    'Format Result': {
      main: [[{ node: 'If Error', type: 'main', index: 0 }]]
    },
    'If Error': {
      main: [
        [{ node: 'Send Alert', type: 'main', index: 0 }],  // true (ошибка)
        [{ node: 'Success', type: 'main', index: 0 }]      // false (успех)
      ]
    },
    'Send Alert': {
      main: [[{ node: 'Throw Error', type: 'main', index: 0 }]]
    }
  },
  
  settings: {
    executionOrder: 'v1'
  }
};

console.log('📦 Структура workflow создана');
console.log(`   Нод: ${workflow.nodes.length}`);

try {
  // Удаляем старый workflow если есть
  console.log('\n🗑️  Удаляю старый workflow EV1kz456g6f9tc5P...');
  
  try {
    await fetch(`${N8N_HOST}/workflows/EV1kz456g6f9tc5P`, {
      method: 'DELETE',
      headers: { 'X-N8N-API-KEY': N8N_API_KEY }
    });
    console.log('   ✅ Старый workflow удален');
  } catch (e) {
    console.log('   ⚠️  Старый workflow не найден или уже удален');
  }
  
  // Создаем новый workflow
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
    const errorText = await response.text();
    throw new Error(`${response.status} ${response.statusText}\\n${errorText}`);
  }
  
  const result = await response.json();
  const newId = result.id;
  
  console.log('\\n✅ УСПЕХ!');
  console.log(`   ID: ${newId}`);
  console.log(`   URL: https://n8n.rentflow.rentals/workflow/${newId}`);
  console.log('\\n💡 Следующие шаги:');
  console.log('   1. Откройте workflow в браузере');
  console.log('   2. Нажмите "Test workflow" для проверки');
  console.log('   3. Активируйте workflow (переключатель Active)');
  
} catch (error) {
  console.error('\\n❌ Ошибка:', error.message);
  process.exit(1);
}

