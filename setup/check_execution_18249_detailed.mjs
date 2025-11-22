/**
 * Детальная проверка execution #18249
 * Проверка каждой ноды и сохраненных данных
 */

import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

async function checkExecutionDetailed() {
  try {
    console.log('🔍 Детальная проверка execution #18249...\n');
    console.log('='.repeat(80));
    console.log('ПРОВЕРКА КАЖДОЙ НОДЫ И ДАННЫХ В БД');
    console.log('='.repeat(80));
    console.log();

    // Получаем все записи, сохраненные примерно в время execution #18249
    // Execution был в 19:33:39 UTC (23:33:39 Tbilisi), завершился в 19:34:45 UTC
    const executionTime = new Date('2025-11-17T19:33:39Z');
    const timeWindow = {
      start: new Date(executionTime.getTime() - 5 * 60 * 1000),  // -5 минут
      end: new Date(executionTime.getTime() + 5 * 60 * 1000)     // +5 минут
    };

    console.log('📊 1. ПРОВЕРКА: Данные в rentprog_car_states_snapshot');
    console.log('-'.repeat(80));
    
    const snapshotCars = await sql`
      SELECT 
        rentprog_id,
        car_name,
        code,
        number,
        vin,
        color,
        year,
        transmission,
        fuel,
        car_type,
        car_class,
        active,
        state,
        tank_state,
        clean_state,
        mileage,
        tire_type,
        tire_size,
        last_inspection,
        deposit,
        price_hour,
        hourly_deposit,
        monthly_deposit,
        investor_id,
        purchase_price,
        purchase_date,
        age_limit,
        driver_year_limit,
        franchise,
        max_fine,
        repair_cost,
        is_air,
        climate_control,
        parktronic,
        parktronic_camera,
        heated_seats,
        audio_system,
        usb_system,
        rain_sensor,
        engine_capacity,
        number_doors,
        tank_value,
        pts,
        registration_certificate,
        body_number,
        fetched_at
      FROM rentprog_car_states_snapshot
      WHERE fetched_at >= ${timeWindow.start}
        AND fetched_at <= ${timeWindow.end}
      ORDER BY fetched_at DESC, rentprog_id
    `;

    console.log(`✅ Найдено записей в snapshot: ${snapshotCars.length}`);
    if (snapshotCars.length > 0) {
      console.log('\nСписок машин:');
      snapshotCars.forEach((car, idx) => {
        console.log(`  ${idx + 1}. ${car.car_name} (${car.code}) - rentprog_id: ${car.rentprog_id}, number: ${car.number}`);
      });
    }
    console.log();

    console.log('📊 2. ПРОВЕРКА: Данные в cars');
    console.log('-'.repeat(80));
    
    const carsFromDB = await sql`
      SELECT 
        rentprog_id,
        car_name,
        code,
        number,
        vin,
        color,
        year,
        transmission,
        fuel,
        car_type,
        car_class,
        active,
        state,
        tank_state,
        clean_state,
        mileage,
        tire_type,
        tire_size,
        last_inspection,
        deposit,
        price_hour,
        hourly_deposit,
        monthly_deposit,
        investor_id,
        purchase_price,
        purchase_date,
        age_limit,
        driver_year_limit,
        franchise,
        max_fine,
        repair_cost,
        is_air,
        climate_control,
        parktronic,
        parktronic_camera,
        heated_seats,
        audio_system,
        usb_system,
        rain_sensor,
        engine_capacity,
        number_doors,
        tank_value,
        pts,
        registration_certificate,
        body_number,
        updated_at
      FROM cars
      WHERE updated_at >= ${timeWindow.start}
        AND updated_at <= ${timeWindow.end}
      ORDER BY updated_at DESC, rentprog_id
    `;

    console.log(`✅ Найдено записей в cars: ${carsFromDB.length}`);
    if (carsFromDB.length > 0) {
      console.log('\nСписок машин:');
      carsFromDB.forEach((car, idx) => {
        console.log(`  ${idx + 1}. ${car.car_name} (${car.code}) - rentprog_id: ${car.rentprog_id}, number: ${car.number}`);
      });
    }
    console.log();

    // Проверяем соответствие
    console.log('📊 3. ПРОВЕРКА: Соответствие между snapshot и cars');
    console.log('-'.repeat(80));
    
    const snapshotIds = snapshotCars.map(c => c.rentprog_id);
    const carsIds = carsFromDB.map(c => c.rentprog_id);
    
    const missingInCars = snapshotIds.filter(id => !carsIds.includes(id));
    const missingInSnapshot = carsIds.filter(id => !snapshotIds.includes(id));
    
    if (missingInCars.length > 0) {
      console.log(`❌ Найдено записей в snapshot, которых нет в cars: ${missingInCars.length}`);
      missingInCars.forEach(id => {
        const car = snapshotCars.find(c => c.rentprog_id === id);
        console.log(`  - ${car?.car_name} (rentprog_id: ${id})`);
      });
    } else {
      console.log('✅ Все записи из snapshot есть в cars');
    }
    
    if (missingInSnapshot.length > 0) {
      console.log(`⚠️ Найдено записей в cars, которых нет в snapshot: ${missingInSnapshot.length}`);
      missingInSnapshot.forEach(id => {
        const car = carsFromDB.find(c => c.rentprog_id === id);
        console.log(`  - ${car?.car_name} (rentprog_id: ${id})`);
      });
    }
    console.log();

    // Проверяем NULL значения
    console.log('📊 4. ПРОВЕРКА: NULL значения в критичных полях');
    console.log('-'.repeat(80));
    
    const criticalFields = [
      'car_name', 'code', 'number', 'vin', 'color', 'year',
      'deposit', 'price_hour', 'hourly_deposit', 'monthly_deposit',
      'investor_id', 'purchase_price', 'age_limit', 'driver_year_limit'
    ];
    
    const nullIssues = [];
    
    for (const car of snapshotCars) {
      const nullFields = [];
      for (const field of criticalFields) {
        if (car[field] === null || car[field] === undefined) {
          nullFields.push(field);
        }
      }
      if (nullFields.length > 0) {
        nullIssues.push({
          rentprog_id: car.rentprog_id,
          car_name: car.car_name,
          nullFields
        });
      }
    }
    
    if (nullIssues.length > 0) {
      console.log(`⚠️ Найдено записей с NULL в критичных полях: ${nullIssues.length}`);
      nullIssues.forEach(item => {
        console.log(`  - ${item.car_name} (rentprog_id: ${item.rentprog_id}): ${item.nullFields.join(', ')}`);
      });
    } else {
      console.log('✅ Нет NULL значений в критичных полях');
    }
    console.log();

    // Проверяем перезапись NULL значениями
    console.log('📊 5. ПРОВЕРКА: Перезапись NULL значениями');
    console.log('-'.repeat(80));
    
    let overwriteCount = 0;
    const overwriteIssues = [];
    
    for (const car of snapshotCars) {
      const previousVersion = await sql`
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
          age_limit,
          driver_year_limit
        FROM rentprog_car_states_snapshot
        WHERE rentprog_id = ${car.rentprog_id}
          AND fetched_at < ${car.fetched_at}
        ORDER BY fetched_at DESC
        LIMIT 1
      `;
      
      if (previousVersion.length > 0) {
        const prev = previousVersion[0];
        const issues = [];
        
        const fieldsToCheck = [
          'car_name', 'code', 'number', 'deposit', 'price_hour',
          'hourly_deposit', 'monthly_deposit', 'investor_id',
          'purchase_price', 'age_limit', 'driver_year_limit'
        ];
        
        for (const field of fieldsToCheck) {
          const prevValue = prev[field];
          const currValue = car[field];
          
          if (prevValue !== null && prevValue !== undefined && 
              (currValue === null || currValue === undefined)) {
            issues.push({
              field,
              was: prevValue,
              now: currValue
            });
            overwriteCount++;
          }
        }
        
        if (issues.length > 0) {
          overwriteIssues.push({
            rentprog_id: car.rentprog_id,
            car_name: car.car_name,
            issues
          });
        }
      }
    }
    
    if (overwriteIssues.length > 0) {
      console.log(`❌ ОБНАРУЖЕНЫ ПЕРЕЗАПИСИ NULL значениями: ${overwriteIssues.length}`);
      overwriteIssues.forEach(item => {
        console.log(`\n  ${item.car_name} (rentprog_id: ${item.rentprog_id}):`);
        item.issues.forEach(issue => {
          console.log(`    - ${issue.field}: было "${issue.was}", стало ${issue.now}`);
        });
      });
    } else {
      console.log('✅ Перезаписей NULL значениями не обнаружено!');
    }
    console.log();

    // Итоговый отчет
    console.log('='.repeat(80));
    console.log('📊 ИТОГОВЫЙ ОТЧЕТ');
    console.log('='.repeat(80));
    console.log(`Записей в snapshot: ${snapshotCars.length}`);
    console.log(`Записей в cars: ${carsFromDB.length}`);
    console.log(`Пропущено в cars: ${missingInCars.length}`);
    console.log(`NULL значений в критичных полях: ${nullIssues.length}`);
    console.log(`Перезаписей NULL: ${overwriteCount}`);
    
    if (snapshotCars.length > 0 && 
        missingInCars.length === 0 && 
        nullIssues.length === 0 && 
        overwriteCount === 0) {
      console.log('\n✅ ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ УСПЕШНО!');
      console.log('✅ Все данные сохранены корректно');
      console.log('✅ Нет потери данных');
      console.log('✅ Нет перезаписи NULL значениями');
    } else {
      console.log('\n⚠️ ОБНАРУЖЕНЫ ПРОБЛЕМЫ - см. детали выше');
    }

  } catch (error) {
    console.error('❌ Ошибка:', error);
  } finally {
    await sql.end();
  }
}

checkExecutionDetailed();

