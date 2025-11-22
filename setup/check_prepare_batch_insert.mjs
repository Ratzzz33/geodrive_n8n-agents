#!/usr/bin/env node

import fetch from 'node-fetch';

const N8N_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI';
const EXECUTION_ID = '24880';
const WORKFLOW_ID = 'w8g8cJb0ccReaqIE';

async function checkNode() {
  try {
    console.log('🔍 Проверяю ноду "Prepare Batch Insert"...\n');
    
    // Получить workflow
    const wfResponse = await fetch(`https://n8n.rentflow.rentals/api/v1/workflows/${WORKFLOW_ID}`, {
      headers: {
        'X-N8N-API-KEY': N8N_API_KEY
      }
    });
    
    const workflow = await wfResponse.json();
    
    // Найти ноду Prepare Batch Insert
    const node = workflow.nodes.find(n => n.name === 'Prepare Batch Insert');
    
    if (node) {
      console.log('📋 Нода найдена:', node.name);
      console.log('🔧 Тип:', node.type);
      console.log('');
      
      if (node.type === 'n8n-nodes-base.code') {
        console.log('💻 Код ноды:\n');
        console.log('─'.repeat(80));
        console.log(node.parameters.jsCode);
        console.log('─'.repeat(80));
      }
    } else {
      console.log('❌ Нода "Prepare Batch Insert" не найдена');
    }
    
    // Получить execution данные
    console.log('\n📊 Данные execution:\n');
    
    const execResponse = await fetch(`https://n8n.rentflow.rentals/api/v1/executions/${EXECUTION_ID}?includeData=true`, {
      headers: {
        'X-N8N-API-KEY': N8N_API_KEY
      }
    });
    
    const execData = await execResponse.json();
    const runData = execData.data.resultData.runData;
    
    // Проверить Check DB Errors (до Prepare Batch Insert)
    if (runData['Check DB Errors']) {
      const checkNode = runData['Check DB Errors'][0];
      if (checkNode.data && checkNode.data.main && checkNode.data.main[0]) {
        const items = checkNode.data.main[0];
        
        // Найти 3 операции
        const missingIds = ['1864454', '1863796', '1863792'];
        const foundItems = items.filter(item => {
          return item.json && missingIds.includes(String(item.json.payment_id));
        });
        
        console.log('📍 В "Check DB Errors" найдено операций:', foundItems.length);
        console.log('');
        
        foundItems.forEach(item => {
          console.log(`   ID: ${item.json.payment_id}`);
          console.log(`   type: ${item.json.type}`);
          console.log(`   group: ${item.json.group}`);
          console.log(`   subgroup: ${item.json.subgroup}`);
          console.log(`   car_id: ${item.json.car_id}`);
          console.log(`   sum: ${item.json.sum}`);
          console.log(`   cash: ${item.json.cash}`);
          console.log(`   cashless: ${item.json.cashless}`);
          console.log(`   description: ${item.json.description ? item.json.description.substring(0, 60) : 'N/A'}...`);
          console.log('');
        });
      }
    }
    
    // Проверить Prepare Batch Insert
    if (runData['Prepare Batch Insert']) {
      const prepNode = runData['Prepare Batch Insert'][0];
      if (prepNode.data && prepNode.data.main && prepNode.data.main[0]) {
        const items = prepNode.data.main[0];
        console.log('📍 В "Prepare Batch Insert" items:', items.length);
        
        if (items.length > 0 && items[0].json) {
          console.log('\n   Структура данных:');
          console.log('   Keys:', Object.keys(items[0].json).join(', '));
          
          // Если есть массив payments
          if (items[0].json.payments && Array.isArray(items[0].json.payments)) {
            console.log(`\n   Массив payments: ${items[0].json.payments.length} элементов`);
            
            // Проверить наличие наших ID
            const missingIds = ['1864454', '1863796', '1863792'];
            const foundInBatch = items[0].json.payments.filter(p => 
              missingIds.includes(String(p.payment_id))
            );
            
            console.log(`   Найдено наших операций: ${foundInBatch.length}`);
            
            if (foundInBatch.length > 0) {
              console.log('\n   ✅ Операции ПРИСУТСТВУЮТ в Prepare Batch Insert:');
              foundInBatch.forEach(p => {
                console.log(`      ID: ${p.payment_id}`);
              });
            } else {
              console.log('\n   ❌ Операции ОТСУТСТВУЮТ в Prepare Batch Insert');
            }
          }
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Ошибка:', error);
    process.exit(1);
  }
}

checkNode();

