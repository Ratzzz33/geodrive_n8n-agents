#!/usr/bin/env node

import fetch from 'node-fetch';

const N8N_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI';

async function checkExecution() {
  try {
    const response = await fetch('https://n8n.rentflow.rentals/api/v1/executions/24830?includeData=true', {
      headers: {
        'X-N8N-API-KEY': N8N_API_KEY
      }
    });

    const data = await response.json();

    console.log('📊 Execution Status:', data.status);
    console.log('⏱️ Started:', data.startedAt);
    console.log('⏱️ Stopped:', data.stoppedAt);
    console.log('');

    if (data.data && data.data.resultData) {
      const resultData = data.data.resultData;

      if (resultData.error) {
        console.log('❌ ERROR DETAILS:');
        console.log('   Message:', resultData.error.message || 'N/A');
        console.log('   Name:', resultData.error.name || 'N/A');
        console.log('   Stack:', resultData.error.stack ? resultData.error.stack.substring(0, 500) : 'N/A');
        console.log('');
      }

      if (resultData.runData) {
        console.log('📋 Nodes Execution:');
        Object.entries(resultData.runData).forEach(([nodeName, nodeData]) => {
          const runs = Array.isArray(nodeData) ? nodeData : [nodeData];
          runs.forEach((run, idx) => {
            console.log(`\n   Node: ${nodeName} [run ${idx + 1}]`);
            if (run.error) {
              console.log(`   ❌ Error:`, run.error.message || run.error);
            } else if (run.data) {
              const itemCount = run.data.main?.[0]?.length || 0;
              console.log(`   ✅ Items: ${itemCount}`);
            }
          });
        });
      }
    }

    // Записать полный вывод в файл для анализа
    const fs = await import('fs');
    fs.writeFileSync('execution_24830_full.json', JSON.stringify(data, null, 2));
    console.log('\n💾 Полный вывод сохранен в execution_24830_full.json');

  } catch (error) {
    console.error('❌ Ошибка:', error);
  }
}

checkExecution();

