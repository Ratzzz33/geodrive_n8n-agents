#!/usr/bin/env node

// Заменяет Code ноду "Save to DB" на стандартную Postgres ноду

const N8N_API_KEY = process.env.N8N_API_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI';
const N8N_HOST = 'https://n8n.rentflow.rentals';
const WORKFLOW_ID = 'P3BnmX7Nrmh1cusF';

async function main() {
  try {
    console.log('🔧 Замена Code ноды на Postgres ноду...\n');
    
    // Получаем workflow через API
    const getResponse = await fetch(`${N8N_HOST}/api/v1/workflows/${WORKFLOW_ID}`, {
      headers: {
        'X-N8N-API-KEY': N8N_API_KEY,
        'Accept': 'application/json'
      }
    });
    
    if (!getResponse.ok) {
      throw new Error(`HTTP ${getResponse.status}: ${await getResponse.text()}`);
    }
    
    const responseData = await getResponse.json();
    const workflow = responseData.data || responseData;
    
    console.log('✅ Workflow получен:', workflow.name);
    
    // Находим ноду "Save to DB"
    const saveNodeIndex = workflow.nodes.findIndex(n => n.name === 'Save to DB');
    
    if (saveNodeIndex === -1) {
      console.error('❌ Нода "Save to DB" не найдена!');
      return;
    }
    
    const oldNode = workflow.nodes[saveNodeIndex];
    console.log('✅ Нода найдена, тип:', oldNode.type);
    
    // Создаем новую Postgres ноду
    const newNode = {
      name: 'Save to DB',
      type: 'n8n-nodes-base.postgres',
      typeVersion: 2.6,
      position: oldNode.position,
      parameters: {
        operation: 'executeQuery',
        query: `INSERT INTO bookings (
  branch, number, is_active,
  start_date, end_date, start_date_formatted, end_date_formatted,
  client_id, client_name, client_category,
  car_id, car_name, car_code,
  location_start, location_end,
  total, deposit, rental_cost, days,
  state, in_rent, archive,
  start_worker_id, end_worker_id, responsible,
  description, source, data,
  is_technical, technical_type, technical_purpose
)
VALUES (
  '{{ $json.branch }}',
  '{{ $json.booking_id }}',
  {{ $json.is_active }},
  {{ $json.start_date ? "'" + $json.start_date + "'" : "NULL" }},
  {{ $json.end_date ? "'" + $json.end_date + "'" : "NULL" }},
  {{ $json.start_date_formatted ? "'" + $json.start_date_formatted + "'" : "NULL" }},
  {{ $json.end_date_formatted ? "'" + $json.end_date_formatted + "'" : "NULL" }},
  {{ $json.client_id ? "'" + $json.client_id + "'" : "NULL" }},
  {{ $json.client_name ? "'" + $json.client_name.replace(/'/g, "''") + "'" : "NULL" }},
  {{ $json.client_category ? "'" + $json.client_category + "'" : "NULL" }},
  {{ $json.car_id ? "'" + $json.car_id + "'" : "NULL" }},
  {{ $json.car_name ? "'" + $json.car_name.replace(/'/g, "''") + "'" : "NULL" }},
  {{ $json.car_code ? "'" + $json.car_code + "'" : "NULL" }},
  {{ $json.location_start ? "'" + $json.location_start.replace(/'/g, "''") + "'" : "NULL" }},
  {{ $json.location_end ? "'" + $json.location_end.replace(/'/g, "''") + "'" : "NULL" }},
  {{ $json.total || "NULL" }},
  {{ $json.deposit || "NULL" }},
  {{ $json.rental_cost || "NULL" }},
  {{ $json.days || "NULL" }},
  {{ $json.state ? "'" + $json.state + "'" : "NULL" }},
  {{ $json.in_rent || "NULL" }},
  {{ $json.archive || "NULL" }},
  {{ $json.start_worker_id ? "'" + $json.start_worker_id + "'" : "NULL" }},
  {{ $json.end_worker_id ? "'" + $json.end_worker_id + "'" : "NULL" }},
  {{ $json.responsible ? "'" + $json.responsible.replace(/'/g, "''") + "'" : "NULL" }},
  {{ $json.description ? "'" + $json.description.replace(/'/g, "''") + "'" : "NULL" }},
  {{ $json.source ? "'" + $json.source + "'" : "NULL" }},
  '{{ JSON.stringify($json.data || {}) }}'::jsonb,
  {{ $json.is_technical || false }},
  '{{ $json.technical_type || "regular" }}',
  {{ $json.technical_purpose ? "'" + $json.technical_purpose + "'" : "NULL" }}
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
  is_technical = EXCLUDED.is_technical,
  technical_type = EXCLUDED.technical_type,
  technical_purpose = EXCLUDED.technical_purpose,
  updated_at = NOW()
RETURNING id, branch, number;`,
        options: {}
      },
      credentials: {
        postgres: {
          id: '8CeAd5YHHbHxpXI2',
          name: 'Postgres account'
        }
      }
    };
    
    // Заменяем ноду
    workflow.nodes[saveNodeIndex] = newNode;
    
    // Подготавливаем данные для обновления
    const updateData = {
      name: workflow.name,
      nodes: workflow.nodes,
      connections: workflow.connections,
      settings: workflow.settings
    };
    
    console.log('\n💾 Сохраняю изменения...');
    
    const putResponse = await fetch(`${N8N_HOST}/api/v1/workflows/${WORKFLOW_ID}`, {
      method: 'PUT',
      headers: {
        'X-N8N-API-KEY': N8N_API_KEY,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(updateData)
    });
    
    if (!putResponse.ok) {
      const errorText = await putResponse.text();
      throw new Error(`HTTP ${putResponse.status}: ${errorText}`);
    }
    
    console.log('\n✅ Успешно!');
    console.log('✅ Code нода заменена на Postgres ноду');
    console.log('\n⚠️ Внимание: теперь каждая бронь будет сохраняться отдельным запросом');
    console.log('   Это медленнее, но надежнее и работает в n8n');
    console.log('\n🔗 Проверить:');
    console.log(`   ${N8N_HOST}/workflow/${WORKFLOW_ID}`);
    
  } catch (error) {
    console.error('\n❌ Ошибка:', error.message);
    process.exit(1);
  }
}

main();

