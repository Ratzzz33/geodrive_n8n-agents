#!/usr/bin/env node
import fetch from 'node-fetch';

const N8N_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI';
const N8N_HOST = 'https://n8n.rentflow.rentals/api/v1';

const KUTAISI_WORKFLOW_ID = 'gJPvJwGQSi8455s9'; // ID workflow Kutaisi Processor Rentprog
const CORRECT_TOKEN = '5599ebb7b94827fdfd49ca3a5b7e259cfa99d8ea78edeb50';

async function fixKutaisiToken() {
  console.log('🔧 Исправление токена для Kutaisi Processor Rentprog\n');
  
  try {
    // 1. Получить текущий workflow
    console.log('1️⃣ Получение текущего workflow...');
    const response = await fetch(`${N8N_HOST}/workflows/${KUTAISI_WORKFLOW_ID}`, {
      headers: { 'X-N8N-API-KEY': N8N_API_KEY }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to get workflow: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    const workflow = data.data || data;
    
    console.log(`   ✓ Workflow получен: ${workflow.name}`);
    
    // 2. Найти и обновить Get RentProg Token node
    console.log('\n2️⃣ Обновление токена в Get RentProg Token node...');
    const tokenNode = workflow.nodes.find(n => n.name === 'Get RentProg Token' || n.id === 'get-token');
    
    if (!tokenNode) {
      console.error('   ❌ Node "Get RentProg Token" не найден!');
      return;
    }
    
    console.log(`   Текущий код (первые 200 символов):`);
    console.log(`   ${tokenNode.parameters.jsCode.substring(0, 200)}...`);
    
    // Найти старый токен в коде
    const oldTokenMatch = tokenNode.parameters.jsCode.match(/const companyToken = '([^']+)';/);
    if (oldTokenMatch) {
      const oldToken = oldTokenMatch[1];
      console.log(`\n   Старый токен: ${oldToken}`);
      console.log(`   Новый токен:  ${CORRECT_TOKEN}`);
      
      // Заменить токен
      tokenNode.parameters.jsCode = tokenNode.parameters.jsCode.replace(
        /const companyToken = '[^']+';/,
        `const companyToken = '${CORRECT_TOKEN}';`
      );
      
      console.log(`   ✓ Токен обновлён`);
    } else {
      console.error('   ❌ Не найден токен в коде!');
      return;
    }
    
    // 3. Подготовить данные для обновления (только необходимые поля)
    const updateData = {
      name: workflow.name,
      nodes: workflow.nodes,
      connections: workflow.connections,
      settings: workflow.settings || {}
    };
    
    // Добавить опциональные поля если они есть
    if (workflow.staticData) updateData.staticData = workflow.staticData;
    if (workflow.tags && workflow.tags.length > 0) updateData.tags = workflow.tags;
    
    // 4. Обновить workflow
    console.log('\n3️⃣ Сохранение изменений...');
    const updateResponse = await fetch(`${N8N_HOST}/workflows/${KUTAISI_WORKFLOW_ID}`, {
      method: 'PUT',
      headers: {
        'X-N8N-API-KEY': N8N_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(updateData)
    });
    
    if (!updateResponse.ok) {
      const error = await updateResponse.text();
      throw new Error(`Failed to update workflow: ${updateResponse.status}\n${error}`);
    }
    
    console.log('   ✓ Workflow обновлён');
    
    console.log('\n✅ Токен для Kutaisi исправлен!');
    console.log(`\n📝 Правильный токен: ${CORRECT_TOKEN}`);
    console.log(`🔗 Workflow URL: https://n8n.rentflow.rentals/workflow/${KUTAISI_WORKFLOW_ID}`);
    
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    process.exit(1);
  }
}

fixKutaisiToken();

