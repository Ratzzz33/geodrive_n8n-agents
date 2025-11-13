#!/usr/bin/env node

import https from 'https';

const N8N_HOST = 'https://n8n.rentflow.rentals/api/v1';
const N8N_API_KEY = process.env.N8N_API_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI';
const WORKFLOW_ID = 'P3BnmX7Nrmh1cusF';

async function request(method, path, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, N8N_HOST);
    
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'X-N8N-API-KEY': N8N_API_KEY,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    };
    
    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(JSON.parse(data));
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    });
    
    req.on('error', reject);
    
    if (body) {
      req.write(JSON.stringify(body));
    }
    
    req.end();
  });
}

async function main() {
  try {
    console.log('🔧 Получаю текущий workflow...\n');
    
    const response = await request('GET', `/workflows/${WORKFLOW_ID}`);
    const workflow = response.data || response;
    
    console.log('✅ Workflow получен:', workflow.name);
    
    // Находим ноду "Save to DB"
    const saveNode = workflow.nodes.find(n => n.name === 'Save to DB');
    
    if (!saveNode) {
      console.error('❌ Нода "Save to DB" не найдена!');
      return;
    }
    
    console.log('✅ Нода "Save to DB" найдена\n');
    console.log('🔄 Заменяю Code ноду на Postgres ноду...\n');
    
    // Заменяем Code ноду на Postgres ноду
    const postgresNode = {
      ...saveNode,
      name: 'Save to DB',
      type: 'n8n-nodes-base.postgres',
      typeVersion: 2.6,
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
          {{ $json.branch }},
          {{ $json.booking_id }},
          {{ $json.is_active }},
          {{ $json.start_date || null }},
          {{ $json.end_date || null }},
          {{ $json.start_date_formatted || null }},
          {{ $json.end_date_formatted || null }},
          {{ $json.client_id || null }},
          {{ $json.client_name || null }},
          {{ $json.client_category || null }},
          {{ $json.car_id || null }},
          {{ $json.car_name || null }},
          {{ $json.car_code || null }},
          {{ $json.location_start || null }},
          {{ $json.location_end || null }},
          {{ $json.total || null }},
          {{ $json.deposit || null }},
          {{ $json.rental_cost || null }},
          {{ $json.days || null }},
          {{ $json.state || null }},
          {{ $json.in_rent || null }},
          {{ $json.archive || null }},
          {{ $json.start_worker_id || null }},
          {{ $json.end_worker_id || null }},
          {{ $json.responsible || null }},
          {{ $json.description || null }},
          {{ $json.source || null }},
          {{ $json.data }},
          {{ $json.is_technical || false }},
          {{ $json.technical_type || 'regular' }},
          {{ $json.technical_purpose || null }}
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
          data = EXCLUDED.data::jsonb,
          is_technical = EXCLUDED.is_technical,
          technical_type = EXCLUDED.technical_type,
          technical_purpose = EXCLUDED.technical_purpose,
          updated_at = NOW()
        RETURNING id, branch, number`,
        options: {
          nodeVersion: 2
        }
      },
      credentials: {
        postgres: {
          id: '8CeAd5YHHbHxpXI2',
          name: 'Postgres account'
        }
      }
    };
    
    // Обновляем ноду в массиве
    const nodeIndex = workflow.nodes.findIndex(n => n.name === 'Save to DB');
    workflow.nodes[nodeIndex] = postgresNode;
    
    // Подготавливаем данные для обновления
    const updateData = {
      name: workflow.name,
      nodes: workflow.nodes,
      connections: workflow.connections,
      settings: workflow.settings
    };
    
    console.log('💾 Сохраняю изменения...\n');
    
    await request('PUT', `/workflows/${WORKFLOW_ID}`, updateData);
    
    console.log('✅ Workflow обновлен!');
    console.log('✅ Нода "Save to DB" теперь использует стандартную Postgres ноду');
    console.log('\n🔗 Проверить:');
    console.log(`   https://n8n.rentflow.rentals/workflow/${WORKFLOW_ID}`);
    
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    process.exit(1);
  }
}

main();

