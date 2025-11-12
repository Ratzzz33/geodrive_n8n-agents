#!/usr/bin/env node
/**
 * Исправление workflow "Парсинг касс компании раз в 3 минуты"
 * Проблемы:
 * 1. Отправляются уведомления даже при успешных выполнениях
 * 2. Execution с ошибками помечается как успешный
 * 
 * Решение:
 * 1. Убрать отправку уведомлений при успехе (оставить только при ошибках)
 * 2. Исправить "Mark as Failed" чтобы выбрасывал ошибку при наличии ошибок
 */

const N8N_HOST = process.env.N8N_HOST || 'https://n8n.rentflow.rentals/api/v1';
const N8N_API_KEY = process.env.N8N_API_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI';

const WORKFLOW_ID = 'w8g8cJb0ccReaqIE';

async function n8nRequest(method, endpoint, data = null) {
  const url = `${N8N_HOST}${endpoint}`;
  const options = {
    method,
    headers: {
      'X-N8N-API-KEY': N8N_API_KEY,
      'Content-Type': 'application/json',
    },
  };
  
  if (data) {
    options.body = JSON.stringify(data);
  }
  
  const response = await fetch(url, options);
  const result = await response.json();
  
  if (!response.ok) {
    throw new Error(`n8n API error: ${result.message || response.statusText}`);
  }
  
  return result;
}

async function main() {
  console.log('🔧 Исправление workflow "Парсинг касс компании раз в 3 минуты"...\n');
  
  // Получаем текущий workflow
  console.log('📥 Получение текущего workflow...');
  const currentResponse = await n8nRequest('GET', `/workflows/${WORKFLOW_ID}`);
  const current = currentResponse.data?.data || currentResponse.data || currentResponse;
  
  // Исправляем ноду "Mark as Failed" - должна выбрасывать ошибку при наличии ошибок
  const markFailedNode = current.nodes.find(n => n.id === 'mark-failed');
  if (markFailedNode) {
    console.log('✅ Найдена нода "Mark as Failed"');
    
    // Исправляем логику: выбрасываем ошибку ТОЛЬКО если есть ошибки
    markFailedNode.parameters.jsCode = `// Выбрасываем ошибку ТОЛЬКО если есть ошибки
// Это нужно чтобы execution помечался как failed в n8n
let errorData = null;
try {
  const formatResult = $('Format Result').first();
  if (formatResult && formatResult.json) errorData = formatResult.json;
} catch (e) {
  try {
    const input = $input.first();
    if (input && input.json) errorData = input.json;
  } catch (e2) {}
}

// Если есть ошибки - выбрасываем исключение чтобы execution был помечен как failed
if (errorData && errorData.success === false) {
  const errorMessage = errorData.message || 'Ошибка при парсинге касс компании';
  console.error('❌ Ошибки обнаружены:', errorMessage);
  throw new Error(errorMessage);
}

// Если все успешно - просто возвращаем данные
return $input.all();`;
    
    // Убираем continueOnFail - хотим чтобы ошибка прервала workflow
    delete markFailedNode.continueOnFail;
    console.log('  ✅ Исправлена логика: выбрасывает ошибку при наличии ошибок');
  }
  
  // Исправляем connections - убираем "Mark as Failed" из ветки успеха
  // "If Error" имеет два выхода: [0] - true (есть ошибка), [1] - false (нет ошибки)
  // Сейчас оба ведут к отправке уведомлений - это неправильно
  if (current.connections['If Error']) {
    console.log('✅ Найдены connections для "If Error"');
    
    // [0] - true (есть ошибка) → "Send Error Alert" → "Mark as Failed"
    // [1] - false (нет ошибки) → ничего (просто завершаем успешно)
    current.connections['If Error'] = {
      main: [
        [
          {
            node: "Send Error Alert",
            type: "main",
            index: 0
          }
        ],
        [] // Пустой массив = нет выхода при успехе (не отправляем уведомления)
      ]
    };
    
    // "Send Error Alert" → "Mark as Failed"
    if (current.connections['Send Error Alert']) {
      current.connections['Send Error Alert'] = {
        main: [
          [
            {
              node: "Mark as Failed",
              type: "main",
              index: 0
            }
          ]
        ]
      };
    }
    
    console.log('  ✅ Исправлены connections: уведомления только при ошибках');
  }
  
  // Подготавливаем данные для обновления
  const updateData = {
    name: current.name,
    nodes: current.nodes,
    connections: current.connections,
    settings: current.settings
  };
  
  // Обновляем workflow
  console.log('\n📤 Обновление workflow...');
  const updateResponse = await n8nRequest('PUT', `/workflows/${WORKFLOW_ID}`, updateData);
  
  console.log('\n✅ Workflow успешно обновлен!');
  console.log(`   URL: https://n8n.rentflow.rentals/workflow/${WORKFLOW_ID}`);
  console.log('\n📋 Исправления:');
  console.log('   1. ✅ Уведомления отправляются ТОЛЬКО при ошибках');
  console.log('   2. ✅ Execution помечается как failed при наличии ошибок');
  console.log('   3. ✅ При успехе workflow завершается без уведомлений');
}

main().catch(error => {
  console.error('❌ Ошибка:', error.message);
  if (error.stack) {
    console.error(error.stack);
  }
  process.exit(1);
});

