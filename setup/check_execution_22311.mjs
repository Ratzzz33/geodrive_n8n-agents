#!/usr/bin/env node

/**
 * Проверка execution 22311 на наличие искомых броней
 */

import fetch from 'node-fetch';
import { writeFileSync } from 'fs';

const N8N_HOST = 'https://n8n.rentflow.rentals/api/v1';
const N8N_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI';

async function checkExecution() {
  console.log('🔍 Проверка execution 22311...\n');

  try {
    const response = await fetch(`${N8N_HOST}/executions/22311?includeData=true`, {
      method: 'GET',
      headers: {
        'X-N8N-API-KEY': N8N_API_KEY,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to get execution: ${response.statusText}`);
    }

    const result = await response.json();
    
    // Сохраняем raw response для анализа
    writeFileSync('analysis/execution_22311_raw.json', JSON.stringify(result, null, 2));
    console.log('💾 Raw response сохранен в: analysis/execution_22311_raw.json\n');
    
    const execution = result.data || result;

    console.log(`📊 Execution ID: ${execution.id}`);
    console.log(`   Workflow: ${execution.workflowId}`);
    console.log(`   Status: ${execution.status}`);
    console.log(`   Started: ${execution.startedAt}`);
    console.log(`   Finished: ${execution.finishedAt || 'N/A'}`);

    // Ищем ноду Process All Bookings
    const processNode = execution.data?.resultData?.runData?.['Process All Bookings'];
    
    if (!processNode || !processNode[0]?.data?.main?.[0]) {
      console.log('\n⚠️  Нода "Process All Bookings" не найдена или пуста');
      return;
    }

    const bookings = processNode[0].data.main[0];
    console.log(`\n📋 Найдено броней: ${bookings.length}`);

    // Ищем искомую бронь Cruze 551 Hatch (513948, 28-29 Nov)
    console.log('\n🔍 Поиск Cruze 551 Hatch (rentprog_id: 513948, 28-29 Nov)...');
    
    const cruze = bookings.filter(b => {
      const json = b.json;
      return json.car_code?.includes('Cruze 551 Hatch') || 
             json.booking_id === '513948' ||
             json.rentprog_car_id === '513948';
    });

    if (cruze.length > 0) {
      console.log(`✅ Найдено ${cruze.length} совпадений:`);
      cruze.forEach((booking, i) => {
        const json = booking.json;
        console.log(`\n   ${i + 1}. Booking ID: ${json.booking_id || 'N/A'}`);
        console.log(`      Car: ${json.car_code || json.car_name}`);
        console.log(`      Start: ${json.start_date || json.start_at}`);
        console.log(`      End: ${json.end_date || json.end_at}`);
        console.log(`      Branch: ${json.branch}`);
        console.log(`      State: ${json.state}`);
        console.log(`      Number: ${json.number}`);
      });
    } else {
      console.log('❌ Cruze 551 Hatch не найден');
    }

    // Сохраняем полный execution в файл
    writeFileSync('analysis/execution_22311_full.json', JSON.stringify(execution, null, 2));
    console.log('\n💾 Полный execution сохранен в: analysis/execution_22311_full.json');

    // Статистика по филиалам
    console.log('\n📊 Статистика по филиалам:');
    const byBranch = {};
    bookings.forEach(b => {
      const branch = b.json.branch || 'unknown';
      byBranch[branch] = (byBranch[branch] || 0) + 1;
    });
    
    Object.entries(byBranch).forEach(([branch, count]) => {
      console.log(`   ${branch}: ${count} броней`);
    });

  } catch (error) {
    console.error('\n❌ Ошибка:', error.message);
    throw error;
  }
}

checkExecution().catch(console.error);

