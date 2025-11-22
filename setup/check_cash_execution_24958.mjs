#!/usr/bin/env node

import postgres from 'postgres';
import fetch from 'node-fetch';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';
const N8N_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI';
const EXECUTION_ID = '24958';

// Наши 3 отсутствующие операции
const missingIds = ['1864454', '1863796', '1863792'];

async function check() {
  const sql = postgres(CONNECTION_STRING, {
    max: 1,
    ssl: { rejectUnauthorized: false },
    connect_timeout: 10
  });

  try {
    console.log('🔍 Проверяю execution #24958...\n');
    
    // Получить execution
    const response = await fetch(`https://n8n.rentflow.rentals/api/v1/executions/${EXECUTION_ID}?includeData=true`, {
      headers: {
        'X-N8N-API-KEY': N8N_API_KEY
      }
    });
    
    const execData = await response.json();
    
    console.log('📊 Execution Status:', execData.status);
    console.log('⏱️ Started:', execData.startedAt);
    console.log('⏱️ Stopped:', execData.stoppedAt);
    console.log('');
    
    if (execData.data?.resultData?.runData) {
      const runData = execData.data.resultData.runData;
      
      // Проверить Format Result
      if (runData['Format Result']) {
        const formatNode = runData['Format Result'][0];
        if (formatNode.data?.main?.[0]?.[0]?.json) {
          const result = formatNode.data.main[0][0].json;
          
          console.log('📋 Результат из Format Result:');
          console.log(`   Успешно: ${result.saved_count} операций`);
          console.log(`   Ошибок: ${result.error_count}`);
          console.log('');
          
          if (result.by_branch) {
            console.log('   По филиалам:');
            Object.entries(result.by_branch).forEach(([branch, stats]) => {
              console.log(`     ${branch}: ${stats.success} ✓ / ${stats.error} ✗`);
            });
            console.log('');
          }
          
          if (result.error_count > 0 && result.error_details) {
            console.log('   ❌ Детали ошибок:');
            Object.entries(result.error_details).forEach(([branch, errors]) => {
              errors.forEach(err => {
                console.log(`     ${branch}: ${err.message}`);
              });
            });
            console.log('');
          }
        }
      }
    }
    
    console.log('═'.repeat(80));
    console.log('\n🗄️ Проверяю данные в таблице payments...\n');
    
    // Проверить 3 отсутствующие операции
    const foundOps = [];
    for (const id of missingIds) {
      const result = await sql`
        SELECT 
          p.rp_payment_id,
          p.branch,
          p.payment_type,
          p.amount,
          p.rp_car_id,
          p.rp_client_id,
          p.rp_user_id,
          p.created_at,
          CASE WHEN p.rp_car_id IS NOT NULL THEN 'связан' ELSE 'нет' END as car_linked,
          CASE WHEN p.rp_client_id IS NOT NULL THEN 'связан' ELSE 'нет' END as client_linked,
          CASE WHEN p.rp_user_id IS NOT NULL THEN 'связан' ELSE 'нет' END as user_linked
        FROM payments p
        WHERE p.rp_payment_id = ${id}
      `;
      
      if (result.length > 0) {
        foundOps.push(result[0]);
      }
    }
    
    console.log(`📋 Проверка 3 ранее отсутствующих операций:\n`);
    
    if (foundOps.length === 0) {
      console.log('   ❌ НИ ОДНА операция не найдена в БД!');
      console.log('   Операции НЕ СОХРАНИЛИСЬ.');
    } else {
      console.log(`   ✅ Найдено в БД: ${foundOps.length} из 3\n`);
      
      foundOps.forEach((op, index) => {
        console.log(`   [${index + 1}] ID: ${op.rp_payment_id}`);
        console.log(`       Branch: ${op.branch}`);
        console.log(`       Type: ${op.payment_type}`);
        console.log(`       Amount: ${op.amount}`);
        console.log(`       Связи:`);
        console.log(`         Машина (rp_car_id=${op.rp_car_id}): ${op.car_linked}`);
        console.log(`         Клиент (rp_client_id=${op.rp_client_id}): ${op.client_linked}`);
        console.log(`         Сотрудник (rp_user_id=${op.rp_user_id}): ${op.user_linked}`);
        console.log('');
      });
      
      const notFound = missingIds.filter(id => !foundOps.find(op => op.rp_payment_id === id));
      if (notFound.length > 0) {
        console.log(`   ❌ Не найдены: ${notFound.join(', ')}`);
        console.log('');
      }
    }
    
    console.log('═'.repeat(80));
    console.log('\n📊 Статистика по связям в таблице payments:\n');
    
    // Общая статистика по связям
    const stats = await sql`
      SELECT 
        COUNT(*) as total,
        COUNT(rp_car_id) as with_car,
        COUNT(rp_client_id) as with_client,
        COUNT(rp_user_id) as with_user,
        COUNT(*) FILTER (WHERE rp_car_id IS NOT NULL AND rp_client_id IS NOT NULL) as with_car_and_client,
        COUNT(*) FILTER (WHERE rp_car_id IS NULL AND rp_client_id IS NULL AND rp_user_id IS NULL) as no_links
      FROM payments
      WHERE created_at >= NOW() - INTERVAL '1 day'
    `;
    
    const s = stats[0];
    console.log(`   Всего операций за последние 24 часа: ${s.total}`);
    console.log(`   С машиной: ${s.with_car} (${((s.with_car / s.total) * 100).toFixed(1)}%)`);
    console.log(`   С клиентом: ${s.with_client} (${((s.with_client / s.total) * 100).toFixed(1)}%)`);
    console.log(`   С сотрудником: ${s.with_user} (${((s.with_user / s.total) * 100).toFixed(1)}%)`);
    console.log(`   С машиной И клиентом: ${s.with_car_and_client} (${((s.with_car_and_client / s.total) * 100).toFixed(1)}%)`);
    console.log(`   Без связей: ${s.no_links} (${((s.no_links / s.total) * 100).toFixed(1)}%)`);
    console.log('');
    
    // Примеры операций с полными связями
    const withLinks = await sql`
      SELECT 
        p.rp_payment_id,
        p.payment_type,
        p.amount,
        p.rp_car_id,
        p.rp_client_id,
        p.rp_user_id
      FROM payments p
      WHERE p.created_at >= NOW() - INTERVAL '1 day'
        AND p.rp_car_id IS NOT NULL
        AND p.rp_client_id IS NOT NULL
      LIMIT 5
    `;
    
    if (withLinks.length > 0) {
      console.log('   📋 Примеры операций с полными связями (машина + клиент):\n');
      withLinks.forEach((op, index) => {
        console.log(`   [${index + 1}] ID: ${op.rp_payment_id}`);
        console.log(`       Type: ${op.payment_type}`);
        console.log(`       Amount: ${op.amount}`);
        console.log(`       Car ID: ${op.rp_car_id}`);
        console.log(`       Client ID: ${op.rp_client_id}`);
        console.log(`       User ID: ${op.rp_user_id || 'N/A'}`);
        console.log('');
      });
    }
    
    console.log('═'.repeat(80));
    console.log('\n✅ ИТОГО:\n');
    console.log(`Execution #24958: ${execData.status}`);
    console.log(`3 отсутствующие операции: ${foundOps.length === 3 ? '✅ ВСЕ НАЙДЕНЫ' : `❌ ${3 - foundOps.length} не найдено`}`);
    console.log(`Связи с entities: ${((s.with_car / s.total) * 100).toFixed(1)}% с машинами, ${((s.with_client / s.total) * 100).toFixed(1)}% с клиентами`);
    
  } catch (error) {
    console.error('❌ Ошибка:', error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

check();

