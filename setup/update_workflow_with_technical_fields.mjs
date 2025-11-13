#!/usr/bin/env node
/**
 * Обновление workflow парсинга броней:
 * 1. Убираем фильтр по датам для первого полного прохода
 * 2. Добавляем логику определения технических броней
 * 3. Обновляем сохранение в БД с новыми полями
 */

import 'dotenv/config';

const WORKFLOW_ID = 'P3BnmX7Nrmh1cusF';
const N8N_API_URL = 'https://n8n.rentflow.rentals/api/v1';
const N8N_API_KEY = process.env.N8N_API_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi5mil074-cMhnuJJLI5lN6MP7FQEcI';

console.log('\n🔧 Обновление workflow с поддержкой технических броней...\n');

// Получаем текущий workflow
const getResponse = await fetch(`${N8N_API_URL}/workflows/${WORKFLOW_ID}`, {
  headers: { 'X-N8N-API-KEY': N8N_API_KEY }
});

if (!getResponse.ok) {
  console.error('❌ Ошибка получения workflow:', await getResponse.text());
  process.exit(1);
}

const responseData = await getResponse.json();
const workflow = responseData.data || responseData;

console.log('📋 Workflow получен:', workflow.name);
console.log(`   Nodes: ${workflow.nodes.length}`);

// 1. Убираем фильтр по датам из всех HTTP Request нод
const httpNodeNames = [
  'Get Tbilisi Active', 'Get Tbilisi Inactive',
  'Get Batumi Active', 'Get Batumi Inactive',
  'Get Kutaisi Active', 'Get Kutaisi Inactive',
  'Get Service Active', 'Get Service Inactive'
];

workflow.nodes.forEach(node => {
  if (httpNodeNames.includes(node.name)) {
    // Убираем фильтр start_date_from
    const jsonBody = JSON.parse(node.parameters.jsonBody.replace('=', ''));
    
    // ⚠️ ПЕРВЫЙ ПРОХОД: БЕЗ ФИЛЬТРА (полная загрузка)
    // 🔜 ПОСЛЕ ПЕРВОГО ПРОХОДА: раскомментировать для фильтра последних 30 дней
    // const dateFrom = new Date();
    // dateFrom.setDate(dateFrom.getDate() - 30);
    // jsonBody.filters.start_date_from = dateFrom.toISOString().split('T')[0];
    
    delete jsonBody.filters.start_date_from;
    
    node.parameters.jsonBody = `=${JSON.stringify(jsonBody)}`;
    
    console.log(`✅ ${node.name}: фильтр по датам УБРАН (полная загрузка)`);
  }
});

// 2. Обновляем "Process All Bookings" с логикой технических броней
const processNode = workflow.nodes.find(n => n.name === 'Process All Bookings');

if (processNode) {
  processNode.parameters.jsCode = `// Обрабатываем все брони со всех филиалов
// Используем $input.all() и индексацию по порядку
let allItems = [];
for (let i = 0; i < 8; i++) {
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
  { branch: 'tbilisi', active: true },
  { branch: 'tbilisi', active: false },
  { branch: 'batumi', active: true },
  { branch: 'batumi', active: false },
  { branch: 'kutaisi', active: true },
  { branch: 'kutaisi', active: false },
  { branch: 'service-center', active: true },
  { branch: 'service-center', active: false }
];

// Функция определения типа технической брони
function getTechnicalType(attrs) {
  const firstName = (attrs.first_name || '').toLowerCase();
  const lastName = (attrs.last_name || '').toLowerCase();
  const clientName = \`\${firstName} \${lastName}\`.toLowerCase();
  const description = (attrs.description || '').toLowerCase();
  const locationStart = (attrs.location_start || '').toLowerCase();
  
  // Проверяем, техническая ли бронь
  const isTechnical = (
    clientName.includes('сервис') ||
    clientName.includes('сотрудник') ||
    clientName.includes('service') ||
    clientName.includes('employee') ||
    attrs.rental_cost === 0 // часто технические брони без стоимости
  );
  
  if (!isTechnical) {
    return {
      is_technical: false,
      technical_type: 'regular',
      technical_purpose: null
    };
  }
  
  // Определяем подтип
  const isRepair = (
    clientName.includes('сервис') ||
    description.includes('ремонт') ||
    description.includes('repair') ||
    description.includes('fix') ||
    description.includes('сто') ||
    locationStart.includes('сервис') ||
    locationStart.includes('service')
  );
  
  if (isRepair) {
    return {
      is_technical: true,
      technical_type: 'technical_repair',
      technical_purpose: 'repair'
    };
  }
  
  return {
    is_technical: true,
    technical_type: 'technical',
    technical_purpose: 'employee_trip'
  };
}

const results = [];

allItems.forEach((item, index) => {
  const json = item.json;
  const mapping = branchMapping[index] || { branch: 'unknown', active: null };
  
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
  
  if (bookingsData.length === 0) {
    return;
  }
  
  // Парсим каждую бронь
  bookingsData.forEach(booking => {
    const attrs = booking.attributes || booking;
    
    // Определяем тип технической брони
    const technicalInfo = getTechnicalType(attrs);
    
    // Формируем полное имя клиента
    const clientName = [attrs.first_name, attrs.middle_name, attrs.last_name]
      .filter(Boolean)
      .join(' ');
    
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
        client_name: clientName,
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
        
        // ✨ НОВОЕ: Технические брони
        is_technical: technicalInfo.is_technical,
        technical_type: technicalInfo.technical_type,
        technical_purpose: technicalInfo.technical_purpose,
        
        // Все остальное в data
        data: attrs,
        
        // Без ошибок
        error: false
      }
    });
  });
});

console.log(\`Total results: \${results.length}\`);

return results;`;

  console.log('✅ Process All Bookings: добавлена логика технических броней');
}

// 3. Обновляем "Save to DB" с новыми полями
const saveNode = workflow.nodes.find(n => n.name === 'Save to DB');

if (saveNode) {
  saveNode.parameters.jsCode = `// Batch INSERT для быстрого сохранения всех броней
const items = $input.all();

if (items.length === 0) {
  return [{
    json: {
      saved: [],
      errors: [],
      message: 'Нет данных для сохранения'
    }
  }];
}

// Подключение к БД
const postgres = require('postgres');
const sql = postgres(process.env.DATABASE_URL, {
  ssl: { rejectUnauthorized: false },
  max: 1
});

const saved = [];
const errors = [];

try {
  // Формируем массив values для batch insert
  const values = items.map(item => {
    const d = item.json;
    return {
      branch: d.branch,
      number: d.booking_id,
      is_active: d.is_active === true,
      start_date: d.start_date || null,
      end_date: d.end_date || null,
      start_date_formatted: d.start_date_formatted || null,
      end_date_formatted: d.end_date_formatted || null,
      client_id: d.client_id || null,
      client_name: d.client_name || null,
      client_category: d.client_category || null,
      car_id: d.car_id || null,
      car_name: d.car_name || null,
      car_code: d.car_code || null,
      location_start: d.location_start || null,
      location_end: d.location_end || null,
      total: d.total || null,
      deposit: d.deposit || null,
      rental_cost: d.rental_cost || null,
      days: d.days || null,
      state: d.state || null,
      in_rent: d.in_rent || null,
      archive: d.archive || null,
      start_worker_id: d.start_worker_id || null,
      end_worker_id: d.end_worker_id || null,
      responsible: d.responsible || null,
      description: d.description || null,
      source: d.source || null,
      data: d.data || {},
      // ✨ НОВОЕ: Технические брони
      is_technical: d.is_technical || false,
      technical_type: d.technical_type || 'regular',
      technical_purpose: d.technical_purpose || null
    };
  });
  
  // Batch INSERT с ON CONFLICT
  const result = await sql\`
    INSERT INTO bookings \${sql(values, 
      'branch', 'number', 'is_active',
      'start_date', 'end_date', 'start_date_formatted', 'end_date_formatted',
      'client_id', 'client_name', 'client_category',
      'car_id', 'car_name', 'car_code',
      'location_start', 'location_end',
      'total', 'deposit', 'rental_cost', 'days',
      'state', 'in_rent', 'archive',
      'start_worker_id', 'end_worker_id', 'responsible',
      'description', 'source', 'data',
      'is_technical', 'technical_type', 'technical_purpose'
    )}
    ON CONFLICT (branch, number) 
    DO UPDATE SET
      is_active = EXCLUDED.is_active,
      start_date = EXCLUDED.start_date,
      end_date = EXCLUDED.end_date,
      start_date_formatted = EXCLUDED.start_date_formatted,
      end_date_formatted = EXCLUDED.end_date_formatted,
      client_id = EXCLUDED.client_id,
      client_name = EXCLUDED.client_name,
      client_category = EXCLUDED.client_category,
      car_id = EXCLUDED.car_id,
      car_name = EXCLUDED.car_name,
      car_code = EXCLUDED.car_code,
      location_start = EXCLUDED.location_start,
      location_end = EXCLUDED.location_end,
      total = EXCLUDED.total,
      deposit = EXCLUDED.deposit,
      rental_cost = EXCLUDED.rental_cost,
      days = EXCLUDED.days,
      state = EXCLUDED.state,
      in_rent = EXCLUDED.in_rent,
      archive = EXCLUDED.archive,
      start_worker_id = EXCLUDED.start_worker_id,
      end_worker_id = EXCLUDED.end_worker_id,
      responsible = EXCLUDED.responsible,
      description = EXCLUDED.description,
      source = EXCLUDED.source,
      data = EXCLUDED.data::jsonb,
      is_technical = EXCLUDED.is_technical,
      technical_type = EXCLUDED.technical_type,
      technical_purpose = EXCLUDED.technical_purpose,
      updated_at = NOW()
    RETURNING id, branch, number
  \`;
  
  saved.push(...result);
  
  console.log(\`✅ Сохранено \${result.length} записей\`);
  
} catch (error) {
  console.error('❌ Ошибка сохранения:', error.message);
  errors.push({
    message: error.message,
    stack: error.stack
  });
} finally {
  await sql.end();
}

return [{
  json: {
    saved: saved,
    errors: errors,
    total: items.length,
    success_count: saved.length,
    error_count: errors.length
  }
}];`;

  console.log('✅ Save to DB: добавлены поля is_technical, technical_type, technical_purpose');
}

// Обновляем workflow
console.log('\n📤 Отправка обновленного workflow...\n');

const updateData = {
  name: workflow.name,
  nodes: workflow.nodes,
  connections: workflow.connections,
  settings: workflow.settings
};

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
  console.error('❌ Ошибка обновления workflow:', errorText);
  process.exit(1);
}

const updated = await updateResponse.json();

console.log('✅ Workflow успешно обновлен!\n');
console.log('📋 Изменения:\n');
console.log('   1. ✅ Убран фильтр по датам (полная загрузка)');
console.log('   2. ✅ Добавлена логика определения технических броней');
console.log('   3. ✅ Сохранение полей: is_technical, technical_type, technical_purpose\n');
console.log('🔗 Workflow: https://n8n.rentflow.rentals/workflow/' + WORKFLOW_ID + '\n');
console.log('⚠️  ВАЖНО:\n');
console.log('   • Первый запуск: БЕЗ фильтра (загрузит ВСЕ брони)');
console.log('   • После первого прохода: раскомментировать фильтр 30 дней');
console.log('   • Или использовать скрипт: setup/enable_date_filter.mjs\n');

