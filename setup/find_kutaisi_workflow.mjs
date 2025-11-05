#!/usr/bin/env node
import fetch from 'node-fetch';

const N8N_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI';
const N8N_HOST = 'https://n8n.rentflow.rentals/api/v1';

async function findKutaisiWorkflow() {
  console.log('🔍 Поиск Kutaisi Processor Rentprog workflow...\n');
  
  try {
    const response = await fetch(`${N8N_HOST}/workflows`, {
      headers: { 'X-N8N-API-KEY': N8N_API_KEY }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to get workflows: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    const workflows = data.data || data;
    
    console.log(`Найдено workflows: ${workflows.length}\n`);
    
    // Найти Kutaisi
    const kutaisi = workflows.find(w => w.name.includes('Kutaisi') && w.name.includes('Processor'));
    
    if (!kutaisi) {
      console.error('❌ Kutaisi Processor Rentprog не найден!');
      console.log('\nВсе processor workflows:');
      workflows
        .filter(w => w.name.includes('Processor'))
        .forEach(w => console.log(`  - ${w.name} (${w.id}) - Active: ${w.active}`));
      return;
    }
    
    console.log('✅ Найден:');
    console.log(`   Имя: ${kutaisi.name}`);
    console.log(`   ID: ${kutaisi.id}`);
    console.log(`   Активен: ${kutaisi.active}`);
    console.log(`   URL: https://n8n.rentflow.rentals/workflow/${kutaisi.id}`);
    
    // Получить детали workflow
    console.log('\n📋 Проверка Get RentProg Token node...');
    const detailsResponse = await fetch(`${N8N_HOST}/workflows/${kutaisi.id}`, {
      headers: { 'X-N8N-API-KEY': N8N_API_KEY }
    });
    
    if (!detailsResponse.ok) {
      throw new Error(`Failed to get workflow details: ${detailsResponse.status}`);
    }
    
    const detailsData = await detailsResponse.json();
    const workflow = detailsData.data || detailsData;
    
    const tokenNode = workflow.nodes.find(n => 
      n.name === 'Get RentProg Token' || 
      n.id === 'get-token' ||
      n.name.includes('Token')
    );
    
    if (tokenNode) {
      console.log(`   Node найден: ${tokenNode.name} (${tokenNode.id})`);
      
      // Извлечь токен из кода
      const tokenMatch = tokenNode.parameters.jsCode.match(/const companyToken = '([^']+)';/);
      if (tokenMatch) {
        const currentToken = tokenMatch[1];
        console.log(`\n   Текущий токен: ${currentToken}`);
        console.log(`   Правильный:    5599ebb7b94827fdfd49ca3a5b7e259cfa99d8ea78edeb50`);
        
        if (currentToken === '5599ebb7b94827fdfd49ca3a5b7e259cfa99d8ea78edeb50') {
          console.log('\n   ✅ Токен ПРАВИЛЬНЫЙ!');
        } else {
          console.log('\n   ❌ Токен НЕПРАВИЛЬНЫЙ! Требуется обновление.');
        }
      } else {
        console.log('   ⚠️ Токен не найден в коде node');
      }
    } else {
      console.log('   ❌ Get RentProg Token node не найден!');
      console.log('\n   Доступные nodes:');
      workflow.nodes.forEach(n => console.log(`     - ${n.name} (${n.type})`));
    }
    
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    process.exit(1);
  }
}

findKutaisiWorkflow();

