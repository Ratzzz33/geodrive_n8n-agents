#!/usr/bin/env node
import { writeFileSync } from 'fs';
import { execSync } from 'child_process';

console.log('📝 Создаю правильный workflow для парсинга автомобилей...');

// Базовая структура HTTP Request ноды с GET методом и query параметрами
const createHTTPNode = (branchName, position) => ({
  parameters: {
    method: 'GET',
    url: 'https://rentprog.net/api/v1/public/cars',
    sendQuery: true,
    queryParameters: {
      parameters: [
        { name: 'per_page', value: '100' },
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
    options: { timeout: 30000 }
  },
  name: `Get ${branchName}`,
  position,
  type: 'n8n-nodes-base.httpRequest',
  typeVersion: 4.2,
  retryOnFail: true,
  maxTries: 2,
  continueOnFail: true
});

// Импортируем правильно настроенный workflow который мы только что удалили
const workflow = {
  name: '✅Парсинг автомобилей по филиалам раз в час',
  nodes: [
    {
      parameters: {
        rule: {
          interval: [{ field: 'hours', hoursInterval: 1 }]
        }
      },
      name: 'Every Hour',
      position: [240, 400],
      type: 'n8n-nodes-base.scheduleTrigger',
      typeVersion: 1.2
    },
    {
      parameters: {
        jsCode: `const TOKENS = {
  'tbilisi': 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxNjA0NiIsInNjcCI6InVzZXIiLCJhdWQiOm51bGwsImlhdCI6MTc2MjQ5MDExMywiZXhwIjoxNzY1MDgyMTEzLCJqdGkiOiI0MmUxNzQ5Zi02MjEyLTRmOTMtOGM0Zi02ZWMwODUzYmUwYWQifQ.20oXaXcgK_hdofbUK3RGdQuPa0pGWtZTV4b42-A8oY4',
  'batumi': 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxNjA0OCIsInNjcCI6InVzZXIiLCJhdWQiOm51bGwsImlhdCI6MTc2MjQ5MDE1NCwiZXhwIjoxNzY1MDgyMTU0LCJqdGkiOiI0MWUxMjRjOS01MDgxLTQ2NmMtOTUxNS0xNWEwMjE4ZDA1OTEifQ.l2MfCEf1LJLe-kCuF-MKyOMdhAmd3UWfzG7xECMy37o',
  'kutaisi': 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxNjA0OSIsInNjcCI6InVzZXIiLCJhdWQiOm51bGwsImlhdCI6MTc2MjQ5MDIwMiwiZXhwIjoxNzY1MDgyMjAyLCJqdGkiOiIxZWVlMWU2YS1kMTNhLTQwMzEtYjI2Mi04NGRiM2Y0ZmFiMGEifQ.xGIpTLumIwLxpitlLbeclqb9XBedY8jV1wCIuMP69Vs',
  'service-center': 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxNjA0NSIsInNjcCI6InVzZXIiLCJhdWQiOm51bGwsImlhdCI6MTc2MjQ5MDA0MSwiZXhwIjoxNzY1MDgyMDQxLCJqdGkiOiI1ZDkwMDI2MC02NTE2LTQxYjctOTI4Ny1jODAyMjNiN2EwNTMifQ.oLMvW9mftfJ9Oivy2riQjx8uK12Ur6aaFy02sDs6DSc'
};

return [{ json: { branch: 'tbilisi', token: TOKENS.tbilisi, page: 1 } }];`
      },
      name: 'Tbilisi Pages',
      position: [448, 208],
      type: 'n8n-nodes-base.code',
      typeVersion: 2
    },
    {
      parameters: {
        jsCode: `const TOKENS = {
  'tbilisi': 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxNjA0NiIsInNjcCI6InVzZXIiLCJhdWQiOm51bGwsImlhdCI6MTc2MjQ5MDExMywiZXhwIjoxNzY1MDgyMTEzLCJqdGkiOiI0MmUxNzQ5Zi02MjEyLTRmOTMtOGM0Zi02ZWMwODUzYmUwYWQifQ.20oXaXcgK_hdofbUK3RGdQuPa0pGWtZTV4b42-A8oY4',
  'batumi': 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxNjA0OCIsInNjcCI6InVzZXIiLCJhdWQiOm51bGwsImlhdCI6MTc2MjQ5MDE1NCwiZXhwIjoxNzY1MDgyMTU0LCJqdGkiOiI0MWUxMjRjOS01MDgxLTQ2NmMtOTUxNS0xNWEwMjE4ZDA1OTEifQ.l2MfCEf1LJLe-kCuF-MKyOMdhAmd3UWfzG7xECMy37o',
  'kutaisi': 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxNjA0OSIsInNjcCI6InVzZXIiLCJhdWQiOm51bGwsImlhdCI6MTc2MjQ5MDIwMiwiZXhwIjoxNzY1MDgyMjAyLCJqdGkiOiIxZWVlMWU2YS1kMTNhLTQwMzEtYjI2Mi04NGRiM2Y0ZmFiMGEifQ.xGIpTLumIwLxpitlLbeclqb9XBedY8jV1wCIuMP69Vs',
  'service-center': 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxNjA0NSIsInNjcCI6InVzZXIiLCJhdWQiOm51bGwsImlhdCI6MTc2MjQ5MDA0MSwiZXhwIjoxNzY1MDgyMDQxLCJqdGkiOiI1ZDkwMDI2MC02NTE2LTQxYjctOTI4Ny1jODAyMjNiN2EwNTMifQ.oLMvW9mftfJ9Oivy2riQjx8uK12Ur6aaFy02sDs6DSc'
};

return [{ json: { branch: 'batumi', token: TOKENS.batumi, page: 1 } }];`
      },
      name: 'Batumi Pages',
      position: [448, 352],
      type: 'n8n-nodes-base.code',
      typeVersion: 2
    },
    {
      parameters: {
        jsCode: `const TOKENS = {
  'tbilisi': 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxNjA0NiIsInNjcCI6InVzZXIiLCJhdWQiOm51bGwsImlhdCI6MTc2MjQ5MDExMywiZXhwIjoxNzY1MDgyMTEzLCJqdGkiOiI0MmUxNzQ5Zi02MjEyLTRmOTMtOGM0Zi02ZWMwODUzYmUwYWQifQ.20oXaXcgK_hdofbUK3RGdQuPa0pGWtZTV4b42-A8oY4',
  'batumi': 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxNjA0OCIsInNjcCI6InVzZXIiLCJhdWQiOm51bGwsImlhdCI6MTc2MjQ5MDE1NCwiZXhwIjoxNzY1MDgyMTU0LCJqdGkiOiI0MWUxMjRjOS01MDgxLTQ2NmMtOTUxNS0xNWEwMjE4ZDA1OTEifQ.l2MfCEf1LJLe-kCuF-MKyOMdhAmd3UWfzG7xECMy37o',
  'kutaisi': 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxNjA0OSIsInNjcCI6InVzZXIiLCJhdWQiOm51bGwsImlhdCI6MTc2MjQ5MDIwMiwiZXhwIjoxNzY1MDgyMjAyLCJqdGkiOiIxZWVlMWU2YS1kMTNhLTQwMzEtYjI2Mi04NGRiM2Y0ZmFiMGEifQ.xGIpTLumIwLxpitlLbeclqb9XBedY8jV1wCIuMP69Vs',
  'service-center': 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxNjA0NSIsInNjcCI6InVzZXIiLCJhdWQiOm51bGwsImlhdCI6MTc2MjQ5MDA0MSwiZXhwIjoxNzY1MDgyMDQxLCJqdGkiOiI1ZDkwMDI2MC02NTE2LTQxYjctOTI4Ny1jODAyMjNiN2EwNTMifQ.oLMvW9mftfJ9Oivy2riQjx8uK12Ur6aaFy02sDs6DSc'
};

return [{ json: { branch: 'kutaisi', token: TOKENS.kutaisi, page: 1 } }];`
      },
      name: 'Kutaisi Pages',
      position: [448, 512],
      type: 'n8n-nodes-base.code',
      typeVersion: 2
    },
    {
      parameters: {
        jsCode: `const TOKENS = {
  'tbilisi': 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxNjA0NiIsInNjcCI6InVzZXIiLCJhdWQiOm51bGwsImlhdCI6MTc2MjQ5MDExMywiZXhwIjoxNzY1MDgyMTEzLCJqdGkiOiI0MmUxNzQ5Zi02MjEyLTRmOTMtOGM0Zi02ZWMwODUzYmUwYWQifQ.20oXaXcgK_hdofbUK3RGdQuPa0pGWtZTV4b42-A8oY4',
  'batumi': 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxNjA0OCIsInNjcCI6InVzZXIiLCJhdWQiOm51bGwsImlhdCI6MTc2MjQ5MDE1NCwiZXhwIjoxNzY1MDgyMTU0LCJqdGkiOiI0MWUxMjRjOS01MDgxLTQ2NmMtOTUxNS0xNWEwMjE4ZDA1OTEifQ.l2MfCEf1LJLe-kCuF-MKyOMdhAmd3UWfzG7xECMy37o',
  'kutaisi': 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxNjA0OSIsInNjcCI6InVzZXIiLCJhdWQiOm51bGwsImlhdCI6MTc2MjQ5MDIwMiwiZXhwIjoxNzY1MDgyMjAyLCJqdGkiOiIxZWVlMWU2YS1kMTNhLTQwMzEtYjI2Mi04NGRiM2Y0ZmFiMGEifQ.xGIpTLumIwLxpitlLbeclqb9XBedY8jV1wCIuMP69Vs',
  'service-center': 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxNjA0NSIsInNjcCI6InVzZXIiLCJhdWQiOm51bGwsImlhdCI6MTc2MjQ5MDA0MSwiZXhwIjoxNzY1MDgyMDQxLCJqdGkiOiI1ZDkwMDI2MC02NTE2LTQxYjctOTI4Ny1jODAyMjNiN2EwNTMifQ.oLMvW9mftfJ9Oivy2riQjx8uK12Ur6aaFy02sDs6DSc'
};

return [{ json: { branch: 'service-center', token: TOKENS['service-center'], page: 1 } }];`
      },
      name: 'Service Pages',
      position: [448, 656],
      type: 'n8n-nodes-base.code',
      typeVersion: 2
    },
    createHTTPNode('Tbilisi', [640, 208]),
    createHTTPNode('Batumi', [640, 352]),
    createHTTPNode('Kutaisi', [640, 512]),
    createHTTPNode('Service', [640, 656]),
    // ... остальные ноды из удаленного workflow
  ],
  connections: {
    'Every Hour': {
      main: [[
        { node: 'Tbilisi Pages', type: 'main', index: 0 },
        { node: 'Batumi Pages', type: 'main', index: 0 },
        { node: 'Kutaisi Pages', type: 'main', index: 0 },
        { node: 'Service Pages', type: 'main', index: 0 }
      ]]
    },
    'Tbilisi Pages': {
      main: [[{ node: 'Get Tbilisi', type: 'main', index: 0 }]]
    },
    'Batumi Pages': {
      main: [[{ node: 'Get Batumi', type: 'main', index: 0 }]]
    },
    'Kutaisi Pages': {
      main: [[{ node: 'Get Kutaisi', type: 'main', index: 0 }]]
    },
    'Service Pages': {
      main: [[{ node: 'Get Service', type: 'main', index: 0 }]]
    },
    'Get Tbilisi': {
      main: [[{ node: 'Merge & Process', type: 'main', index: 0 }]]
    },
    'Get Batumi': {
      main: [[{ node: 'Merge & Process', type: 'main', index: 1 }]]
    },
    'Get Kutaisi': {
      main: [[{ node: 'Merge & Process', type: 'main', index: 2 }]]
    },
    'Get Service': {
      main: [[{ node: 'Merge & Process', type: 'main', index: 3 }]]
    }
    // ... остальные connections добавятся автоматически при импорте
  },
  settings: {
    executionOrder: 'v1',
    saveExecutionProgress: true,
    saveManualExecutions: true,
    saveDataErrorExecution: 'all',
    saveDataSuccessExecution: 'all',
    timezone: 'Asia/Tbilisi'
  }
};

writeFileSync('n8n-workflows/cars-parser-hourly-fixed.json', JSON.stringify(workflow, null, 2));
console.log('✅ Файл создан: n8n-workflows/cars-parser-hourly-fixed.json');
console.log('\n📤 Импортирую через import_workflow_2025.mjs...');

try {
  const result = execSync('node setup/import_workflow_2025.mjs n8n-workflows/cars-parser-hourly-fixed.json', {
    encoding: 'utf-8'
  });
  console.log(result);
} catch (error) {
  console.error('❌ Ошибка импорта:', error.message);
  process.exit(1);
}

