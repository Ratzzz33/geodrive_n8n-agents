#!/usr/bin/env node

import fetch from 'node-fetch';

const N8N_HOST = 'https://n8n.rentflow.rentals/api/v1';
const N8N_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI';

const headers = {
  'X-N8N-API-KEY': N8N_API_KEY,
  'Content-Type': 'application/json',
};

const WORKFLOW_ID = 'rCCVTgR2FcWWRxpq';

async function main() {
  try {
    console.log('📥 Получение workflow...\n');
    
    const response = await fetch(`${N8N_HOST}/workflows/${WORKFLOW_ID}`, {
      headers,
    });
    
    if (!response.ok) {
      throw new Error(`Failed to get workflow: ${response.statusText}`);
    }
    
    const result = await response.json();
    const wfData = result.data || result;
    
    // Находим ноду "Save to DB"
    const saveNodeIndex = wfData.nodes.findIndex(n => n.name === 'Save to DB');
    
    if (saveNodeIndex === -1) {
      throw new Error('Нода "Save to DB" не найдена');
    }
    
    const saveNode = wfData.nodes[saveNodeIndex];
    
    console.log('🔍 Текущая нода "Save to DB":');
    console.log(`   Type: ${saveNode.type}`);
    console.log(`   Operation: ${saveNode.parameters.operation}`);
    console.log('');
    
    // SQL запрос с явным CAST для data
    const sqlQuery = `INSERT INTO bookings (
  rentprog_id,
  number,
  branch_id,
  branch,
  is_active,
  is_technical,
  start_date,
  end_date,
  start_date_formatted,
  end_date_formatted,
  start_at,
  end_at,
  created_at,
  client_name,
  client_category,
  car_name,
  car_code,
  rentprog_car_id,
  car_id,
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
  technical_type,
  technical_purpose,
  data,
  payload_json
)
VALUES (
  '{{ $json.rentprog_id }}',
  {{ $json.number ? $json.number : 'NULL' }},
  {{ $json.branch_id ? "'" + $json.branch_id + "'" : 'NULL' }},
  '{{ $json.branch }}',
  {{ $json.is_active }},
  {{ $json.is_technical }},
  {{ $json.start_date ? "'" + $json.start_date + "'" : 'NULL' }},
  {{ $json.end_date ? "'" + $json.end_date + "'" : 'NULL' }},
  {{ $json.start_date_formatted ? "'" + $json.start_date_formatted + "'" : 'NULL' }},
  {{ $json.end_date_formatted ? "'" + $json.end_date_formatted + "'" : 'NULL' }},
  {{ $json.start_at ? "'" + $json.start_at + "'" : 'NULL' }},
  {{ $json.end_at ? "'" + $json.end_at + "'" : 'NULL' }},
  {{ $json.created_at ? "'" + $json.created_at + "'" : 'NULL' }},
  '{{ ($json.client_name || "").replace(/'/g, "''") }}',
  {{ $json.client_category ? "'" + $json.client_category.replace(/'/g, "''") + "'" : 'NULL' }},
  '{{ ($json.car_name || "").replace(/'/g, "''") }}',
  {{ $json.car_code ? "'" + $json.car_code.replace(/'/g, "''") + "'" : 'NULL' }},
  {{ $json.rentprog_car_id ? "'" + $json.rentprog_car_id + "'" : 'NULL' }},
  {{ $json.car_id ? "'" + $json.car_id + "'" : 'NULL' }},
  {{ $json.location_start ? "'" + $json.location_start.replace(/'/g, "''") + "'" : 'NULL' }},
  {{ $json.location_end ? "'" + $json.location_end.replace(/'/g, "''") + "'" : 'NULL' }},
  {{ $json.total || 0 }},
  {{ $json.deposit || 0 }},
  {{ $json.rental_cost || 0 }},
  {{ $json.days || 0 }},
  {{ $json.state ? "'" + $json.state.replace(/'/g, "''") + "'" : 'NULL' }},
  {{ $json.in_rent || false }},
  {{ $json.archive || false }},
  {{ $json.start_worker_id ? $json.start_worker_id : 'NULL' }},
  {{ $json.end_worker_id ? $json.end_worker_id : 'NULL' }},
  {{ $json.responsible ? "'" + $json.responsible.replace(/'/g, "''") + "'" : 'NULL' }},
  {{ $json.description ? "'" + $json.description.replace(/'/g, "''") + "'" : 'NULL' }},
  {{ $json.source ? "'" + $json.source.replace(/'/g, "''") + "'" : 'NULL' }},
  {{ $json.technical_type ? "'" + $json.technical_type + "'" : 'NULL' }},
  {{ $json.technical_purpose ? "'" + $json.technical_purpose + "'" : 'NULL' }},
  '{{ $json.payload_json }}'::jsonb,
  '{{ $json.payload_json }}'
)
ON CONFLICT (rentprog_id)
DO UPDATE SET
  number = EXCLUDED.number,
  branch_id = EXCLUDED.branch_id,
  branch = EXCLUDED.branch,
  is_active = EXCLUDED.is_active,
  is_technical = EXCLUDED.is_technical,
  start_date = EXCLUDED.start_date,
  end_date = EXCLUDED.end_date,
  start_date_formatted = EXCLUDED.start_date_formatted,
  end_date_formatted = EXCLUDED.end_date_formatted,
  start_at = EXCLUDED.start_at,
  end_at = EXCLUDED.end_at,
  created_at = EXCLUDED.created_at,
  client_name = EXCLUDED.client_name,
  client_category = EXCLUDED.client_category,
  car_name = EXCLUDED.car_name,
  car_code = EXCLUDED.car_code,
  rentprog_car_id = EXCLUDED.rentprog_car_id,
  car_id = EXCLUDED.car_id,
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
  technical_type = EXCLUDED.technical_type,
  technical_purpose = EXCLUDED.technical_purpose,
  data = EXCLUDED.data,
  payload_json = EXCLUDED.payload_json,
  updated_at = NOW()
RETURNING *`;
    
    // Обновляем ноду
    saveNode.parameters = {
      operation: 'executeQuery',
      query: sqlQuery,
      options: {}
    };
    
    console.log('✅ Новая конфигурация ноды "Save to DB":');
    console.log(`   Operation: executeQuery`);
    console.log(`   Query: SQL с явным CAST payload_json::jsonb → data`);
    console.log('');
    
    // Сохраняем workflow
    console.log('💾 Сохранение изменений...\n');
    
    const updateResponse = await fetch(`${N8N_HOST}/workflows/${WORKFLOW_ID}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        name: wfData.name,
        nodes: wfData.nodes,
        connections: wfData.connections,
        settings: wfData.settings,
      }),
    });
    
    if (!updateResponse.ok) {
      const errorText = await updateResponse.text();
      throw new Error(`Failed to update workflow: ${updateResponse.statusText}\n${errorText}`);
    }
    
    console.log('✅ Workflow успешно обновлен!');
    console.log(`   URL: https://n8n.rentflow.rentals/workflow/${WORKFLOW_ID}`);
    console.log('');
    console.log('🎯 Теперь при следующем execution:');
    console.log('   payload_json (TEXT) будет преобразован в data (JSONB)');
    console.log('   через явный CAST в SQL: payload_json::jsonb');
    console.log('');
    console.log('⏰ Следующий execution через ~5 минут');
    console.log('   Проверь execution после запуска!');
    
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    process.exit(1);
  }
}

main();

