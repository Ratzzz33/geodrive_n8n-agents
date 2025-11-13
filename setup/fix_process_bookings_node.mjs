#!/usr/bin/env node
/**
 * Исправление ноды "Process All Bookings" для корректной работы в полном workflow
 */

import 'dotenv/config';

const WORKFLOW_ID = 'P3BnmX7Nrmh1cusF';
const N8N_API_URL = 'https://n8n.rentflow.rentals/api/v1';
const N8N_API_KEY = process.env.N8N_API_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI';

// Новый код для ноды "Process All Bookings"
const NEW_CODE = `// Обрабатываем все брони со всех филиалов
// Используем $input.all() и индексацию по порядку
const allItems = $input.all();

console.log('Total input items:', allItems.length);

// Маппинг индексов на филиалы (порядок из connections)
// 0: Tbilisi Active, 1: Tbilisi Inactive
// 2: Batumi Active, 3: Batumi Inactive
// 4: Kutaisi Active, 5: Kutaisi Inactive
// 6: Service Active, 7: Service Inactive
const branchMapping = [
  { branch: 'tbilisi', active: true },
  { branch: 'tbilisi', active: false },
  { branch: 'batumi', active: true },
  { branch: 'batumi', active: false },
  { branch: 'kutaisi', active: true },
  { branch: 'kutaisi', active: false },
  { branch: 'service-center', active: true },
  { branch: 'service-center', active: false }
];

const results = [];

allItems.forEach((item, index) => {
  const json = item.json;
  const mapping = branchMapping[index] || { branch: 'unknown', active: null };
  
  console.log(\`Processing item \${index}: branch=\${mapping.branch}, active=\${mapping.active}\`);
  
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
  
  // RentProg API возвращает структуру: {bookings: {data: [...]}}
  const bookingsData = json.bookings?.data || [];
  console.log(\`Found \${bookingsData.length} bookings for \${mapping.branch} (active=\${mapping.active})\`);
  
  if (bookingsData.length === 0) {
    console.log(\`No bookings found for \${mapping.branch}\`);
    return;
  }
  
  // Парсим каждую бронь
  bookingsData.forEach(booking => {
    const attrs = booking.attributes || booking;
    
    results.push({
      json: {
        branch: mapping.branch,
        booking_id: String(booking.id || attrs.id),
        number: attrs.number,
        is_active: mapping.active,
        
        // Даты
        start_date: attrs['start_date'],
        end_date: attrs['end_date'],
        start_date_formatted: attrs['start_date_formatted'],
        end_date_formatted: attrs['end_date_formatted'],
        created_at: attrs['created_at'],
        
        // Клиент
        client_id: attrs['client_id'],
        first_name: attrs['first_name'],
        middle_name: attrs['middle_name'],
        last_name: attrs['last_name'],
        client_category: attrs['client_category'],
        
        // Авто
        car_id: attrs['car_id'],
        car_name: attrs['car_name'],
        car_code: attrs['car_code'],
        
        // Локации
        location_start: attrs['location_start'],
        location_end: attrs['location_end'],
        
        // Финансы
        total: attrs['total'],
        deposit: attrs['deposit'],
        rental_cost: attrs['rental_cost'],
        days: attrs['days'],
        
        // Статусы
        state: attrs['state'],
        in_rent: attrs['in_rent'],
        archive: attrs['archive'],
        
        // Ответственные
        start_worker_id: attrs['start_worker_id'],
        end_worker_id: attrs['end_worker_id'],
        responsible: attrs['responsible'],
        
        // Доп данные
        description: attrs['description'],
        source: attrs['source'],
        
        // Все остальное в data (весь объект attributes)
        data: JSON.stringify(attrs),
        
        // Без ошибок
        error: false
      }
    });
  });
});

console.log(\`Total results: \${results.length}\`);

return results;`;

async function updateWorkflow() {
  console.log(`\n🔧 Исправление ноды "Process All Bookings"...`);
  
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
  console.log(`✅ Получен workflow: ${current.name}`);
  
  // Находим и обновляем ноду "Process All Bookings"
  const processNode = current.nodes.find(n => n.name === 'Process All Bookings');
  
  if (!processNode) {
    throw new Error('Node "Process All Bookings" not found');
  }
  
  console.log('✅ Найдена нода "Process All Bookings"');
  
  // Обновляем код
  processNode.parameters.jsCode = NEW_CODE;
  
  console.log('✅ Код ноды обновлен');
  
  // Удаляем id из нод
  current.nodes.forEach(node => {
    delete node.id;
  });
  
  // Создаем чистый объект для обновления
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
  console.log(`\n✅ Workflow обновлен успешно!`);
  console.log(`🔗 URL: https://n8n.rentflow.rentals/workflow/${WORKFLOW_ID}`);
  console.log(`\n📝 Изменения:`);
  console.log(`  - Использование $input.all() вместо $('NodeName')`);
  console.log(`  - Индексация по порядку (0-7 для 8 параллельных запросов)`);
  console.log(`  - Правильная структура JSON API: bookings.data`);
  console.log(`  - Логирование для отладки`);
  console.log(`\n🚀 Теперь workflow будет работать корректно!`);
}

updateWorkflow().catch(err => {
  console.error('❌ Ошибка:', err.message);
  process.exit(1);
});

