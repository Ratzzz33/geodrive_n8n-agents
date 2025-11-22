#!/usr/bin/env node

/**
 * Verify that events were actually applied to target tables (cars, payments)
 */

import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

async function verifyEvents() {
  const sql = postgres(CONNECTION_STRING, {
    max: 1,
    ssl: { rejectUnauthorized: false },
    connect_timeout: 10
  });

  try {
    console.log('🔍 Проверка применения изменений в целевых таблицах...\n');

    // 1. Check mileage change for car 61936
    console.log('1️⃣ Проверка изменения mileage для авто 61936:\n');
    const car61936Ref = await sql`
      SELECT entity_id
      FROM external_refs
      WHERE system = 'rentprog'
        AND entity_type = 'car'
        AND external_id = '61936'
      LIMIT 1
    `;

    if (car61936Ref.length > 0) {
      const car61936 = await sql`
        SELECT 
          rentprog_id,
          data->>'mileage' as mileage,
          updated_at
        FROM cars
        WHERE id = ${car61936Ref[0].entity_id}
      `;

      if (car61936.length > 0) {
        console.log(`   RentProg ID: ${car61936[0].rentprog_id}`);
        console.log(`   mileage: ${car61936[0].mileage || 'NULL'}`);
        console.log(`   Обновлено: ${car61936[0].updated_at}`);
        
        if (car61936[0].mileage === '118830') {
          console.log('   ✅ mileage = 118830 (изменение применено!)');
        } else {
          console.log(`   ⚠️ mileage = "${car61936[0].mileage}" (ожидалось 118830)`);
        }
      }
    }
    console.log('');

    // 2. Check company_id change for car 55207
    console.log('2️⃣ Проверка изменения company_id для авто 55207:\n');
    const car55207Ref = await sql`
      SELECT entity_id
      FROM external_refs
      WHERE system = 'rentprog'
        AND entity_type = 'car'
        AND external_id = '55207'
      LIMIT 1
    `;

    if (car55207Ref.length > 0) {
      const car55207 = await sql`
        SELECT 
          rentprog_id,
          data->>'company_id' as company_id,
          updated_at
        FROM cars
        WHERE id = ${car55207Ref[0].entity_id}
      `;

      if (car55207.length > 0) {
        console.log(`   RentProg ID: ${car55207[0].rentprog_id}`);
        console.log(`   company_id: ${car55207[0].company_id || 'NULL'}`);
        console.log(`   Обновлено: ${car55207[0].updated_at}`);
        
        if (car55207[0].company_id === '9247') {
          console.log('   ✅ company_id = 9247 (изменение применено!)');
        } else {
          console.log(`   ⚠️ company_id = "${car55207[0].company_id}" (ожидалось 9247)`);
        }
      }
    }
    console.log('');

    // 3. Check payments
    console.log('3️⃣ Проверка платежей:\n');
    const paymentIds = ['1866155', '1866156', '1865532', '1865442', '1865401'];
    
    for (const paymentId of paymentIds) {
      const paymentRef = await sql`
        SELECT entity_id
        FROM external_refs
        WHERE system = 'rentprog'
          AND entity_type = 'payment'
          AND external_id = ${paymentId}
        LIMIT 1
      `;

      if (paymentRef.length > 0) {
        const payment = await sql`
          SELECT 
            rp_payment_id,
            amount,
            currency,
            payment_date,
            created_at
          FROM payments
          WHERE id = ${paymentRef[0].entity_id}
        `;

        if (payment.length > 0) {
          console.log(`   Платёж №${paymentId}:`);
          console.log(`     ✅ Найден в БД`);
          console.log(`     Сумма: ${payment[0].amount} ${payment[0].currency || 'GEL'}`);
          console.log(`     Дата: ${payment[0].payment_date || payment[0].created_at}`);
        }
      } else {
        console.log(`   Платёж №${paymentId}: ❌ НЕ найден в external_refs`);
      }
    }

    console.log('\n' + '═'.repeat(60));
    console.log('✅ Проверка завершена!');
    console.log('═'.repeat(60));

  } catch (error) {
    console.error('❌ Ошибка:', error);
    throw error;
  } finally {
    await sql.end();
  }
}

verifyEvents().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

