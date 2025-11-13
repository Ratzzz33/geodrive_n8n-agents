#!/usr/bin/env node
/**
 * Исправление SQL запроса в ноде "Save to DB"
 */

import 'dotenv/config';

const WORKFLOW_ID = 'P3BnmX7Nrmh1cusF';
const N8N_API_URL = 'https://n8n.rentflow.rentals/api/v1';
const N8N_API_KEY = process.env.N8N_API_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI';

async function updateWorkflow() {
  console.log(`\n🔧 Исправление SQL запроса в "Save to DB"...\n`);
  
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
  const saveNode = current.nodes.find(n => n.name === 'Save to DB');
  
  if (!saveNode) {
    throw new Error('Node "Save to DB" not found');
  }
  
  console.log('✅ Найдена нода "Save to DB"');
  
  // Новый SQL запрос с правильными полями
  const newQuery = `INSERT INTO bookings (
  branch,
  number,
  is_active,
  start_date,
  end_date,
  start_date_formatted,
  end_date_formatted,
  client_id,
  client_name,
  client_category,
  car_id,
  car_name,
  car_code,
  location_start,
  location_end,
  total,
  deposit,
  rental_cost,
  days,
  state,
  in_rent,
  archive,
  start_worker_id,
  end_worker_id,
  responsible,
  description,
  source,
  data,
  created_at,
  updated_at
) VALUES (
  {{ $json.branch ? "'" + $json.branch + "'" : 'NULL' }},
  {{ $json.booking_id ? $json.booking_id : 'NULL' }},
  {{ $json.is_active === true ? 'TRUE' : 'FALSE' }},
  {{ $json.start_date ? "'" + $json.start_date + "'" : 'NULL' }},
  {{ $json.end_date ? "'" + $json.end_date + "'" : 'NULL' }},
  {{ $json.start_date_formatted ? "'" + $json.start_date_formatted.replace(/'/g, "''") + "'" : 'NULL' }},
  {{ $json.end_date_formatted ? "'" + $json.end_date_formatted.replace(/'/g, "''") + "'" : 'NULL' }},
  {{ $json.client_id ? "'" + $json.client_id + "'::uuid" : 'NULL' }},
  {{ $json.client_name ? "'" + $json.client_name.replace(/'/g, "''") + "'" : 'NULL' }},
  {{ $json.client_category ? "'" + $json.client_category.replace(/'/g, "''") + "'" : 'NULL' }},
  {{ $json.car_id ? "'" + $json.car_id + "'::uuid" : 'NULL' }},
  {{ $json.car_name ? "'" + $json.car_name.replace(/'/g, "''") + "'" : 'NULL' }},
  {{ $json.car_code ? "'" + $json.car_code.replace(/'/g, "''") + "'" : 'NULL' }},
  {{ $json.location_start ? "'" + $json.location_start.replace(/'/g, "''") + "'" : 'NULL' }},
  {{ $json.location_end ? "'" + $json.location_end.replace(/'/g, "''") + "'" : 'NULL' }},
  {{ $json.total || 'NULL' }},
  {{ $json.deposit || 'NULL' }},
  {{ $json.rental_cost || 'NULL' }},
  {{ $json.days || 'NULL' }},
  {{ $json.state ? "'" + $json.state.replace(/'/g, "''") + "'" : 'NULL' }},
  {{ $json.in_rent === true ? 'TRUE' : ($json.in_rent === false ? 'FALSE' : 'NULL') }},
  {{ $json.archive === true ? 'TRUE' : ($json.archive === false ? 'FALSE' : 'NULL') }},
  {{ $json.start_worker_id ? "'" + $json.start_worker_id + "'" : 'NULL' }},
  {{ $json.end_worker_id ? "'" + $json.end_worker_id + "'" : 'NULL' }},
  {{ $json.responsible ? "'" + $json.responsible.replace(/'/g, "''") + "'" : 'NULL' }},
  {{ $json.description ? "'" + $json.description.replace(/'/g, "''") + "'" : 'NULL' }},
  {{ $json.source ? "'" + $json.source.replace(/'/g, "''") + "'" : 'NULL' }},
  {{ $json.data ? "'" + JSON.stringify($json.data).replace(/'/g, "''") + "'::jsonb" : "'{}'::jsonb" }},
  NOW(),
  NOW()
)
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
  data = EXCLUDED.data,
  updated_at = NOW()
RETURNING id, branch, number;`;

  saveNode.parameters.query = `=${newQuery}`;
  
  console.log('✅ SQL запрос обновлен');
  console.log('   → Использует правильные названия полей');
  console.log('   → Вставляет все 28 полей');
  console.log('   → UPSERT по (branch, number)');
  
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
  console.log(`\n🚀 Теперь данные БУДУТ сохраняться в БД!`);
}

updateWorkflow().catch(err => {
  console.error('❌ Ошибка:', err.message);
  process.exit(1);
});

