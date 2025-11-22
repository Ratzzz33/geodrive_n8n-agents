#!/usr/bin/env node
/**
 * Проверка выполнения workflow в n8n
 */

const N8N_HOST = process.env.N8N_HOST || 'https://n8n.rentflow.rentals/api/v1';
const N8N_API_KEY = process.env.N8N_API_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI';
const WORKFLOW_ID = process.argv[2] || 'NAn9IcFpFuUFib4W';
const EXECUTION_ID = process.argv[3] || '11626';

async function checkExecution() {
  console.log(`🔍 Проверяю выполнение workflow ${WORKFLOW_ID}, execution ${EXECUTION_ID}...\n`);

  try {
    // Получаем информацию о выполнении
    const response = await fetch(`${N8N_HOST}/executions/${EXECUTION_ID}`, {
      headers: {
        'X-N8N-API-KEY': N8N_API_KEY
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Ошибка получения execution: ${response.status} - ${errorText}`);
    }

    const execution = await response.json();
    const executionData = execution.data || execution;

    console.log(`📊 Статус выполнения:`);
    console.log(`   ID: ${executionData.id}`);
    console.log(`   Статус: ${executionData.finished ? '✅ Завершено' : '⏳ В процессе'}`);
    console.log(`   Успешно: ${executionData.finished ? (executionData.mode === 'error' ? '❌ Ошибка' : '✅ Успешно') : '⏳ В процессе'}`);
    console.log(`   Начато: ${executionData.startedAt || 'не указано'}`);
    console.log(`   Завершено: ${executionData.stoppedAt || 'не завершено'}`);
    console.log(`   Режим: ${executionData.mode || 'не указан'}\n`);

    // Получаем детальную информацию о выполнении
    if (executionData.data) {
      console.log(`📋 Данные выполнения:\n`);
      
      if (executionData.data.resultData) {
        const resultData = executionData.data.resultData;
        
        if (resultData.runData) {
          console.log(`🔹 Выполненные ноды:\n`);
          const nodeNames = Object.keys(resultData.runData);
          console.log(`   Всего нод выполнено: ${nodeNames.length}\n`);
          
          nodeNames.forEach(nodeName => {
            const nodeData = resultData.runData[nodeName];
            if (nodeData && nodeData.length > 0) {
              const lastRun = nodeData[nodeData.length - 1];
              console.log(`   📌 ${nodeName}:`);
              console.log(`      Статус: ${lastRun.executionStatus || 'не указан'}`);
              console.log(`      Время: ${lastRun.startTime || 'не указано'} - ${lastRun.stopTime || 'не указано'}`);
              
              if (lastRun.error) {
                console.log(`      ❌ ОШИБКА:`);
                console.log(`         ${JSON.stringify(lastRun.error, null, 2)}`);
              }
              
              if (lastRun.data && lastRun.data.main && lastRun.data.main.length > 0) {
                const output = lastRun.data.main[0];
                if (output.length > 0) {
                  const firstItem = output[0];
                  const dataPreview = JSON.stringify(firstItem.json || firstItem, null, 2);
                  console.log(`      ✅ Данные получены (${output.length} элементов)`);
                  if (dataPreview.length < 500) {
                    console.log(`      ${dataPreview}`);
                  } else {
                    console.log(`      ${dataPreview.substring(0, 500)}...`);
                  }
                } else {
                  console.log(`      ⚠️  Нет данных на выходе`);
                }
              } else {
                console.log(`      ⚠️  Нет данных`);
              }
              console.log('');
            }
          });
        } else {
          console.log(`⚠️  Нет данных о выполнении нод (runData отсутствует)`);
        }

        if (resultData.error) {
          console.log(`\n❌ Ошибка выполнения:`);
          console.log(JSON.stringify(resultData.error, null, 2));
        }
      } else {
        console.log(`⚠️  Нет данных о результате выполнения (resultData отсутствует)`);
        console.log(`\nПолная структура executionData.data:`);
        console.log(JSON.stringify(executionData.data, null, 2).substring(0, 1000));
      }
    } else {
      console.log(`⚠️  Нет данных выполнения (data отсутствует)`);
      console.log(`\nПолная структура execution:`);
      console.log(JSON.stringify(executionData, null, 2).substring(0, 1000));
    }

    // Если есть workflowExecutionData, показываем его
    if (executionData.workflowData) {
      console.log(`\n📄 Workflow: ${executionData.workflowData.name}`);
      console.log(`   Нод: ${executionData.workflowData.nodes?.length || 0}`);
    }

  } catch (error) {
    console.error('❌ Ошибка при проверке execution:');
    console.error(error.message);
    if (error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }
    process.exit(1);
  }
}

checkExecution();

