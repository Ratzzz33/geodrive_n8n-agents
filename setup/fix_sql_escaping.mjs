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
    
    console.log('🔧 Исправление SQL запроса с правильным экранированием...\n');
    
    // Упрощенный SQL без сложных expression в строках
    // Используем $1, $2 и т.д. как параметры - НЕТ, Postgres нода не поддерживает параметризованные запросы
    // Вместо этого используем безопасное экранирование через PostgreSQL функцию quote_literal
    
    // РЕШЕНИЕ: Вернемся к upsert, но с правильным маппингом data через Code ноду
    saveNode.parameters = {
      operation: 'upsert',
      schema: {
        '__rl': true,
        'mode': 'list',
        'value': 'public'
      },
      table: {
        '__rl': true,
        'mode': 'list',
        'value': 'bookings'
      },
      columns: {
        'mappingMode': 'defineBelow',
        'value': {
          'rentprog_id': '={{ $json.rentprog_id }}',
          'number': '={{ $json.number }}',
          'branch_id': '={{ $json.branch_id }}',
          'branch': '={{ $json.branch }}',
          'is_active': '={{ $json.is_active }}',
          'is_technical': '={{ $json.is_technical }}',
          'start_date': '={{ $json.start_date }}',
          'end_date': '={{ $json.end_date }}',
          'start_date_formatted': '={{ $json.start_date_formatted }}',
          'end_date_formatted': '={{ $json.end_date_formatted }}',
          'start_at': '={{ $json.start_at }}',
          'end_at': '={{ $json.end_at }}',
          'created_at': '={{ $json.created_at }}',
          'client_name': '={{ $json.client_name }}',
          'client_category': '={{ $json.client_category }}',
          'car_name': '={{ $json.car_name }}',
          'car_code': '={{ $json.car_code }}',
          'rentprog_car_id': '={{ $json.rentprog_car_id }}',
          'car_id': '={{ $json.car_id }}',
          'location_start': '={{ $json.location_start }}',
          'location_end': '={{ $json.location_end }}',
          'total': '={{ $json.total }}',
          'deposit': '={{ $json.deposit }}',
          'rental_cost': '={{ $json.rental_cost }}',
          'days': '={{ $json.days }}',
          'state': '={{ $json.state }}',
          'in_rent': '={{ $json.in_rent }}',
          'archive': '={{ $json.archive }}',
          'start_worker_id': '={{ $json.start_worker_id }}',
          'end_worker_id': '={{ $json.end_worker_id }}',
          'responsible': '={{ $json.responsible }}',
          'description': '={{ $json.description }}',
          'source': '={{ $json.source }}',
          'technical_type': '={{ $json.technical_type }}',
          'technical_purpose': '={{ $json.technical_purpose }}',
          'data': '={{ $json.data }}',  // ← ОБЪЕКТ, не строка!
          'payload_json': '={{ $json.payload_json }}'
        },
        'matchingColumns': ['rentprog_id']
      }
    };
    
    console.log('✅ Новая конфигурация:');
    console.log('   Operation: upsert (вернули обратно)');
    console.log('   data: маппится как объект $json.data');
    console.log('   Postgres нода САМА сделает сериализацию в JSONB');
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
    console.log('🎯 Теперь data маппится как $json.data (объект)');
    console.log('   Postgres нода автоматически сериализует объект → JSONB');
    console.log('');
    console.log('⏰ Следующий execution через ~5 минут');
    
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    process.exit(1);
  }
}

main();

