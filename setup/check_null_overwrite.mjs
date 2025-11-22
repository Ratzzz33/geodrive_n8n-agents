/**
 * Проверка, не затерлись ли существующие данные NULL значениями
 * Проверяем машину rentprog_id: 50169 (Volkswagen Tiguan)
 */

import postgres from 'postgres';

const CONNECTION_STRING = process.env.DATABASE_URL || 
  'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

async function checkNullOverwrite() {
  console.log('🔍 Проверяю, не затерлись ли существующие данные NULL значениями...\n');

  try {
    const rentprogId = '50169';

    // Проверяем в таблице cars
    console.log('📋 Проверка в таблице cars:');
    const carResult = await sql`
      SELECT 
        id,
        rentprog_id,
        car_name,
        code,
        number,
        deposit,
        price_hour,
        hourly_deposit,
        monthly_deposit,
        investor_id,
        purchase_price,
        purchase_date,
        age_limit,
        driver_year_limit,
        last_inspection,
        updated_at
      FROM cars
      WHERE rentprog_id = ${rentprogId}
      LIMIT 1
    `;

    if (carResult.length === 0) {
      console.log(`   ⚠️  Машина с rentprog_id=${rentprogId} не найдена в таблице cars`);
    } else {
      const car = carResult[0];
      console.log(`   ✅ Найдена машина: ${car.car_name} (${car.code})`);
      console.log(`   📅 Обновлена: ${car.updated_at}`);
      console.log(`\n   Поля, которые могли быть затерты NULL значениями:`);
      
      const nullableFields = [
        'deposit', 'price_hour', 'hourly_deposit', 'monthly_deposit',
        'investor_id', 'purchase_price', 'purchase_date', 'age_limit',
        'driver_year_limit', 'last_inspection'
      ];

      let hasNulls = false;
      for (const field of nullableFields) {
        const value = car[field];
        if (value === null || value === undefined) {
          console.log(`   ⚠️  ${field}: NULL`);
          hasNulls = true;
        } else {
          console.log(`   ✅ ${field}: ${value}`);
        }
      }

      if (hasNulls) {
        console.log(`\n   ⚠️  ВНИМАНИЕ: Обнаружены NULL значения в полях, которые могли быть затерты!`);
      } else {
        console.log(`\n   ✅ Все проверяемые поля имеют значения (не NULL)`);
      }
    }

    // Проверяем в таблице rentprog_car_states_snapshot
    console.log('\n📋 Проверка в таблице rentprog_car_states_snapshot:');
    const snapshotResult = await sql`
      SELECT 
        rentprog_id,
        car_name,
        code,
        number,
        deposit,
        price_hour,
        hourly_deposit,
        monthly_deposit,
        investor_id,
        purchase_price,
        purchase_date,
        age_limit,
        driver_year_limit,
        last_inspection,
        fetched_at
      FROM rentprog_car_states_snapshot
      WHERE rentprog_id = ${rentprogId}
      ORDER BY fetched_at DESC
      LIMIT 1
    `;

    if (snapshotResult.length === 0) {
      console.log(`   ⚠️  Запись с rentprog_id=${rentprogId} не найдена в таблице rentprog_car_states_snapshot`);
    } else {
      const snapshot = snapshotResult[0];
      console.log(`   ✅ Найдена запись: ${snapshot.car_name} (${snapshot.code})`);
      console.log(`   📅 Получена: ${snapshot.fetched_at}`);
      console.log(`\n   Поля, которые могли быть затерты NULL значениями:`);
      
      const nullableFields = [
        'deposit', 'price_hour', 'hourly_deposit', 'monthly_deposit',
        'investor_id', 'purchase_price', 'purchase_date', 'age_limit',
        'driver_year_limit', 'last_inspection'
      ];

      let hasNulls = false;
      for (const field of nullableFields) {
        const value = snapshot[field];
        if (value === null || value === undefined) {
          console.log(`   ⚠️  ${field}: NULL`);
          hasNulls = true;
        } else {
          console.log(`   ✅ ${field}: ${value}`);
        }
      }

      if (hasNulls) {
        console.log(`\n   ⚠️  ВНИМАНИЕ: Обнаружены NULL значения в полях, которые могли быть затерты!`);
      } else {
        console.log(`\n   ✅ Все проверяемые поля имеют значения (не NULL)`);
      }
    }

    // Сравниваем cars и snapshot
    if (carResult.length > 0 && snapshotResult.length > 0) {
      console.log('\n📊 Сравнение cars и rentprog_car_states_snapshot:');
      const car = carResult[0];
      const snapshot = snapshotResult[0];
      
      const fieldsToCompare = [
        'deposit', 'price_hour', 'hourly_deposit', 'monthly_deposit',
        'investor_id', 'purchase_price', 'purchase_date', 'age_limit',
        'driver_year_limit', 'last_inspection'
      ];

      let differences = [];
      for (const field of fieldsToCompare) {
        const carValue = car[field];
        const snapshotValue = snapshot[field];
        if (carValue !== snapshotValue) {
          differences.push({
            field,
            cars: carValue,
            snapshot: snapshotValue
          });
        }
      }

      if (differences.length > 0) {
        console.log(`   ⚠️  Обнаружены различия в ${differences.length} полях:`);
        differences.forEach(diff => {
          console.log(`   - ${diff.field}: cars=${diff.cars}, snapshot=${diff.snapshot}`);
        });
      } else {
        console.log(`   ✅ Данные совпадают между cars и rentprog_car_states_snapshot`);
      }
    }

    // Проверяем историю изменений (если есть таблица с историей)
    console.log('\n📋 Проверка последних обновлений в таблице cars:');
    const recentUpdates = await sql`
      SELECT 
        rentprog_id,
        car_name,
        code,
        updated_at,
        deposit,
        price_hour,
        investor_id
      FROM cars
      WHERE rentprog_id = ${rentprogId}
      ORDER BY updated_at DESC
      LIMIT 5
    `;

    if (recentUpdates.length > 0) {
      console.log(`   Последние обновления для rentprog_id=${rentprogId}:`);
      recentUpdates.forEach((update, idx) => {
        console.log(`   ${idx + 1}. ${update.updated_at} - ${update.car_name} (deposit=${update.deposit}, price_hour=${update.price_hour}, investor_id=${update.investor_id})`);
      });
    }

  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    throw error;
  } finally {
    await sql.end();
  }
}

checkNullOverwrite()
  .then(() => {
    console.log('\n✅ Проверка завершена');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Ошибка:', error);
    process.exit(1);
  });

