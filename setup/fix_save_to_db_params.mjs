#!/usr/bin/env node
/**
 * Исправление Save to DB ноды - использование параметризованного запроса
 * Согласно .cursorrules: использовать стандартные n8n ноды
 * Проблема: русские символы ломают SQL при прямой подстановке
 * Решение: Postgres нода с параметрами ($1, $2, ...)
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
  console.log('ИСПРАВЛЕНИЕ SAVE TO DB - ПАРАМЕТРИЗОВАННЫЙ ЗАПРОС');
  console.log('='.repeat(70));
  
  const workflow = await getWorkflow();
  console.log(`\nWorkflow: "${workflow.name}"`);
  
  // Найти Save to DB ноду
  const saveNode = workflow.nodes.find(n => n.name === 'Save to DB');
  if (!saveNode) {
    throw new Error('Save to DB нода не найдена!');
  }
  
  console.log(`\nНайдена нода: ${saveNode.name} (${saveNode.type})`);
  
  // Используем стандартную Postgres ноду с параметрами
  const newNode = {
    ...saveNode,
    type: 'n8n-nodes-base.postgres',
    typeVersion: 2.5,
    parameters: {
      operation: 'executeQuery',
      query: `INSERT INTO bookings (
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
      ) VALUES (
        $1, $2, $3, $4,
        $5, $6, $7, $8, $9,
        $10, $11, $12,
        $13, $14, $15,
        $16, $17,
        $18, $19, $20, $21,
        $22, $23, $24,
        $25, $26, $27,
        $28, $29, $30::jsonb,
        $31, $32, $33
      )
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
      RETURNING id, branch, number`,
      queryParameters: `={{ {
        "parameters": [
          $json.branch,
          $json.booking_id,
          $json.number,
          $json.is_active,
          $json.start_date,
          $json.end_date,
          $json.start_date_formatted,
          $json.end_date_formatted,
          $json.created_at,
          $json.client_id,
          $json.client_name,
          $json.client_category,
          $json.car_id,
          $json.car_name,
          $json.car_code,
          $json.location_start,
          $json.location_end,
          $json.total,
          $json.deposit,
          $json.rental_cost,
          $json.days,
          $json.state,
          $json.in_rent,
          $json.archive,
          $json.start_worker_id,
          $json.end_worker_id,
          $json.responsible,
          $json.description,
          $json.source,
          JSON.stringify($json.data || {}),
          $json.is_technical,
          $json.technical_type,
          $json.technical_purpose
        ]
      } }}`,
      options: {}
    }
  };
  
  // Заменяем ноду
  const nodeIndex = workflow.nodes.findIndex(n => n.name === 'Save to DB');
  workflow.nodes[nodeIndex] = newNode;
  
  console.log('\n✓ Нода заменена на Postgres с параметрами');
  console.log('  - Использует $1, $2, ... для безопасной подстановки');
  console.log('  - Автоматически экранирует все символы включая русские');
  console.log('  - Стандартная n8n нода (согласно .cursorrules)');
  
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

