#!/usr/bin/env node
/**
 * Исправление экранирования в Save to DB ноде
 * Проблема: Синтаксическая ошибка при сохранении русских символов
 * Решение: Использовать параметризованный запрос через postgres библиотеку
 */

import 'dotenv/config';

const N8N_HOST = 'https://n8n.rentflow.rentals/api/v1';
const N8N_API_KEY = process.env.N8N_API_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI';
const WORKFLOW_ID = 'P3BnmX7Nrmh1cusF';

async function getWorkflow() {
  const response = await fetch(`${N8N_HOST}/workflows/${WORKFLOW_ID}`, {
    headers: { 'X-N8N-API-KEY': N8N_API_KEY }
  });
  
  if (!response.ok) {
    throw new Error(`Failed to get workflow: ${response.status}`);
  }
  
  const data = await response.json();
  return data.data || data;
}

async function updateWorkflow(workflow) {
  const updateData = {
    name: workflow.name,
    nodes: workflow.nodes,
    connections: workflow.connections,
    settings: workflow.settings
  };
  
  const response = await fetch(`${N8N_HOST}/workflows/${WORKFLOW_ID}`, {
    method: 'PUT',
    headers: {
      'X-N8N-API-KEY': N8N_API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(updateData)
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to update: ${response.status}\n${error}`);
  }
  
  return await response.json();
}

async function main() {
  console.log('='.repeat(70));
  console.log('ИСПРАВЛЕНИЕ SAVE TO DB - ЭКРАНИРОВАНИЕ');
  console.log('='.repeat(70));
  
  const workflow = await getWorkflow();
  console.log(`\nWorkflow: "${workflow.name}"`);
  
  // Найти Save to DB ноду
  const saveNode = workflow.nodes.find(n => n.name === 'Save to DB');
  if (!saveNode) {
    throw new Error('Save to DB нода не найдена!');
  }
  
  console.log(`\nНайдена нода: ${saveNode.name} (${saveNode.type})`);
  
  // Заменяем на Code ноду с правильным экранированием
  const newNode = {
    ...saveNode,
    type: 'n8n-nodes-base.code',
    typeVersion: 2,
    parameters: {
      language: 'javaScript',
      jsCode: `// Batch UPSERT с правильным экранированием
const postgres = require('postgres');

const sql = postgres(
  'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require',
  { ssl: { rejectUnauthorized: false }, max: 1 }
);

const items = $input.all();
console.log(\`Saving \${items.length} bookings to DB...\`);

try {
  // Подготовка данных для batch insert
  const values = items.map(item => {
    const d = item.json;
    
    // Безопасное экранирование для postgres
    return sql\`(
      \${d.branch},
      \${d.booking_id || ''},
      \${d.number || ''},
      \${d.is_active || false},
      \${d.start_date || null},
      \${d.end_date || null},
      \${d.start_date_formatted || null},
      \${d.end_date_formatted || null},
      \${d.created_at || null},
      \${d.client_id || null},
      \${d.client_name || null},
      \${d.client_category || null},
      \${d.car_id || null},
      \${d.car_name || null},
      \${d.car_code || null},
      \${d.location_start || null},
      \${d.location_end || null},
      \${d.total || null},
      \${d.deposit || null},
      \${d.rental_cost || null},
      \${d.days || null},
      \${d.state || null},
      \${d.in_rent || false},
      \${d.archive || false},
      \${d.start_worker_id || null},
      \${d.end_worker_id || null},
      \${d.responsible || null},
      \${d.description || null},
      \${d.source || null},
      \${sql.json(d.data || {})},
      \${d.is_technical || false},
      \${d.technical_type || 'regular'},
      \${d.technical_purpose || null}
    )\`;
  });

  // Batch insert через postgres tagged template
  const result = await sql\`
    INSERT INTO bookings (
      branch, booking_id, number, is_active,
      start_date, end_date, start_date_formatted, end_date_formatted, created_at,
      client_id, client_name, client_category,
      car_id, car_name, car_code,
      location_start, location_end,
      total, deposit, rental_cost, days,
      state, in_rent, archive,
      start_worker_id, end_worker_id, responsible,
      description, source, data,
      is_technical, technical_type, technical_purpose
    )
    SELECT * FROM \${sql(values)}
    ON CONFLICT (branch, number) DO UPDATE SET
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
      is_technical = EXCLUDED.is_technical,
      technical_type = EXCLUDED.technical_type,
      technical_purpose = EXCLUDED.technical_purpose,
      updated_at = NOW()
    RETURNING id, branch, number
  \`;
  
  console.log(\`✓ Saved \${result.length} bookings\`);
  
  await sql.end();
  
  return [{ json: { saved: result.length, items: items.length } }];
  
} catch (error) {
  await sql.end();
  console.error('Save to DB error:', error);
  throw error;
}`
    }
  };
  
  // Заменяем ноду
  const nodeIndex = workflow.nodes.findIndex(n => n.name === 'Save to DB');
  workflow.nodes[nodeIndex] = newNode;
  
  console.log('\n✓ Нода заменена на Code с postgres библиотекой');
  console.log('  - Использует tagged templates для безопасного экранирования');
  console.log('  - Автоматически обрабатывает русские символы');
  console.log('  - Batch insert через SELECT * FROM');
  
  console.log('\nСохраняю изменения...');
  await updateWorkflow(workflow);
  console.log('✓ Workflow обновлён!');
  
  console.log('\n' + '='.repeat(70));
  console.log('ГОТОВО К ЗАПУСКУ');
  console.log('='.repeat(70));
  console.log('\nТеперь можно запустить workflow через UI:');
  console.log(`https://n8n.rentflow.rentals/workflow/${WORKFLOW_ID}`);
}

main().catch(err => {
  console.error('\n❌ ОШИБКА:', err.message);
  process.exit(1);
});

