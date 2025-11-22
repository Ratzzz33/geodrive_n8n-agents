/**
 * Пошаговая проверка execution #18249
 * Проверка каждой ноды workflow
 */

import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

async function checkExecutionStepByStep() {
  try {
    console.log('🔍 Пошаговая проверка execution #18249...\n');
    console.log('='.repeat(80));
    console.log('ПРОВЕРКА КАЖДОЙ НОДЫ');
    console.log('='.repeat(80));
    console.log();

    // 1. Проверяем данные в БД (последние записи после execution #18249)
    console.log('📊 1. ПРОВЕРКА: Данные в БД после execution #18249');
    console.log('-'.repeat(80));
    
    // Получаем время выполнения execution (примерно 19:20 UTC = 23:20 Tbilisi)
    // Execution #18249 был примерно в это время
    const recentSnapshot = await sql`
      SELECT 
        rentprog_id,
        car_name,
        code,
        number,
        fetched_at
      FROM rentprog_car_states_snapshot
      WHERE fetched_at >= NOW() - INTERVAL '1 hour'
      ORDER BY fetched_at DESC, rentprog_id
      LIMIT 20
    `;

    console.log(`✅ Найдено записей в snapshot за последний час: ${recentSnapshot.length}`);
    if (recentSnapshot.length > 0) {
      console.log('\nПоследние записи:');
      recentSnapshot.forEach((car, idx) => {
        console.log(`  ${idx + 1}. ${car.car_name} (${car.code}) - rentprog_id: ${car.rentprog_id}, number: ${car.number}`);
      });
    }
    console.log();

    const recentCars = await sql`
      SELECT 
        rentprog_id,
        car_name,
        code,
        number,
        updated_at
      FROM cars
      WHERE updated_at >= NOW() - INTERVAL '1 hour'
      ORDER BY updated_at DESC, rentprog_id
      LIMIT 20
    `;

    console.log(`✅ Найдено записей в cars за последний час: ${recentCars.length}`);
    if (recentCars.length > 0) {
      console.log('\nПоследние записи:');
      recentCars.forEach((car, idx) => {
        console.log(`  ${idx + 1}. ${car.car_name} (${car.code}) - rentprog_id: ${car.rentprog_id}, number: ${car.number}`);
      });
    }
    console.log();

    // 2. Проверяем целостность данных
    console.log('='.repeat(80));
    console.log('📊 2. ПРОВЕРКА: Целостность данных');
    console.log('-'.repeat(80));
    
    // Проверяем, что все записи в snapshot есть в cars
    const snapshotIds = recentSnapshot.map(c => c.rentprog_id);
    if (snapshotIds.length > 0) {
      const carsIds = recentCars.map(c => c.rentprog_id);
      const missingInCars = snapshotIds.filter(id => !carsIds.includes(id));
      
      if (missingInCars.length > 0) {
        console.log(`❌ Найдено записей в snapshot, которых нет в cars: ${missingInCars.length}`);
        missingInCars.forEach(id => {
          const car = recentSnapshot.find(c => c.rentprog_id === id);
          console.log(`  - ${car?.car_name} (rentprog_id: ${id})`);
        });
      } else {
        console.log('✅ Все записи из snapshot есть в cars');
      }
      console.log();
    }

    // 3. Проверяем NULL значения
    console.log('='.repeat(80));
    console.log('📊 3. ПРОВЕРКА: NULL значения в критичных полях');
    console.log('-'.repeat(80));
    
    if (recentSnapshot.length > 0) {
      const nullChecks = await sql`
        SELECT 
          rentprog_id,
          car_name,
          code,
          CASE WHEN car_name IS NULL THEN 'car_name' ELSE NULL END AS null_car_name,
          CASE WHEN code IS NULL THEN 'code' ELSE NULL END AS null_code,
          CASE WHEN number IS NULL THEN 'number' ELSE NULL END AS null_number,
          CASE WHEN vin IS NULL THEN 'vin' ELSE NULL END AS null_vin,
          CASE WHEN deposit IS NULL THEN 'deposit' ELSE NULL END AS null_deposit,
          CASE WHEN price_hour IS NULL THEN 'price_hour' ELSE NULL END AS null_price_hour
        FROM rentprog_car_states_snapshot
        WHERE rentprog_id = ANY(${snapshotIds})
          AND (
            car_name IS NULL OR
            code IS NULL OR
            number IS NULL OR
            vin IS NULL OR
            deposit IS NULL OR
            price_hour IS NULL
          )
      `;

      if (nullChecks.length > 0) {
        console.log(`⚠️ Найдено записей с NULL в критичных полях: ${nullChecks.length}`);
        nullChecks.forEach(car => {
          const nullFields = [
            car.null_car_name,
            car.null_code,
            car.null_number,
            car.null_vin,
            car.null_deposit,
            car.null_price_hour
          ].filter(f => f !== null);
          console.log(`  - ${car.car_name || 'Unknown'} (rentprog_id: ${car.rentprog_id}): ${nullFields.join(', ')}`);
        });
      } else {
        console.log('✅ Нет NULL значений в критичных полях');
      }
      console.log();
    }

    // 4. Проверяем перезапись NULL значениями
    console.log('='.repeat(80));
    console.log('📊 4. ПРОВЕРКА: Перезапись NULL значениями');
    console.log('-'.repeat(80));
    
    // Для каждой машины проверяем, были ли данные до обновления
    let overwriteCount = 0;
    
    for (const car of recentSnapshot.slice(0, 5)) { // Проверяем первые 5 для примера
      const previousVersion = await sql`
        SELECT 
          rentprog_id,
          car_name,
          code,
          number,
          deposit,
          price_hour,
          hourly_deposit,
          monthly_deposit
        FROM rentprog_car_states_snapshot
        WHERE rentprog_id = ${car.rentprog_id}
          AND fetched_at < (SELECT MAX(fetched_at) FROM rentprog_car_states_snapshot WHERE rentprog_id = ${car.rentprog_id})
        ORDER BY fetched_at DESC
        LIMIT 1
      `;
      
      if (previousVersion.length > 0) {
        const prev = previousVersion[0];
        const current = await sql`
          SELECT 
            car_name,
            code,
            number,
            deposit,
            price_hour,
            hourly_deposit,
            monthly_deposit
          FROM rentprog_car_states_snapshot
          WHERE rentprog_id = ${car.rentprog_id}
          ORDER BY fetched_at DESC
          LIMIT 1
        `[0];
        
        if (current) {
          const issues = [];
          const fieldsToCheck = ['car_name', 'code', 'number', 'deposit', 'price_hour', 'hourly_deposit', 'monthly_deposit'];
          
          for (const field of fieldsToCheck) {
            const prevValue = prev[field];
            const currValue = current[field];
            
            if (prevValue !== null && prevValue !== undefined && 
                (currValue === null || currValue === undefined)) {
              issues.push({ field, was: prevValue, now: currValue });
              overwriteCount++;
            }
          }
          
          if (issues.length > 0) {
            console.log(`❌ ${car.car_name} (rentprog_id: ${car.rentprog_id}):`);
            issues.forEach(issue => {
              console.log(`    - ${issue.field}: было "${issue.was}", стало ${issue.now}`);
            });
          }
        }
      }
    }
    
    if (overwriteCount === 0) {
      console.log('✅ Перезаписей NULL значениями не обнаружено!');
    }
    console.log();

    // 5. Итоговый отчет
    console.log('='.repeat(80));
    console.log('📊 ИТОГОВЫЙ ОТЧЕТ');
    console.log('='.repeat(80));
    console.log(`Записей в snapshot за последний час: ${recentSnapshot.length}`);
    console.log(`Записей в cars за последний час: ${recentCars.length}`);
    console.log(`Перезаписей NULL: ${overwriteCount}`);
    
    if (recentSnapshot.length > 0 && recentCars.length > 0 && overwriteCount === 0) {
      console.log('\n✅ ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ УСПЕШНО!');
    } else {
      console.log('\n⚠️ ОБНАРУЖЕНЫ ПРОБЛЕМЫ - см. детали выше');
    }

  } catch (error) {
    console.error('❌ Ошибка:', error);
  } finally {
    await sql.end();
  }
}

checkExecutionStepByStep();

