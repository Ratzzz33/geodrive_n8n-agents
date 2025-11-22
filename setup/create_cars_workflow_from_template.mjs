#!/usr/bin/env node
import { writeFileSync } from 'fs';

// Исходный workflow
const template = {
  "name": "✅Парсинг автомобилей по филиалам раз в час",
  "nodes": [
    {
      "parameters": {
        "rule": {
          "interval": [{
            "field": "hours",
            "hoursInterval": 1
          }]
        }
      },
      "id": "trigger",
      "name": "Every Hour",
      "position": [240, 400],
      "type": "n8n-nodes-base.scheduleTrigger",
      "typeVersion": 1.2
    },
    {
      "parameters": {
        "jsCode": `const TOKENS = {
  'tbilisi': 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxNjA0NiIsInNjcCI6InVzZXIiLCJhdWQiOm51bGwsImlhdCI6MTc2MjQ5MDExMywiZXhwIjoxNzY1MDgyMTEzLCJqdGkiOiI0MmUxNzQ5Zi02MjEyLTRmOTMtOGM0Zi02ZWMwODUzYmUwYWQifQ.20oXaXcgK_hdofbUK3RGdQuPa0pGWtZTV4b42-A8oY4',
  'batumi': 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxNjA0OCIsInNjcCI6InVzZXIiLCJhdWQiOm51bGwsImlhdCI6MTc2MjQ5MDE1NCwiZXhwIjoxNzY1MDgyMTU0LCJqdGkiOiI0MWUxMjRjOS01MDgxLTQ2NmMtOTUxNS0xNWEwMjE4ZDA1OTEifQ.l2MfCEf1LJLe-kCuF-MKyOMdhAmd3UWfzG7xECMy37o',
  'kutaisi': 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxNjA0OSIsInNjcCI6InVzZXIiLCJhdWQiOm51bGwsImlhdCI6MTc2MjQ5MDIwMiwiZXhwIjoxNzY1MDgyMjAyLCJqdGkiOiIxZWVlMWU2YS1kMTNhLTQwMzEtYjI2Mi04NGRiM2Y0ZmFiMGEifQ.xGIpTLumIwLxpitlLbeclqb9XBedY8jV1wCIuMP69Vs',
  'service-center': 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxNjA0NSIsInNjcCI6InVzZXIiLCJhdWQiOm51bGwsImlhdCI6MTc2MjQ5MDA0MSwiZXhwIjoxNzY1MDgyMDQxLCJqdGkiOiI1ZDkwMDI2MC02NTE2LTQxYjctOTI4Ny1jODAyMjNiN2EwNTMifQ.oLMvW9mftfJ9Oivy2riQjx8uK12Ur6aaFy02sDs6DSc'
};

return [{ json: { branch: 'tbilisi', token: TOKENS.tbilisi, page: 1 } }];`
      },
      "id": "prep-tbilisi",
      "name": "Tbilisi Pages",
      "position": [448, 208],
      "type": "n8n-nodes-base.code",
      "typeVersion": 2
    },
    {
      "parameters": {
        "jsCode": `const TOKENS = {
  'tbilisi': 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxNjA0NiIsInNjcCI6InVzZXIiLCJhdWQiOm51bGwsImlhdCI6MTc2MjQ5MDExMywiZXhwIjoxNzY1MDgyMTEzLCJqdGkiOiI0MmUxNzQ5Zi02MjEyLTRmOTMtOGM0Zi02ZWMwODUzYmUwYWQifQ.20oXaXcgK_hdofbUK3RGdQuPa0pGWtZTV4b42-A8oY4',
  'batumi': 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxNjA0OCIsInNjcCI6InVzZXIiLCJhdWQiOm51bGwsImlhdCI6MTc2MjQ5MDE1NCwiZXhwIjoxNzY1MDgyMTU0LCJqdGkiOiI0MWUxMjRjOS01MDgxLTQ2NmMtOTUxNS0xNWEwMjE4ZDA1OTEifQ.l2MfCEf1LJLe-kCuF-MKyOMdhAmd3UWfzG7xECMy37o',
  'kutaisi': 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxNjA0OSIsInNjcCI6InVzZXIiLCJhdWQiOm51bGwsImlhdCI6MTc2MjQ5MDIwMiwiZXhwIjoxNzY1MDgyMjAyLCJqdGkiOiIxZWVlMWU2YS1kMTNhLTQwMzEtYjI2Mi04NGRiM2Y0ZmFiMGEifQ.xGIpTLumIwLxpitlLbeclqb9XBedY8jV1wCIuMP69Vs',
  'service-center': 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxNjA0NSIsInNjcCI6InVzZXIiLCJhdWQiOm51bGwsImlhdCI6MTc2MjQ5MDA0MSwiZXhwIjoxNzY1MDgyMDQxLCJqdGkiOiI1ZDkwMDI2MC02NTE2LTQxYjctOTI4Ny1jODAyMjNiN2EwNTMifQ.oLMvW9mftfJ9Oivy2riQjx8uK12Ur6aaFy02sDs6DSc'
};

return [{ json: { branch: 'batumi', token: TOKENS.batumi, page: 1 } }];`
      },
      "id": "prep-batumi",
      "name": "Batumi Pages",
      "position": [448, 352],
      "type": "n8n-nodes-base.code",
      "typeVersion": 2
    },
    {
      "parameters": {
        "jsCode": `const TOKENS = {
  'tbilisi': 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxNjA0NiIsInNjcCI6InVzZXIiLCJhdWQiOm51bGwsImlhdCI6MTc2MjQ5MDExMywiZXhwIjoxNzY1MDgyMTEzLCJqdGkiOiI0MmUxNzQ5Zi02MjEyLTRmOTMtOGM0Zi02ZWMwODUzYmUwYWQifQ.20oXaXcgK_hdofbUK3RGdQuPa0pGWtZTV4b42-A8oY4',
  'batumi': 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxNjA0OCIsInNjcCI6InVzZXIiLCJhdWQiOm51bGwsImlhdCI6MTc2MjQ5MDE1NCwiZXhwIjoxNzY1MDgyMTU0LCJqdGkiOiI0MWUxMjRjOS01MDgxLTQ2NmMtOTUxNS0xNWEwMjE4ZDA1OTEifQ.l2MfCEf1LJLe-kCuF-MKyOMdhAmd3UWfzG7xECMy37o',
  'kutaisi': 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxNjA0OSIsInNjcCI6InVzZXIiLCJhdWQiOm51bGwsImlhdCI6MTc2MjQ5MDIwMiwiZXhwIjoxNzY1MDgyMjAyLCJqdGkiOiIxZWVlMWU2YS1kMTNhLTQwMzEtYjI2Mi04NGRiM2Y0ZmFiMGEifQ.xGIpTLumIwLxpitlLbeclqb9XBedY8jV1wCIuMP69Vs',
  'service-center': 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxNjA0NSIsInNjcCI6InVzZXIiLCJhdWQiOm51bGwsImlhdCI6MTc2MjQ5MDA0MSwiZXhwIjoxNzY1MDgyMDQxLCJqdGkiOiI1ZDkwMDI2MC02NTE2LTQxYjctOTI4Ny1jODAyMjNiN2EwNTMifQ.oLMvW9mftfJ9Oivy2riQjx8uK12Ur6aaFy02sDs6DSc'
};

return [{ json: { branch: 'kutaisi', token: TOKENS.kutaisi, page: 1 } }];`
      },
      "id": "prep-kutaisi",
      "name": "Kutaisi Pages",
      "position": [448, 512],
      "type": "n8n-nodes-base.code",
      "typeVersion": 2
    },
    {
      "parameters": {
        "jsCode": `const TOKENS = {
  'tbilisi': 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxNjA0NiIsInNjcCI6InVzZXIiLCJhdWQiOm51bGwsImlhdCI6MTc2MjQ5MDExMywiZXhwIjoxNzY1MDgyMTEzLCJqdGkiOiI0MmUxNzQ5Zi02MjEyLTRmOTMtOGM0Zi02ZWMwODUzYmUwYWQifQ.20oXaXcgK_hdofbUK3RGdQuPa0pGWtZTV4b42-A8oY4',
  'batumi': 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxNjA0OCIsInNjcCI6InVzZXIiLCJhdWQiOm51bGwsImlhdCI6MTc2MjQ5MDE1NCwiZXhwIjoxNzY1MDgyMTU0LCJqdGkiOiI0MWUxMjRjOS01MDgxLTQ2NmMtOTUxNS0xNWEwMjE4ZDA1OTEifQ.l2MfCEf1LJLe-kCuF-MKyOMdhAmd3UWfzG7xECMy37o',
  'kutaisi': 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxNjA0OSIsInNjcCI6InVzZXIiLCJhdWQiOm51bGwsImlhdCI6MTc2MjQ5MDIwMiwiZXhwIjoxNzY1MDgyMjAyLCJqdGkiOiIxZWVlMWU2YS1kMTNhLTQwMzEtYjI2Mi04NGRiM2Y0ZmFiMGEifQ.xGIpTLumIwLxpitlLbeclqb9XBedY8jV1wCIuMP69Vs',
  'service-center': 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxNjA0NSIsInNjcCI6InVzZXIiLCJhdWQiOm51bGwsImlhdCI6MTc2MjQ5MDA0MSwiZXhwIjoxNzY1MDgyMDQxLCJqdGkiOiI1ZDkwMDI2MC02NTE2LTQxYjctOTI4Ny1jODAyMjNiN2EwNTMifQ.oLMvW9mftfJ9Oivy2riQjx8uK12Ur6aaFy02sDs6DSc'
};

return [{ json: { branch: 'service-center', token: TOKENS['service-center'], page: 1 } }];`
      },
      "id": "prep-service",
      "name": "Service Pages",
      "position": [448, 656],
      "type": "n8n-nodes-base.code",
      "typeVersion": 2
    },
    {
      "parameters": {
        "method": "POST",
        "url": "https://rentprog.net/api/v1/search_cars",
        "sendHeaders": true,
        "headerParameters": {
          "parameters": [
            { "name": "Authorization", "value": "=Bearer {{ $json.token }}" },
            { "name": "Accept", "value": "application/json, text/plain, */*" },
            { "name": "Content-Type", "value": "application/json" },
            { "name": "Origin", "value": "https://web.rentprog.ru" },
            { "name": "Referer", "value": "https://web.rentprog.ru/" },
            { "name": "User-Agent", "value": "Mozilla/5.0" }
          ]
        },
        "sendBody": true,
        "specifyBody": "json",
        "jsonBody": "={\"page\":{{ $json.page }},\"per_page\":100,\"sort_by\":\"id\",\"direction\":\"desc\",\"search\":null}",
        "options": { "timeout": 30000 }
      },
      "id": "get-tbilisi",
      "name": "Get Tbilisi",
      "position": [640, 208],
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.2,
      "retryOnFail": true,
      "maxTries": 2,
      "continueOnFail": true
    },
    {
      "parameters": {
        "method": "POST",
        "url": "https://rentprog.net/api/v1/search_cars",
        "sendHeaders": true,
        "headerParameters": {
          "parameters": [
            { "name": "Authorization", "value": "=Bearer {{ $json.token }}" },
            { "name": "Accept", "value": "application/json, text/plain, */*" },
            { "name": "Content-Type", "value": "application/json" },
            { "name": "Origin", "value": "https://web.rentprog.ru" },
            { "name": "Referer", "value": "https://web.rentprog.ru/" },
            { "name": "User-Agent", "value": "Mozilla/5.0" }
          ]
        },
        "sendBody": true,
        "specifyBody": "json",
        "jsonBody": "={\"page\":{{ $json.page }},\"per_page\":100,\"sort_by\":\"id\",\"direction\":\"desc\",\"search\":null}",
        "options": { "timeout": 30000 }
      },
      "id": "get-batumi",
      "name": "Get Batumi",
      "position": [640, 352],
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.2,
      "retryOnFail": true,
      "maxTries": 2,
      "continueOnFail": true
    },
    {
      "parameters": {
        "method": "POST",
        "url": "https://rentprog.net/api/v1/search_cars",
        "sendHeaders": true,
        "headerParameters": {
          "parameters": [
            { "name": "Authorization", "value": "=Bearer {{ $json.token }}" },
            { "name": "Accept", "value": "application/json, text/plain, */*" },
            { "name": "Content-Type", "value": "application/json" },
            { "name": "Origin", "value": "https://web.rentprog.ru" },
            { "name": "Referer", "value": "https://web.rentprog.ru/" },
            { "name": "User-Agent", "value": "Mozilla/5.0" }
          ]
        },
        "sendBody": true,
        "specifyBody": "json",
        "jsonBody": "={\"page\":{{ $json.page }},\"per_page\":100,\"sort_by\":\"id\",\"direction\":\"desc\",\"search\":null}",
        "options": { "timeout": 30000 }
      },
      "id": "get-kutaisi",
      "name": "Get Kutaisi",
      "position": [640, 512],
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.2,
      "retryOnFail": true,
      "maxTries": 2,
      "continueOnFail": true
    },
    {
      "parameters": {
        "method": "POST",
        "url": "https://rentprog.net/api/v1/search_cars",
        "sendHeaders": true,
        "headerParameters": {
          "parameters": [
            { "name": "Authorization", "value": "=Bearer {{ $json.token }}" },
            { "name": "Accept", "value": "application/json, text/plain, */*" },
            { "name": "Content-Type", "value": "application/json" },
            { "name": "Origin", "value": "https://web.rentprog.ru" },
            { "name": "Referer", "value": "https://web.rentprog.ru/" },
            { "name": "User-Agent", "value": "Mozilla/5.0" }
          ]
        },
        "sendBody": true,
        "specifyBody": "json",
        "jsonBody": "={\"page\":{{ $json.page }},\"per_page\":100,\"sort_by\":\"id\",\"direction\":\"desc\",\"search\":null}",
        "options": { "timeout": 30000 }
      },
      "id": "get-service",
      "name": "Get Service",
      "position": [640, 656],
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.2,
      "retryOnFail": true,
      "maxTries": 2,
      "continueOnFail": true
    },
    {
      "parameters": {
        "jsCode": `// Собираем ВСЕ responses со всех 4 филиалов и распаковываем cars
const processed = [];

// Функция для обработки одного филиала с проверкой ошибок
function processItems(items, branchName) {
  if (!items || items.length === 0) {
    processed.push({ json: { branch: branchName, error: true, error_reason: 'no_response', error_message: 'Нет ответа от API' } });
    return;
  }
  
  items.forEach(item => {
    // Проверка на ошибку HTTP запроса
    if (item.error) {
      processed.push({ json: { branch: branchName, error: true, error_reason: 'http_error', error_message: item.error.message || 'HTTP ошибка' } });
      return;
    }
    
    // Проверка на ошибку в JSON
    if (item.json?.error) {
      processed.push({ json: { branch: branchName, error: true, error_reason: 'api_error', error_message: item.json.error.message || JSON.stringify(item.json.error) } });
      return;
    }
    
    // Проверка на таймаут (пустой ответ или статус ошибки)
    if (!item.json || (item.json.statusCode && item.json.statusCode >= 400)) {
      processed.push({ json: { branch: branchName, error: true, error_reason: 'timeout_or_error', error_message: \`HTTP \${item.json?.statusCode || 'timeout'}\` } });
      return;
    }
    
    const cars = item.json?.cars?.data || item.json?.data || [];
    
    // Если нет машин - это не ошибка, просто пустой ответ
    if (cars.length === 0) {
      processed.push({ json: { branch: branchName, status: 'no_data' } });
      return;
    }
    
    // Обрабатываем машины
    cars.forEach(car_item => {
      const car = car_item.attributes || car_item;
      processed.push({
        json: {
          branch: branchName,
          rentprog_id: car.id ? String(car.id) : null,
          model: car.model || null,
          code: car.code || null,
          plate: car.plate || null,
          vin: car.vin || null,
          year: car.year || null,
          color: car.color || null,
          status: car.status || null,
          is_active: car.active !== undefined ? car.active : null,
          can_rent: car.can_rent !== undefined ? car.can_rent : null,
          mileage: car.mileage || null,
          data: JSON.stringify(car)
        }
      });
    });
  });
}

// Обрабатываем все 4 филиала
processItems($('Get Tbilisi').all(), 'tbilisi');
processItems($('Get Batumi').all(), 'batumi');
processItems($('Get Kutaisi').all(), 'kutaisi');
processItems($('Get Service').all(), 'service-center');

return processed;`
      },
      "id": "merge-and-process",
      "name": "Merge & Process",
      "position": [848, 400],
      "type": "n8n-nodes-base.code",
      "typeVersion": 2
    },
    {
      "parameters": {
        "operation": "upsert",
        "schema": { "__rl": true, "mode": "list", "value": "public" },
        "table": { "__rl": true, "mode": "list", "value": "cars" },
        "columns": {
          "mappingMode": "autoMapInputData",
          "matchingColumns": ["branch", "rentprog_id"],
          "schema": []
        },
        "options": {}
      },
      "id": "save-cars",
      "name": "Save to Cars",
      "position": [1024, 400],
      "type": "n8n-nodes-base.postgres",
      "typeVersion": 2.5,
      "credentials": {
        "postgres": {
          "id": "3I9fyXVlGg4Vl4LZ",
          "name": "Postgres account"
        }
      },
      "continueOnFail": true
    },
    {
      "parameters": {
        "jsCode": `// Проверяем ошибки сохранения в БД и объединяем с исходными данными
const originalData = $('Merge & Process').all();
const saveResults = $input.all();

// Создаем мапу для быстрого поиска ошибок сохранения
const saveErrors = {};

// Проверяем результаты сохранения
saveResults.forEach((result, index) => {
  const hasError = result.error || 
                   (result.json && result.json.error) ||
                   (result.json && result.json.message && result.json.message.includes('error')) ||
                   (result.json && !result.json.success && result.json.success !== undefined);
  
  if (hasError) {
    const originalItem = originalData[index];
    let branch = null;
    
    if (originalItem && originalItem.json && originalItem.json.branch) {
      branch = originalItem.json.branch;
    } else {
      const allBranches = ['tbilisi', 'batumi', 'kutaisi', 'service-center'];
      branch = allBranches[index % allBranches.length];
    }
    
    if (branch) {
      if (!saveErrors[branch]) saveErrors[branch] = [];
      saveErrors[branch].push({
        error: true,
        error_reason: 'db_save_error',
        error_message: result.error?.message || result.json?.error?.message || result.json?.message || 'Ошибка сохранения в БД'
      });
    }
  }
});

// Объединяем исходные данные с ошибками сохранения
const combined = [...originalData];

// Добавляем ошибки сохранения для каждого филиала
Object.keys(saveErrors).forEach(branch => {
  saveErrors[branch].forEach(err => {
    combined.push({ json: { branch, ...err } });
  });
});

return combined;`
      },
      "id": "pass-through-data",
      "name": "Pass Through Data",
      "position": [1168, 400],
      "type": "n8n-nodes-base.code",
      "typeVersion": 2
    },
    {
      "parameters": {
        "jsCode": `const saved = $input.all();
const successCount = saved.filter(s => !s.json.error && s.json.rentprog_id).length;
const errorCount = saved.filter(s => s.json.error).length;

const byBranch = {};
const errorDetails = {};

saved.forEach(item => {
  if (item.json.branch) {
    const branch = item.json.branch;
    if (!byBranch[branch]) byBranch[branch] = { success: 0, error: 0 };
    
    if (item.json.error) {
      byBranch[branch].error++;
      if (!errorDetails[branch]) errorDetails[branch] = [];
      errorDetails[branch].push({
        reason: item.json.error_reason || 'unknown',
        message: item.json.error_message || 'Неизвестная ошибка'
      });
    } else if (item.json.rentprog_id) {
      byBranch[branch].success++;
    }
  }
});

let message = '🚗 Парсинг автомобилей по филиалам раз в час:\\n';
Object.keys(byBranch).forEach(branch => {
  const stats = byBranch[branch];
  message += \`\${branch.toUpperCase()}: \${stats.success} ✓\`;
  if (stats.error > 0) {
    message += \` / \${stats.error} ✗\`;
    if (errorDetails[branch]) {
      const uniqueErrors = [...new Set(errorDetails[branch].map(e => e.message))];
      uniqueErrors.forEach(errMsg => {
        message += \`\\n  ❌ \${errMsg}\`;
      });
    }
  }
  message += '\\n';
});
message += \`\\nВсего: \${successCount} автомобилей / \${saved.length} записей\`;
if (errorCount > 0) {
  message += \`\\n\\n🚨 ОШИБОК: \${errorCount}\`;
}

return [{ json: { message, success: errorCount === 0, saved_count: successCount, error_count: errorCount, by_branch: byBranch, error_details: errorDetails } }];`
      },
      "id": "format-result",
      "name": "Format Result",
      "position": [1328, 400],
      "type": "n8n-nodes-base.code",
      "typeVersion": 2
    },
    {
      "parameters": {
        "conditions": {
          "options": {
            "caseSensitive": true,
            "typeValidation": "strict",
            "version": 1
          },
          "conditions": [{
            "id": "check-errors",
            "leftValue": "={{ $json.error_count }}",
            "operator": { "type": "number", "operation": "gt" },
            "rightValue": 1
          }],
          "combinator": "and"
        },
        "options": {}
      },
      "id": "if-error",
      "name": "If Error",
      "position": [1488, 400],
      "type": "n8n-nodes-base.if",
      "typeVersion": 2
    },
    {
      "parameters": {
        "chatId": "=-1003484642420",
        "text": "={{ $json.message }}\\n\\n🔗 <a href=\\\"https://n8n.rentflow.rentals/workflow/{{ $workflow.id }}/executions/{{ $execution.id }}\\\">Открыть execution</a>",
        "additionalFields": {
          "appendAttribution": false,
          "parse_mode": "HTML"
        }
      },
      "id": "send-alert",
      "name": "Send Alert",
      "position": [1680, 288],
      "type": "n8n-nodes-base.telegram",
      "typeVersion": 1.2,
      "credentials": {
        "telegramApi": {
          "id": "1tKryXxL5Gq395nN",
          "name": "Telegram account"
        }
      },
      "continueOnFail": true
    },
    {
      "parameters": {
        "jsCode": "// Помечаем workflow как ошибочный, выбрасывая ошибку\nconst errorData = $input.first().json;\nconst errorMessage = errorData.message || 'Ошибка парсинга автомобилей';\nthrow new Error(errorMessage);"
      },
      "id": "throw-error",
      "name": "Throw Error",
      "position": [1856, 288],
      "type": "n8n-nodes-base.code",
      "typeVersion": 2
    },
    {
      "parameters": {},
      "id": "success",
      "name": "Success",
      "position": [1712, 496],
      "type": "n8n-nodes-base.noOp",
      "typeVersion": 1
    }
  ],
  "connections": {
    "Every Hour": {
      "main": [[
        { "node": "Tbilisi Pages", "type": "main", "index": 0 },
        { "node": "Batumi Pages", "type": "main", "index": 0 },
        { "node": "Kutaisi Pages", "type": "main", "index": 0 },
        { "node": "Service Pages", "type": "main", "index": 0 }
      ]]
    },
    "Tbilisi Pages": {
      "main": [[{ "node": "Get Tbilisi", "type": "main", "index": 0 }]]
    },
    "Batumi Pages": {
      "main": [[{ "node": "Get Batumi", "type": "main", "index": 0 }]]
    },
    "Kutaisi Pages": {
      "main": [[{ "node": "Get Kutaisi", "type": "main", "index": 0 }]]
    },
    "Service Pages": {
      "main": [[{ "node": "Get Service", "type": "main", "index": 0 }]]
    },
    "Get Tbilisi": {
      "main": [[{ "node": "Merge & Process", "type": "main", "index": 0 }]]
    },
    "Get Batumi": {
      "main": [[{ "node": "Merge & Process", "type": "main", "index": 1 }]]
    },
    "Get Kutaisi": {
      "main": [[{ "node": "Merge & Process", "type": "main", "index": 2 }]]
    },
    "Get Service": {
      "main": [[{ "node": "Merge & Process", "type": "main", "index": 3 }]]
    },
    "Merge & Process": {
      "main": [[{ "node": "Save to Cars", "type": "main", "index": 0 }]]
    },
    "Save to Cars": {
      "main": [[{ "node": "Pass Through Data", "type": "main", "index": 0 }]]
    },
    "Pass Through Data": {
      "main": [[{ "node": "Format Result", "type": "main", "index": 0 }]]
    },
    "Format Result": {
      "main": [[{ "node": "If Error", "type": "main", "index": 0 }]]
    },
    "If Error": {
      "main": [
        [{ "node": "Send Alert", "type": "main", "index": 0 }],
        [{ "node": "Success", "type": "main", "index": 0 }]
      ]
    },
    "Send Alert": {
      "main": [[{ "node": "Throw Error", "type": "main", "index": 0 }]]
    }
  },
  "settings": {
    "executionOrder": "v1"
  }
};

// Сохраняем в файл
writeFileSync('n8n-workflows/cars-parser-hourly.json', JSON.stringify(template, null, 2));
console.log('✅ Workflow для парсинга автомобилей создан: n8n-workflows/cars-parser-hourly.json');

// Импортируем через MCP
console.log('\n📤 Импортирую workflow через MCP n8n...');

