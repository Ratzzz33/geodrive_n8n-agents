#!/usr/bin/env node

import fetch from 'node-fetch';

const N8N_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI';
const WORKFLOW_ID = 'w8g8cJb0ccReaqIE';

const newCode = `// Собираем ВСЕ responses со всех 4 филиалов и распаковываем payments
const processed = [];

function processItems(items, branchName) {
  if (!items || items.length === 0) {
    processed.push({ json: { branch: branchName, error: true, error_reason: 'no_response', error_message: 'Нет ответа от API' } });
    return;
  }
  
  items.forEach((item) => {
    if (item.error) {
      processed.push({ json: { branch: branchName, error: true, error_reason: 'http_error', error_message: item.error.message || 'HTTP ошибка' } });
      return;
    }
    if (item.json?.error) {
      processed.push({ json: { branch: branchName, error: true, error_reason: 'api_error', error_message: item.json.error.message || JSON.stringify(item.json.error) } });
      return;
    }
    if (!item.json || (item.json.statusCode && item.json.statusCode >= 400)) {
      processed.push({ json: { branch: branchName, error: true, error_reason: 'timeout_or_error', error_message: \`HTTP \${item.json?.statusCode || 'timeout'}\` } });
      return;
    }
    
    let payments = [];
    if (item.json?.counts?.data && Array.isArray(item.json.counts.data)) payments = item.json.counts.data;
    else if (item.json?.counts && Array.isArray(item.json.counts)) payments = item.json.counts;
    else if (item.json?.data && Array.isArray(item.json.data)) payments = item.json.data;
    else if (Array.isArray(item.json)) payments = item.json;
    
    if (payments.length === 0) {
      processed.push({ json: { branch: branchName, status: 'no_data' } });
      return;
    }
    
    payments.forEach((paymentItem) => {
      const payment = paymentItem.attributes || paymentItem;
      processed.push({
        json: {
          branch: branchName,
          type: 'company_cash',
          payment_id: payment.id || null,
          sum: payment.sum || 0,
          cash: payment.cash || 0,
          cashless: payment.cashless || 0,
          group: payment.group || 'unknown',
          subgroup: payment.subgroup || null,
          description: payment.description || '',
          rp_car_id: payment.car_id || null,
          booking_id: payment.booking_id || null,
          rp_client_id: payment.client_id || null,
          rp_user_id: payment.user_id || null,
          created_at: payment.created_at || new Date().toISOString(),
          raw_data: JSON.stringify(payment)
        }
      });
    });
  });
}

processItems($('Get Tbilisi').all(), 'tbilisi');
processItems($('Get Batumi').all(), 'batumi');
processItems($('Get Kutaisi').all(), 'kutaisi');
processItems($('Get Service').all(), 'service-center');

return processed;`;

async function fix() {
  try {
    console.log('🔧 Обновляю ноду "Merge & Process"...\n');
    
    const response = await fetch(`https://n8n.rentflow.rentals/api/v1/workflows/${WORKFLOW_ID}`, {
      headers: {
        'X-N8N-API-KEY': N8N_API_KEY
      }
    });
    
    const workflow = await response.json();
    
    // Найти и обновить ноду
    const node = workflow.nodes.find(n => n.name === 'Merge & Process');
    if (!node) {
      throw new Error('Нода "Merge & Process" не найдена');
    }
    
    node.parameters.jsCode = newCode;
    
    console.log('   ✅ Код обновлен');
    console.log('');
    console.log('💾 Сохраняю...\n');
    
    // Удаляем системные поля
    const updateData = {
      name: workflow.name,
      nodes: workflow.nodes,
      connections: workflow.connections,
      settings: workflow.settings
    };
    
    const updateResponse = await fetch(`https://n8n.rentflow.rentals/api/v1/workflows/${WORKFLOW_ID}`, {
      method: 'PUT',
      headers: {
        'X-N8N-API-KEY': N8N_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(updateData)
    });
    
    if (!updateResponse.ok) {
      const errorText = await updateResponse.text();
      throw new Error(`Failed: ${updateResponse.statusText}. ${errorText}`);
    }
    
    console.log('✅ Успешно обновлено!');
    console.log('');
    console.log('📋 Изменения в "Merge & Process":');
    console.log('   car_id → rp_car_id');
    console.log('   client_id → rp_client_id');
    console.log('   user_id → rp_user_id');
    console.log('');
    console.log('🔗 https://n8n.rentflow.rentals/workflow/' + WORKFLOW_ID);
    
  } catch (error) {
    console.error('❌ Ошибка:', error);
    process.exit(1);
  }
}

fix();

