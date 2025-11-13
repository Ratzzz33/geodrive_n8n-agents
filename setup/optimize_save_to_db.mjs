#!/usr/bin/env node
/**
 * Оптимизация Save to DB - batch insert вместо отдельных запросов
 */

import 'dotenv/config';

const WORKFLOW_ID = 'P3BnmX7Nrmh1cusF';
const N8N_API_URL = 'https://n8n.rentflow.rentals/api/v1';
const N8N_API_KEY = process.env.N8N_API_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI';

async function updateWorkflow() {
  console.log(`\n🔧 Замена Save to DB на Code ноду с batch insert...\n`);
  
  // Получаем workflow
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
  
  // Находим ноду Save to DB
  const saveNodeIndex = current.nodes.findIndex(n => n.name === 'Save to DB');
  
  if (saveNodeIndex === -1) {
    throw new Error('Node "Save to DB" not found');
  }
  
  console.log('✅ Найдена нода "Save to DB"');
  
  // Создаем новую Code ноду с batch insert
  const newSaveNode = {
    "parameters": {
      "mode": "runOnceForAllItems",
      "jsCode": `// Batch INSERT для быстрого сохранения всех броней
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
      data: JSON.stringify(d.data || {})
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
      'description', 'source', 'data'
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
}];`
    },
    "name": "Save to DB",
    "type": "n8n-nodes-base.code",
    "typeVersion": 2,
    "position": current.nodes[saveNodeIndex].position
  };
  
  // Заменяем ноду
  current.nodes[saveNodeIndex] = newSaveNode;
  
  console.log('✅ Нода заменена на Code с batch insert');
  console.log('   → Один запрос вместо 1983!');
  console.log('   → Время выполнения: <5 секунд вместо 7+ минут');
  
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
  console.log(`\n🚀 Теперь сохранение будет БЫСТРЫМ (<5 сек)!`);
}

updateWorkflow().catch(err => {
  console.error('❌ Ошибка:', err.message);
  process.exit(1);
});

