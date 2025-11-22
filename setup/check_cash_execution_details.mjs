#!/usr/bin/env node

import fetch from 'node-fetch';

const N8N_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI';
const EXECUTION_ID = '24862';

async function checkExecution() {
  try {
    console.log('🔍 Проверяю execution #24862...\n');
    
    const response = await fetch(`https://n8n.rentflow.rentals/api/v1/executions/${EXECUTION_ID}?includeData=true`, {
      headers: {
        'X-N8N-API-KEY': N8N_API_KEY
      }
    });
    
    const data = await response.json();
    
    console.log('📊 Execution Status:', data.status);
    console.log('');
    
    if (data.data && data.data.resultData && data.data.resultData.runData) {
      const runData = data.data.resultData.runData;
      
      // Найти ноды Save to History
      const saveNodes = Object.keys(runData).filter(key => key.includes('Save') || key.includes('History'));
      
      if (saveNodes.length > 0) {
        console.log('💾 Ноды сохранения:\n');
        saveNodes.forEach(nodeName => {
          const nodeData = runData[nodeName];
          if (Array.isArray(nodeData) && nodeData.length > 0) {
            const run = nodeData[0];
            if (run.data && run.data.main && run.data.main[0]) {
              console.log(`  📍 ${nodeName}:`);
              console.log(`     Обработано записей: ${run.data.main[0].length}`);
              
              // Показать пример записи
              if (run.data.main[0].length > 0) {
                const sample = run.data.main[0][0].json;
                console.log('     Пример записи:');
                console.log(`       operation_id: ${sample.operation_id || 'N/A'}`);
                console.log(`       branch: ${sample.branch || 'N/A'}`);
                console.log(`       description: ${sample.description ? sample.description.substring(0, 60) : 'N/A'}...`);
              }
              console.log('');
            }
          }
        });
      }
      
      // Найти ноды Format Result
      const formatNodes = Object.keys(runData).filter(key => key.includes('Format'));
      
      if (formatNodes.length > 0) {
        console.log('📋 Результаты обработки:\n');
        formatNodes.forEach(nodeName => {
          const nodeData = runData[nodeName];
          if (Array.isArray(nodeData) && nodeData.length > 0) {
            const run = nodeData[0];
            if (run.data && run.data.main && run.data.main[0] && run.data.main[0][0]) {
              const result = run.data.main[0][0].json;
              console.log(`  📍 ${nodeName}:`);
              console.log(`     Сохранено: ${result.saved_count || 0}`);
              console.log(`     Ошибок: ${result.error_count || 0}`);
              if (result.message) {
                console.log(`     Сообщение: ${result.message}`);
              }
              console.log('');
            }
          }
        });
      }
      
      // Показать все ноды с количеством items
      console.log('📊 Все ноды execution:\n');
      Object.keys(runData).forEach(nodeName => {
        const nodeData = runData[nodeName];
        if (Array.isArray(nodeData) && nodeData.length > 0) {
          const run = nodeData[0];
          if (run.data && run.data.main && run.data.main[0]) {
            console.log(`  ${nodeName}: ${run.data.main[0].length} items`);
          }
        }
      });
    }
    
  } catch (error) {
    console.error('❌ Ошибка:', error);
    process.exit(1);
  }
}

checkExecution();

