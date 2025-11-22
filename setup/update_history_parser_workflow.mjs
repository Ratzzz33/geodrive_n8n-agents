#!/usr/bin/env node
/**
 * Обновление workflow "Парсинг истории операций" для добавления парсинга description
 */

import https from 'https';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const N8N_HOST = process.env.N8N_HOST || 'https://n8n.rentflow.rentals/api/v1';
const N8N_API_KEY = process.env.N8N_API_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI';

const WORKFLOW_ID = 'xSjwtwrrWUGcBduU';

// Обновленный код для ноды "Merge & Process" с парсингом description
const updatedMergeProcessCode = `// Собираем ВСЕ responses со всех 4 филиалов и распаковываем operations
// + ПАРСИМ description для извлечения entity_type, entity_id, user_name
const processed = [];

// Функция для парсинга description (как в parse_history_description)
function parseDescription(description) {
  if (!description || typeof description !== 'string') {
    return { entity_type: null, entity_id: null, user_name: null, operation: null };
  }
  
  let entity_type = null;
  let entity_id = null;
  let user_name = null;
  let operation = null;
  
  // Извлечение имени пользователя (обычно в начале описания)
  // Формат: "Имя Фамилия изменил/создал/принял..."
  const userMatch = description.match(/^([А-Яа-яЁёA-Za-z\\s]+?)\\s+(изменил|создал|принял|выдал|удалил|отменил)/i);
  if (userMatch) {
    user_name = userMatch[1].trim();
  }
  
  // Определение операции
  if (description.match(/создал|created/i)) {
    operation = 'create';
  } else if (description.match(/изменил|changed|updated/i)) {
    operation = 'update';
  } else if (description.match(/удалил|deleted/i)) {
    operation = 'delete';
  } else if (description.match(/принял|accepted|returned/i)) {
    operation = 'return';
  } else if (description.match(/выдал|issued/i)) {
    operation = 'issue';
  }
  
  // Поиск ID брони (№ 506974, booking #506974, бронь № 506974)
  const bookingMatch = description.match(/(?:бронь|booking|бронирование)[\\s#№]*(\\d+)/i);
  if (bookingMatch) {
    entity_type = 'booking';
    entity_id = bookingMatch[1];
    return { entity_type, entity_id, user_name, operation };
  }
  
  // Поиск ID платежа (платёж №1840037, payment #1840037)
  const paymentMatch = description.match(/(?:плат[ёе]ж|payment)[\\s#№]*(\\d+)/i);
  if (paymentMatch) {
    entity_type = 'payment';
    entity_id = paymentMatch[1];
    return { entity_type, entity_id, user_name, operation };
  }
  
  // Поиск ID авто (авто № 39736, car #39736, машина № 39736)
  const carMatch = description.match(/(?:авто|car|машина|автомобиль)[\\s#№]*(\\d+)/i);
  if (carMatch) {
    entity_type = 'car';
    entity_id = carMatch[1];
    return { entity_type, entity_id, user_name, operation };
  }
  
  // Поиск ID клиента (клиент № 381606, client #381606)
  const clientMatch = description.match(/(?:клиент|client)[\\s#№]*(\\d+)/i);
  if (clientMatch) {
    entity_type = 'client';
    entity_id = clientMatch[1];
    return { entity_type, entity_id, user_name, operation };
  }
  
  return { entity_type, entity_id, user_name, operation };
}

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
    
    const operations = item.json?.operations?.data || item.json?.data || [];
    
    // Если нет операций - это не ошибка, просто пустой ответ
    if (operations.length === 0) {
      processed.push({ json: { branch: branchName, status: 'no_data' } });
      return;
    }
    
    // Обрабатываем операции
    operations.forEach(op_item => {
      const op = op_item.attributes || op_item;
      const description = op.description || '';
      
      // Парсим description для извлечения entity_type, entity_id, user_name
      const parsed = parseDescription(description);
      
      processed.push({
        json: {
          branch: branchName,
          operation_type: op.operation_type || op.type || 'unknown',
          operation_id: op.id ? String(op.id) : null,
          description: description,
          // Используем распарсенные значения, если они есть, иначе берем из API
          entity_type: parsed.entity_type || op.entity_type || null,
          entity_id: parsed.entity_id || (op.entity_id ? String(op.entity_id) : null),
          user_name: parsed.user_name || op.user_name || op.user || op.author || null,
          created_at: op.created_at || op.timestamp || new Date().toISOString(),
          raw_data: JSON.stringify(op)
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

return processed;`;

async function updateWorkflow() {
  console.log('📥 Получаю текущий workflow...\n');
  
  // Получаем текущий workflow
  const currentWorkflow = await new Promise((resolve, reject) => {
    const req = https.request(
      `${N8N_HOST}/workflows/${WORKFLOW_ID}`,
      {
        method: 'GET',
        headers: {
          'X-N8N-API-KEY': N8N_API_KEY,
          'Content-Type': 'application/json'
        }
      },
      (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          if (res.statusCode === 200) {
            resolve(JSON.parse(data));
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${data}`));
          }
        });
      }
    );
    req.on('error', reject);
    req.end();
  });
  
  const workflow = currentWorkflow.data || currentWorkflow;
  
  if (!workflow || !workflow.nodes) {
    throw new Error('Неверная структура ответа от API');
  }
  
  // Обновляем ноду "Merge & Process"
  const mergeProcessNode = workflow.nodes.find(n => n.id === 'merge-and-process');
  if (!mergeProcessNode) {
    throw new Error('Нода "Merge & Process" не найдена');
  }
  
  mergeProcessNode.parameters.jsCode = updatedMergeProcessCode;
  
  console.log('✅ Нода "Merge & Process" обновлена с парсингом description\n');
  
  // Очищаем системные поля
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
  
  // Удаляем id из нод
  workflow.nodes.forEach(node => {
    delete node.id;
  });
  
  // Обновляем workflow
  console.log('📤 Обновляю workflow в n8n...\n');
  
  const updateResult = await new Promise((resolve, reject) => {
    const body = JSON.stringify({
      name: workflow.name,
      nodes: workflow.nodes,
      connections: workflow.connections,
      settings: workflow.settings
    });
    
    const req = https.request(
      `${N8N_HOST}/workflows/${WORKFLOW_ID}`,
      {
        method: 'PUT',
        headers: {
          'X-N8N-API-KEY': N8N_API_KEY,
          'Content-Type': 'application/json'
        }
      },
      (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          if (res.statusCode === 200) {
            resolve(JSON.parse(data));
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${data}`));
          }
        });
      }
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });
  
  console.log('✅ Workflow обновлен успешно!');
  console.log(`🔗 URL: https://n8n.rentflow.rentals/workflow/${WORKFLOW_ID}\n`);
}

updateWorkflow()
  .then(() => {
    console.log('✅ Обновление завершено');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Ошибка:', error.message);
    process.exit(1);
  });



