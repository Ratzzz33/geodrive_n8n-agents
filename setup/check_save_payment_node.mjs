#!/usr/bin/env node

import fetch from 'node-fetch';

const N8N_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI';
const EXECUTION_ID = '24880';
const WORKFLOW_ID = 'w8g8cJb0ccReaqIE';

async function checkSaveNode() {
  try {
    console.log('🔍 Проверяю ноду "Save Payment to DB"...\n');
    
    // Получить workflow
    const wfResponse = await fetch(`https://n8n.rentflow.rentals/api/v1/workflows/${WORKFLOW_ID}`, {
      headers: {
        'X-N8N-API-KEY': N8N_API_KEY
      }
    });
    
    const workflow = await wfResponse.json();
    
    // Найти ноду Save Payment to DB
    const node = workflow.nodes.find(n => n.name === 'Save Payment to DB');
    
    if (node) {
      console.log('📋 Нода найдена:', node.name);
      console.log('🔧 Тип:', node.type);
      console.log('📝 Operation:', node.parameters.operation);
      console.log('');
      
      if (node.parameters.query) {
        console.log('💾 SQL Query:\n');
        console.log('─'.repeat(80));
        console.log(node.parameters.query);
        console.log('─'.repeat(80));
        console.log('');
      }
      
      console.log('⚙️ Параметры ноды:');
      console.log(JSON.stringify(node.parameters, null, 2).substring(0, 1000));
      console.log('');
    }
    
    // Проверить execution данные
    console.log('\n📊 Данные из execution:\n');
    
    const execResponse = await fetch(`https://n8n.rentflow.rentals/api/v1/executions/${EXECUTION_ID}?includeData=true`, {
      headers: {
        'X-N8N-API-KEY': N8N_API_KEY
      }
    });
    
    const execData = await execResponse.json();
    const runData = execData.data.resultData.runData;
    
    // Проверить Prepare Batch Insert
    if (runData['Prepare Batch Insert']) {
      const prepNode = runData['Prepare Batch Insert'][0];
      if (prepNode.data && prepNode.data.main && prepNode.data.main[0]) {
        const item = prepNode.data.main[0][0];
        
        if (item && item.json) {
          console.log('📍 Output из "Prepare Batch Insert":');
          console.log(`   total_items: ${item.json.total_items}`);
          console.log(`   batch_values length: ${item.json.batch_values ? item.json.batch_values.length : 0} chars`);
          
          // Проверить наличие наших ID в batch SQL
          if (item.json.batch_values) {
            const missingIds = ['1864454', '1863796', '1863792'];
            const foundIds = missingIds.filter(id => item.json.batch_values.includes(id));
            
            console.log(`\n   Поиск ID в batch SQL:`);
            missingIds.forEach(id => {
              const found = item.json.batch_values.includes(id);
              console.log(`     ${id}: ${found ? '✅ ПРИСУТСТВУЕТ' : '❌ ОТСУТСТВУЕТ'}`);
            });
            
            // Показать фрагмент с одним из ID
            if (foundIds.length > 0) {
              const id = foundIds[0];
              const idx = item.json.batch_values.indexOf(id);
              const snippet = item.json.batch_values.substring(Math.max(0, idx - 200), idx + 400);
              console.log(`\n   Фрагмент batch SQL вокруг ID ${id}:`);
              console.log('   ' + '─'.repeat(70));
              console.log('   ...' + snippet + '...');
              console.log('   ' + '─'.repeat(70));
            }
          }
        }
      }
    }
    
    // Проверить Save Payment to DB
    if (runData['Save Payment to DB']) {
      const saveNode = runData['Save Payment to DB'][0];
      console.log('\n📍 Output из "Save Payment to DB":');
      
      if (saveNode.error) {
        console.log('   ❌ ОШИБКА:', saveNode.error.message || saveNode.error);
        if (saveNode.error.description) {
          console.log('   Описание:', saveNode.error.description);
        }
      }
      
      if (saveNode.data && saveNode.data.main && saveNode.data.main[0]) {
        console.log(`   Успешно выполнено: ${saveNode.data.main[0].length} items`);
        
        if (saveNode.data.main[0][0] && saveNode.data.main[0][0].json) {
          console.log('   Результат:');
          console.log('  ', JSON.stringify(saveNode.data.main[0][0].json, null, 2).substring(0, 500));
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Ошибка:', error);
    process.exit(1);
  }
}

checkSaveNode();

