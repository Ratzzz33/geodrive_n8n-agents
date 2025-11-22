#!/usr/bin/env node
/**
 * Проверка execution 20301 в n8n workflow rCCVTgR2FcWWRxpq
 * Проверяем наличие брони №513948 (Cruze 551 Hatch, 24-27 ноября)
 */

import fetch from 'node-fetch';
import postgres from 'postgres';

const N8N_HOST = 'https://n8n.rentflow.rentals/api/v1';
const N8N_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI';
const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const WORKFLOW_ID = 'rCCVTgR2FcWWRxpq';
const EXECUTION_ID = '20301';
const BOOKING_ID = '513948'; // RentProg ID

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

async function checkExecution() {
  try {
    console.log('🔍 Проверка execution 20301 и брони №513948\n');
    console.log('━'.repeat(80));

    // 1. Получаем execution
    console.log('📋 Получение execution из n8n...');
    const response = await fetch(
      `${N8N_HOST}/executions/${EXECUTION_ID}`,
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
    const execData = execution.data || execution;
    
    console.log(`✅ Execution получен`);
    console.log(`   Статус: ${execData.finished ? '✅ Завершено' : '⏳ В процессе'}`);
    console.log(`   Успешно: ${execData.status === 'success' ? '✅' : '❌'}`);
    console.log(`   Начало: ${execData.startedAt || 'N/A'}`);
    console.log(`   Окончание: ${execData.stoppedAt || 'N/A'}\n`);

    // 2. Ищем бронь №513948 в execution
    console.log('🔍 Поиск брони №513948 в execution...');
    const executionStr = JSON.stringify(execution);
    const foundInExecution = executionStr.includes(BOOKING_ID);
    
    if (foundInExecution) {
      console.log(`✅ Бронь №${BOOKING_ID} НАЙДЕНА в execution!`);
      
      // Ищем детали
      const bookingMatches = executionStr.match(new RegExp(`"id":\\s*${BOOKING_ID}[^}]*"car_code":\\s*"[^"]*"`, 'g'));
      if (bookingMatches) {
        console.log(`   Найдено упоминаний: ${bookingMatches.length}`);
      }
      
      // Ищем в нодах
      const resultData = execData.data?.resultData?.runData;
      if (resultData) {
        console.log('\n📦 Проверка нод:');
        for (const [nodeName, nodeData] of Object.entries(resultData)) {
          if (Array.isArray(nodeData) && nodeData.length > 0) {
            const nodeStr = JSON.stringify(nodeData);
            if (nodeStr.includes(BOOKING_ID)) {
              console.log(`   ✅ ${nodeName}: найдена бронь №${BOOKING_ID}`);
              
              // Пытаемся найти детали
              const mainData = nodeData[0];
              if (mainData.data?.main) {
                const mainOutput = mainData.data.main;
                if (Array.isArray(mainOutput) && mainOutput.length > 0) {
                  const items = mainOutput[0];
                  for (const item of items) {
                    const itemStr = JSON.stringify(item);
                    if (itemStr.includes(BOOKING_ID)) {
                      console.log(`      Данные: ${JSON.stringify(item.json || item, null, 2).substring(0, 300)}...`);
                      break;
                    }
                  }
                }
              }
            }
          }
        }
      }
    } else {
      console.log(`❌ Бронь №${BOOKING_ID} НЕ НАЙДЕНА в execution`);
    }

    // 3. Проверяем БД
    console.log('\n\n💾 Проверка БД...');
    console.log('━'.repeat(80));
    
    // Ищем через external_refs
    const bookingInDB = await sql`
      SELECT 
        b.id,
        b.number,
        b.start_date,
        b.end_date,
        b.start_at,
        b.end_at,
        b.car_name,
        b.car_code,
        b.state,
        b.branch,
        b.location_start,
        b.location_end,
        er.external_id as rentprog_id,
        er.data as rentprog_data
      FROM bookings b
      LEFT JOIN external_refs er ON er.entity_id = b.id 
        AND er.entity_type = 'booking'
        AND er.system = 'rentprog'
      WHERE er.external_id = ${BOOKING_ID}
         OR b.number = ${BOOKING_ID}
      ORDER BY b.created_at DESC
      LIMIT 5
    `;
    
    if (bookingInDB.length > 0) {
      console.log(`✅ Бронь №${BOOKING_ID} НАЙДЕНА в БД!`);
      for (const booking of bookingInDB) {
        console.log(`\n   📋 Детали брони:`);
        console.log(`      ID в БД: ${booking.id}`);
        console.log(`      Номер: ${booking.number || 'N/A'}`);
        console.log(`      RentProg ID: ${booking.rentprog_id || 'N/A'}`);
        console.log(`      Машина: ${booking.car_name || 'N/A'} (${booking.car_code || 'N/A'})`);
        console.log(`      Период: ${booking.start_date || booking.start_at} - ${booking.end_date || booking.end_at}`);
        console.log(`      Локация: ${booking.location_start || 'N/A'} → ${booking.location_end || 'N/A'}`);
        console.log(`      Статус: ${booking.state || 'N/A'}`);
        console.log(`      Филиал: ${booking.branch || 'N/A'}`);
      }
    } else {
      console.log(`❌ Бронь №${BOOKING_ID} НЕ НАЙДЕНА в БД`);
      
      // Проверяем, может быть есть через car_code
      const cruzeBookings = await sql`
        SELECT 
          b.id,
          b.number,
          b.start_date,
          b.end_date,
          b.start_at,
          b.end_at,
          b.car_code,
          b.state,
          er.external_id as rentprog_id
        FROM bookings b
        LEFT JOIN external_refs er ON er.entity_id = b.id 
          AND er.entity_type = 'booking'
          AND er.system = 'rentprog'
        WHERE b.car_code = 'Cruze 551 Hatch'
          AND (
            (b.start_at >= '2025-11-24'::timestamptz AND b.start_at <= '2025-11-27'::timestamptz)
            OR (b.start_date::timestamptz >= '2025-11-24'::timestamptz AND b.start_date::timestamptz <= '2025-11-27'::timestamptz)
          )
        ORDER BY COALESCE(b.start_at, b.start_date::timestamptz) DESC
        LIMIT 5
      `;
      
      if (cruzeBookings.length > 0) {
        console.log(`\n   ⚠️  Найдены другие брони Cruze 551 в этот период:`);
        for (const b of cruzeBookings) {
          console.log(`      - №${b.number || 'N/A'} (RentProg: ${b.rentprog_id || 'N/A'}) ${b.start_date} - ${b.end_date} [${b.state || 'N/A'}]`);
        }
      }
    }

    // 4. Итоговая сводка
    console.log('\n\n' + '═'.repeat(80));
    console.log('📊 ИТОГОВАЯ СВОДКА');
    console.log('═'.repeat(80));
    console.log(`\nБронь №${BOOKING_ID} (Cruze 551 Hatch, 24-27 ноября):`);
    console.log(`   В execution 20301: ${foundInExecution ? '✅ НАЙДЕНА' : '❌ НЕ НАЙДЕНА'}`);
    console.log(`   В БД: ${bookingInDB.length > 0 ? '✅ НАЙДЕНА' : '❌ НЕ НАЙДЕНА'}`);
    
    if (foundInExecution && bookingInDB.length === 0) {
      console.log(`\n⚠️  ПРОБЛЕМА: Бронь была в execution, но не попала в БД!`);
      console.log(`   Возможные причины:`);
      console.log(`   - Ошибка при сохранении в ноде "Save to DB"`);
      console.log(`   - Проблема с маппингом car_id (car_id = null)`);
      console.log(`   - Ошибка FK constraint (client_id не найден)`);
    } else if (!foundInExecution && bookingInDB.length > 0) {
      console.log(`\n⚠️  Бронь есть в БД, но не была в этом execution`);
      console.log(`   Возможно, она была обработана в другом execution`);
    } else if (!foundInExecution && bookingInDB.length === 0) {
      console.log(`\n⚠️  Бронь отсутствует и в execution, и в БД`);
      console.log(`   Возможно:`);
      console.log(`   - Бронь не была активна на момент выполнения workflow`);
      console.log(`   - Бронь была создана после выполнения execution`);
      console.log(`   - Бронь находится в другом филиале`);
    }

  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    if (error.stack) {
      console.error('Stack:', error.stack);
    }
  } finally {
    await sql.end();
  }
}

checkExecution();

