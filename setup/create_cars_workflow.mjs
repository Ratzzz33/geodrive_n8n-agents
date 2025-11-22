#!/usr/bin/env node
import { writeFileSync } from 'fs';

const N8N_HOST = 'https://n8n.rentflow.rentals/api/v1';
const N8N_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI';

// Создаем новый workflow для парсинга автомобилей
const carsWorkflow = {
  name: '🚗 Парсинг автомобилей RentProg через API раз в час',
  nodes: [],
  connections: {},
  settings: {
    executionOrder: 'v1'
  }
};

// Schedule Trigger - каждые 3 часа
carsWorkflow.nodes.push({
  parameters: {
    rule: {
      interval: [{
        field: 'hours',
        hoursInterval: 3
      }]
    }
  },
  name: 'Every 3 Hours',
  type: 'n8n-nodes-base.scheduleTrigger',
  typeVersion: 1.2,
  position: [240, 400]
});

// HTTP Request ноды для каждого филиала (только активные авто)
const branches = [
  { name: 'Tbilisi', token: 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxNjA0NiIsInNjcCI6InVzZXIiLCJhdWQiOm51bGwsImlhdCI6MTc2MjQ1OTY2MCwiZXhwIjoxNzY1MDUxNjYwLCJqdGkiOiIxOTFjMDY4ZS1jOGNhLTQ4OWEtODk0OS1iMjJkMmUzODE2ZDIifQ.G4_I4D96Flv4rP3JwjwDPpEHaH6ShSb0YRRQG8PasXk' },
  { name: 'Batumi', token: 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxNjA0OCIsInNjcCI6InVzZXIiLCJhdWQiOm51bGwsImlhdCI6MTc2MjQ2MDAyNSwiZXhwIjoxNzY1MDUyMDI1LCJqdGkiOiI0ZmQ2ODE4Yy0zYWNiLTRmZmQtOGZmYS0wZWMwZDkyMmIyMzgifQ.16s2ruRb3x_S7bgy4zF7TW9dSQ3ITqX3kei8recyH_8' },
  { name: 'Kutaisi', token: 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxNjA0OSIsInNjcCI6InVzZXIiLCJhdWQiOm51bGwsImlhdCI6MTc2MjQ2MDE3MiwiZXhwIjoxNzY1MDUyMTcyLCJqdGkiOiJmNzE1NGQ3MC0zZWFmLTRiNzItYTI3Ni0yZTg3MmQ4YjA0YmQifQ.1vd1kNbWB_qassLVqoxgyRsRJwtPsl7OR28gVsCxmwY' },
  { name: 'Service', token: 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxNjA0NSIsInNjcCI6InVzZXIiLCJhdWQiOm51bGwsImlhdCI6MTc2MjQ1OTM4MSwiZXhwIjoxNzY1MDUxMzgxLCJqdGkiOiI4ZDdkYjYyNi1jNWJiLTQ0MWMtYTNlMy00YjQwOWFmODQ1NmUifQ.32BRzttLFFgOgMv-VusAXK8mmyvrk4X-pb_rHQHSFbw' }
];

branches.forEach((branch, index) => {
  carsWorkflow.nodes.push({
    parameters: {
      method: 'GET',
      url: '=https://rentprog.net/api/v1/all_cars_full?limit=100&page=0',
      sendHeaders: true,
      headerParameters: {
        parameters: [
          { name: 'Authorization', value: `Bearer ${branch.token}` },
          { name: 'Accept', value: 'application/json' },
          { name: 'Origin', value: 'https://web.rentprog.ru' },
          { name: 'Referer', value: 'https://web.rentprog.ru/' }
        ]
      },
      options: { timeout: 60000 }
    },
    name: `Get ${branch.name} Cars`,
    type: 'n8n-nodes-base.httpRequest',
    typeVersion: 4.2,
    position: [480, 200 + (index * 150)],
    retryOnFail: true,
    maxTries: 2,
    continueOnFail: true
  });
});

// Merge All Branches
carsWorkflow.nodes.push({
  parameters: {
    numberInputs: 4
  },
  name: 'Merge All Branches',
  type: 'n8n-nodes-base.merge',
  typeVersion: 3,
  position: [720, 400]
});

// Process All Cars (Code node)
carsWorkflow.nodes.push({
  parameters: {
    jsCode: `// Обрабатываем все автомобили со всех филиалов
let allItems = [];
for (let i = 0; i < 4; i++) {
  try {
    const items = $input.all(i);
    if (items && items.length > 0) {
      allItems = allItems.concat(items);
    }
  } catch (e) {
    // Если входа нет, пропускаем
  }
}
console.log('Total input items:', allItems.length);

// Маппинг индексов на филиалы
const branchMapping = [
  { branch: 'tbilisi' },
  { branch: 'batumi' },
  { branch: 'kutaisi' },
  { branch: 'service-center' }
];

const results = [];

allItems.forEach((item, index) => {
  const json = item.json;
  const mapping = branchMapping[index] || { branch: 'unknown' };
  
  // Проверяем наличие ошибок в HTTP запросе
  if (json.error) {
    console.error(\`Error in item \${index}:\`, json.error);
    results.push({
      json: {
        branch: mapping.branch,
        error: true,
        error_message: json.error || 'Unknown error'
      }
    });
    return;
  }
  
  // RentProg API /all_cars_full возвращает массив напрямую
  const carsData = Array.isArray(json) ? json : (json.data || json.cars?.data || []);
  
  if (carsData.length === 0) {
    return;
  }
  
  // Парсим каждый автомобиль
  carsData.forEach(car => {
    const attrs = car;
    
    results.push({
      json: {
        branch: mapping.branch,
        rentprog_id: attrs.id,
        
        // Основная информация
        model: attrs.model,
        code: attrs.code,
        plate: attrs.plate,
        vin: attrs.vin,
        
        // Характеристики
        year: attrs.year,
        color: attrs.color,
        body_type: attrs.body_type,
        fuel_type: attrs.fuel_type,
        transmission: attrs.transmission,
        
        // Статусы
        status: attrs.status,
        is_active: attrs.active,
        can_rent: attrs.can_rent,
        
        // Пробег и состояние
        mileage: attrs.mileage,
        
        // Финансы
        price_per_day: attrs.price,
        deposit: attrs.deposit,
        
        // Локация
        location: attrs.location,
        
        // Все остальное в data
        data: attrs,
        
        // Без ошибок
        error: false
      }
    });
  });
});

console.log(\`Total results: \${results.length}\`);

return results;`
  },
  name: 'Process All Cars',
  type: 'n8n-nodes-base.code',
  typeVersion: 2,
  position: [864, 400]
});

// Save to DB (Postgres node)
carsWorkflow.nodes.push({
  parameters: {
    operation: 'upsert',
    schema: { __rl: true, mode: 'list', value: 'public' },
    table: { __rl: true, mode: 'list', value: 'cars' },
    columns: {
      mappingMode: 'autoMapInputData',
      matchingColumns: ['branch', 'rentprog_id'],
      schema: []
    },
    options: {}
  },
  name: 'Save to DB',
  type: 'n8n-nodes-base.postgres',
  typeVersion: 2.5,
  position: [1040, 400],
  credentials: {
    postgres: {
      id: '3I9fyXVlGg4Vl4LZ',
      name: 'Postgres account'
    }
  }
});

// Format Result
carsWorkflow.nodes.push({
  parameters: {
    jsCode: `// Форматирование результата
const items = $input.all();

const successCount = items.filter(item => !item.json.error).length;
const errorCount = items.filter(item => item.json.error).length;

let message = '🚗 Парсинг автомобилей RentProg завершён\\n\\n';
message += \`✅ Успешно: \${successCount}\\n\`;

if (errorCount > 0) {
  message += \`❌ Ошибок: \${errorCount}\\n\`;
}

message += \`\\n📈 Всего обработано: \${items.length} items\`;

return [{
  json: {
    success: errorCount === 0,
    message: message,
    total_items: items.length,
    success_count: successCount,
    error_count: errorCount
  }
}];`
  },
  name: 'Format Result',
  type: 'n8n-nodes-base.code',
  typeVersion: 2,
  position: [1216, 400]
});

// If Error
carsWorkflow.nodes.push({
  parameters: {
    conditions: {
      options: {
        caseSensitive: true,
        typeValidation: 'strict',
        version: 1
      },
      conditions: [{
        id: 'check-errors',
        leftValue: '={{ $json.error_count }}',
        rightValue: 0,
        operator: { type: 'number', operation: 'gt' }
      }],
      combinator: 'and'
    },
    options: {}
  },
  name: 'If Error',
  type: 'n8n-nodes-base.if',
  typeVersion: 2,
  position: [1392, 400]
});

// Send Alert (Telegram)
carsWorkflow.nodes.push({
  parameters: {
    chatId: '=-1003484642420',
    text: '={{ $json.message + "\\n\\n🔗 <a href=\\"https://n8n.rentflow.rentals/workflow/" + $workflow.id + "/executions/" + $execution.id + "\\">Открыть execution</a>" }}',
    additionalFields: {
      appendAttribution: false,
      parse_mode: 'HTML'
    }
  },
  name: 'Send Alert',
  type: 'n8n-nodes-base.telegram',
  typeVersion: 1.2,
  position: [1568, 320],
  credentials: {
    telegramApi: {
      id: '1tKryXxL5Gq395nN',
      name: 'Telegram account'
    }
  }
});

// Throw Error
carsWorkflow.nodes.push({
  parameters: {
    jsCode: `// Выбрасываем ошибку чтобы execution был помечен как failed
const errorData = $input.first().json;
const errorMessage = errorData.message || 'Ошибка при парсинге автомобилей RentProg';

console.error('❌ Workflow failed:', errorMessage);

throw new Error(errorMessage);`
  },
  name: 'Throw Error',
  type: 'n8n-nodes-base.code',
  typeVersion: 2,
  position: [1744, 320]
});

// Success
carsWorkflow.nodes.push({
  parameters: {},
  name: 'Success',
  type: 'n8n-nodes-base.noOp',
  typeVersion: 1,
  position: [1568, 480]
});

// Connections
carsWorkflow.connections = {
  'Every 3 Hours': {
    main: [[
      { node: 'Get Tbilisi Cars', type: 'main', index: 0 },
      { node: 'Get Batumi Cars', type: 'main', index: 0 },
      { node: 'Get Kutaisi Cars', type: 'main', index: 0 },
      { node: 'Get Service Cars', type: 'main', index: 0 }
    ]]
  },
  'Get Tbilisi Cars': {
    main: [[{ node: 'Merge All Branches', type: 'main', index: 0 }]]
  },
  'Get Batumi Cars': {
    main: [[{ node: 'Merge All Branches', type: 'main', index: 1 }]]
  },
  'Get Kutaisi Cars': {
    main: [[{ node: 'Merge All Branches', type: 'main', index: 2 }]]
  },
  'Get Service Cars': {
    main: [[{ node: 'Merge All Branches', type: 'main', index: 3 }]]
  },
  'Merge All Branches': {
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
      [{ node: 'Send Alert', type: 'main', index: 0 }],
      [{ node: 'Success', type: 'main', index: 0 }]
    ]
  },
  'Send Alert': {
    main: [[{ node: 'Throw Error', type: 'main', index: 0 }]]
  }
};

// Сохраняем в файл
writeFileSync('n8n-workflows/cars-parser.json', JSON.stringify(carsWorkflow, null, 2));
console.log('✅ Workflow для парсинга автомобилей создан: n8n-workflows/cars-parser.json');

// Импортируем в n8n через API
try {
  const response = await fetch(`${N8N_HOST}/workflows`, {
    method: 'POST',
    headers: {
      'X-N8N-API-KEY': N8N_API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(carsWorkflow)
  });
  
  const result = await response.json();
  
  if (result.id) {
    console.log('✅ Workflow импортирован в n8n!');
    console.log(`📊 ID: ${result.id}`);
    console.log(`🔗 URL: https://n8n.rentflow.rentals/workflow/${result.id}`);
  } else {
    console.error('❌ Ошибка импорта:', JSON.stringify(result, null, 2));
  }
} catch (error) {
  console.error('❌ Ошибка:', error.message);
}

