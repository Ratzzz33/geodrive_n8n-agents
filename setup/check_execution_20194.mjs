#!/usr/bin/env node
/**
 * Проверка execution 20194 в n8n workflow rCCVTgR2FcWWRxpq
 * Проверяем, получали ли мы данные о брони Cruze 551 Hatch (28-29 ноября)
 */

import fetch from 'node-fetch';

const N8N_HOST = 'https://n8n.rentflow.rentals/api/v1';
const N8N_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI';

const WORKFLOW_ID = 'rCCVTgR2FcWWRxpq';
const EXECUTION_ID = '20194';

async function checkExecution() {
  try {
    console.log('🔍 Проверка execution в n8n...\n');
    console.log(`Workflow ID: ${WORKFLOW_ID}`);
    console.log(`Execution ID: ${EXECUTION_ID}\n`);
    console.log('━'.repeat(80));

    // Получаем execution
    const response = await fetch(
      `${N8N_HOST}/executions/${EXECUTION_ID}?includeData=true`,
      {
        headers: {
          'X-N8N-API-KEY': N8N_API_KEY,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const execution = await response.json();
    
    // Выводим структуру для отладки
    console.log('\n📋 Структура ответа:');
    console.log(`   Ключи верхнего уровня: ${Object.keys(execution).join(', ')}`);
    
    if (execution.data) {
      console.log(`   Ключи data: ${Object.keys(execution.data).join(', ')}`);
    }
    
    // Сохраняем полные данные сразу для анализа
    const fs = await import('fs');
    fs.writeFileSync(
      'setup/execution_20194_raw.json',
      JSON.stringify(execution, null, 2),
      'utf-8'
    );
    console.log('✅ Сырые данные сохранены в setup/execution_20194_raw.json\n');
    
    const execData = execution.data || {};
    const meta = execution;
    
    console.log('\n📋 Общая информация:');
    console.log(`   Статус: ${meta.finished ? '✅ Завершено' : '⏳ В процессе'}`);
    console.log(`   Успешно: ${meta.finished ? (meta.status === 'success' ? '✅' : '❌') : 'N/A'}`);
    console.log(`   Режим: ${meta.mode || 'N/A'}`);
    console.log(`   Начало: ${meta.startedAt || 'N/A'}`);
    console.log(`   Окончание: ${meta.stoppedAt || 'N/A'}`);
    
    if (execution.workflowData) {
      console.log(`\n📊 Ноды в workflow: ${execution.workflowData.nodes?.length || 0}`);
    }

    // Получаем детальную информацию о каждой ноде
    console.log('\n\n🔍 Проверка данных каждой ноды:\n');
    console.log('═'.repeat(80));

    const resultData = execData.resultData || execData.data?.resultData;
    const runData = resultData?.runData || resultData;
    
    if (runData) {
      // Проверяем каждую ноду
      for (const [nodeName, nodeRuns] of Object.entries(runData)) {
        if (Array.isArray(nodeRuns) && nodeRuns.length > 0) {
          const mainData = nodeRuns[0];
          
          console.log(`\n📦 Нода: ${nodeName}`);
          console.log(`   Тип: ${mainData.nodeType || 'N/A'}`);
          
          if (mainData.data && mainData.data.main) {
            const mainOutput = mainData.data.main;
            if (Array.isArray(mainOutput) && mainOutput.length > 0) {
              const items = mainOutput[0];
              console.log(`   Количество элементов: ${items.length}`);
              
              // Показываем первые несколько элементов
              const sampleSize = Math.min(3, items.length);
              for (let i = 0; i < sampleSize; i++) {
                const item = items[i];
                console.log(`\n   Элемент ${i + 1}:`);
                
                // Ищем информацию о Cruze 551
                const itemStr = JSON.stringify(item.json || item, null, 2);
                if (itemStr.includes('551') || itemStr.includes('Cruze') || itemStr.includes('cruze')) {
                  console.log(`   ⚠️  НАЙДЕНА ИНФОРМАЦИЯ О CRUZE 551!`);
                  console.log(`   Данные: ${JSON.stringify(item.json || item, null, 2).substring(0, 500)}...`);
                }
                
                // Показываем ключевые поля
                if (item.json) {
                  const keys = Object.keys(item.json);
                  console.log(`   Поля: ${keys.slice(0, 10).join(', ')}${keys.length > 10 ? '...' : ''}`);
                  
                  // Проверяем наличие полей, связанных с бронями
                  if (item.json.id || item.json.booking_id || item.json.car_id || item.json.car_name) {
                    console.log(`   📋 Похоже на данные брони:`);
                    if (item.json.id) console.log(`      ID: ${item.json.id}`);
                    if (item.json.booking_id) console.log(`      Booking ID: ${item.json.booking_id}`);
                    if (item.json.car_id) console.log(`      Car ID: ${item.json.car_id}`);
                    if (item.json.car_name) console.log(`      Car Name: ${item.json.car_name}`);
                    if (item.json.start_date || item.json.start_at) {
                      console.log(`      Start: ${item.json.start_date || item.json.start_at}`);
                    }
                    if (item.json.end_date || item.json.end_at) {
                      console.log(`      End: ${item.json.end_date || item.json.end_at}`);
                    }
                  }
                }
              }
              
              if (items.length > sampleSize) {
                console.log(`   ... и еще ${items.length - sampleSize} элементов`);
              }
            }
          }
        }
      }
    }

    // Проверяем ошибки
    if (resultData?.error) {
      console.log('\n\n❌ ОШИБКИ В EXECUTION:');
      console.log('═'.repeat(80));
      const errors = resultData.error;
      for (const [nodeName, errorData] of Object.entries(errors)) {
        console.log(`\n🚨 Нода: ${nodeName}`);
        if (Array.isArray(errorData) && errorData.length > 0) {
          const error = errorData[0];
          console.log(`   Сообщение: ${error.message || JSON.stringify(error)}`);
          if (error.stack) {
            console.log(`   Stack: ${error.stack.substring(0, 200)}...`);
          }
        }
      }
    }

    // Сохраняем полные данные для анализа
    console.log('\n\n💾 Сохранение полных данных в файл...');
    fs.writeFileSync(
      'setup/execution_20194_full.json',
      JSON.stringify(execution, null, 2),
      'utf-8'
    );
    console.log('✅ Данные сохранены в setup/execution_20194_full.json');

  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    if (error.stack) {
      console.error('Stack:', error.stack);
    }
  }
}

checkExecution();

