#!/usr/bin/env node

import https from 'https';

const N8N_HOST = 'https://n8n.rentflow.rentals/api/v1';
const N8N_API_KEY = process.env.N8N_API_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI';
const WORKFLOW_ID = 'P3BnmX7Nrmh1cusF';

async function fetchLatestExecutionId() {
  return new Promise((resolve, reject) => {
    const url = `${N8N_HOST}/executions?workflowId=${WORKFLOW_ID}&limit=1`;

    https.get(url, {
      headers: {
        'X-N8N-API-KEY': N8N_API_KEY,
        'Accept': 'application/json'
      }
    }, (res) => {
      let data = '';

      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          const json = JSON.parse(data);
          if (json.data && json.data.length > 0) {
            resolve(json.data[0].id);
          } else {
            reject(new Error('Нет выполнений для указанного workflow'));
          }
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    }).on('error', reject);
  });
}

async function fetchExecution(executionId) {
  return new Promise((resolve, reject) => {
    const url = `${N8N_HOST}/executions/${executionId}?includeData=true`;
    
    https.get(url, {
      headers: {
        'X-N8N-API-KEY': N8N_API_KEY,
        'Accept': 'application/json'
      }
    }, (res) => {
      let data = '';
      
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          resolve(JSON.parse(data));
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    }).on('error', reject);
  });
}

async function main() {
  try {
    console.log('🔍 Получаю детали последнего выполнения workflow...\n');

    const latestId = await fetchLatestExecutionId();
    console.log('🆔 Последнее выполнение:', latestId, '\n');

    const response = await fetchExecution(latestId);
    const execution = response;

    console.log('📊 Execution:', execution.id);
    console.log('❌ Status:', execution.status);
    console.log('⏱️ Started:', execution.startedAt);
    console.log('⏹️ Stopped:', execution.stoppedAt);

    // Ищем ошибки в нодах
    const executionData = execution.executionData || execution.data;

    if (executionData && executionData.resultData) {
      const runData = executionData.resultData.runData;

      console.log('\n🔍 Проверяю ноды:\n');

      for (const [nodeName, nodeRuns] of Object.entries(runData)) {
        const lastRun = nodeRuns[nodeRuns.length - 1];

        if (lastRun.error) {
          console.log(`❌ Нода: ${nodeName}`);
          console.log(`   Ошибка: ${lastRun.error.message}`);
          if (lastRun.error.description) {
            console.log(`   Описание: ${lastRun.error.description}`);
          }
          if (lastRun.error.stack) {
            console.log(`   Stack:\n${lastRun.error.stack.split('\n').slice(0, 5).join('\n')}`);
          }
          console.log('');
        }
      }

      // Проверяем результаты из Save to DB
      if (runData['Save to DB']) {
        const saveRun = runData['Save to DB'][runData['Save to DB'].length - 1];
        if (saveRun.data && saveRun.data.main && saveRun.data.main[0]) {
          const output = saveRun.data.main[0][0];
          if (output && output.json) {
            console.log('💾 Результат Save to DB:');
            console.log(`   Всего: ${output.json.total || 0}`);
            console.log(`   Сохранено: ${output.json.success_count || 0}`);
            console.log(`   Ошибок: ${output.json.error_count || 0}`);
            
            if (output.json.errors && output.json.errors.length > 0) {
              console.log('\n🚨 Детали ошибок:');
              output.json.errors.forEach((err, i) => {
                console.log(`\n   Ошибка ${i + 1}:`);
                console.log(`   ${err.message}`);
                if (err.stack) {
                  console.log(`   Stack: ${err.stack.split('\n').slice(0, 3).join('\n   ')}`);
                }
              });
            }
          }
        }
      }
    }

    console.log('\n🔗 Открыть в n8n:');
    console.log(`   https://n8n.rentflow.rentals/workflow/${WORKFLOW_ID}/executions/${execution.id}`);

  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    process.exit(1);
  }
}

main();

