/**
 * Проверка execution #18224:
 * 1. Все ли параметры машин, которые были на входе, попали в БД?
 * 2. Не перезаписались ли NULL значениями другие данные?
 */

import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

// Данные из execution #18224 (из ноды "Normalize Cars")
// Все 11 машин из филиала Kutaisi
const executionInputData = [
  { rentprog_id: '38191', car_name: 'Volkswagen Tiguan', code: 'Tiguan 630 Allspace', number: 'UU630UL', branch_id: '5e551b32-934c-498f-a4a1-a90079985c0a' },
  { rentprog_id: '62396', car_name: 'Ford Explorer', code: 'Ford Explorer 464', number: 'WQ464WQ', branch_id: '5e551b32-934c-498f-a4a1-a90079985c0a' },
  { rentprog_id: '37387', car_name: 'Kia Soul', code: 'Kia Soul 202 Black', number: 'XX202JJ', branch_id: '5e551b32-934c-498f-a4a1-a90079985c0a' },
  { rentprog_id: '38204', car_name: 'Buick Encore', code: 'Buick Encore 279', number: 'PM279MM', branch_id: '5e551b32-934c-498f-a4a1-a90079985c0a' },
  { rentprog_id: '59439', car_name: 'BMW X6', code: 'BMW X6 704', number: 'RR704SR', branch_id: '5e551b32-934c-498f-a4a1-a90079985c0a' },
  { rentprog_id: '46402', car_name: 'MINI Hatch', code: 'Mini 403 RED Hatch', number: 'CV403CV', branch_id: '5e551b32-934c-498f-a4a1-a90079985c0a' },
  { rentprog_id: '44225', car_name: 'Kia Sportage', code: 'Kia Sportage 738', number: 'RL738RL', branch_id: '5e551b32-934c-498f-a4a1-a90079985c0a' },
  { rentprog_id: '46225', car_name: 'Unknown', code: 'Unknown', number: 'Unknown', branch_id: '5e551b32-934c-498f-a4a1-a90079985c0a' },
  { rentprog_id: '38000', car_name: 'Unknown', code: 'Unknown', number: 'Unknown', branch_id: '5e551b32-934c-498f-a4a1-a90079985c0a' },
  { rentprog_id: '50169', car_name: 'Volkswagen Tiguan', code: 'VW Tiguan 468 4x4', number: 'FF468BF', branch_id: '5e551b32-934c-498f-a4a1-a90079985c0a' },
  { rentprog_id: '51321', car_name: 'Unknown', code: 'Unknown', number: 'Unknown', branch_id: '5e551b32-934c-498f-a4a1-a90079985c0a' },
];

async function checkExecutionData() {
  try {
    console.log('🔍 Проверка данных из execution #18224...\n');
    console.log(`📊 Всего машин на входе: ${executionInputData.length}\n`);

    const rentprogIds = executionInputData.map(car => car.rentprog_id);
    
    // 1. Проверяем в таблице rentprog_car_states_snapshot
    console.log('='.repeat(80));
    console.log('1️⃣ ПРОВЕРКА: rentprog_car_states_snapshot');
    console.log('='.repeat(80));
    
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
      WHERE rentprog_id = ANY(${rentprogIds})
      ORDER BY rentprog_id
    `;

    console.log(`\n✅ Найдено в snapshot: ${snapshotCars.length} из ${executionInputData.length}\n`);

    const snapshotMap = new Map(snapshotCars.map(car => [car.rentprog_id, car]));
    
    // Проверяем каждую машину
    const missingInSnapshot = [];
    const nullFieldsInSnapshot = [];
    
    for (const inputCar of executionInputData) {
      const saved = snapshotMap.get(inputCar.rentprog_id);
      if (!saved) {
        missingInSnapshot.push(inputCar);
        continue;
      }
      
      // Проверяем NULL значения в критичных полях
      const nullFields = [];
      const criticalFields = [
        'car_name', 'code', 'number', 'vin', 'color', 'year',
        'deposit', 'price_hour', 'hourly_deposit', 'monthly_deposit',
        'investor_id', 'purchase_price', 'age_limit', 'driver_year_limit'
      ];
      
      for (const field of criticalFields) {
        if (saved[field] === null || saved[field] === undefined) {
          nullFields.push(field);
        }
      }
      
      if (nullFields.length > 0) {
        nullFieldsInSnapshot.push({
          rentprog_id: inputCar.rentprog_id,
          car_name: inputCar.car_name,
          nullFields
        });
      }
    }

    if (missingInSnapshot.length > 0) {
      console.log('❌ НЕ НАЙДЕНЫ в snapshot:');
      missingInSnapshot.forEach(car => {
        console.log(`  - ${car.car_name} (${car.code}) - rentprog_id: ${car.rentprog_id}`);
      });
      console.log();
    }

    if (nullFieldsInSnapshot.length > 0) {
      console.log('⚠️ NULL значения в snapshot:');
      nullFieldsInSnapshot.forEach(item => {
        console.log(`  - ${item.car_name} (rentprog_id: ${item.rentprog_id}): ${item.nullFields.join(', ')}`);
      });
      console.log();
    }

    // 2. Проверяем в таблице cars
    console.log('='.repeat(80));
    console.log('2️⃣ ПРОВЕРКА: cars');
    console.log('='.repeat(80));
    
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
      WHERE rentprog_id = ANY(${rentprogIds})
      ORDER BY rentprog_id
    `;

    console.log(`\n✅ Найдено в cars: ${carsFromDB.length} из ${executionInputData.length}\n`);

    const carsMap = new Map(carsFromDB.map(car => [car.rentprog_id, car]));
    
    // Проверяем каждую машину
    const missingInCars = [];
    const nullFieldsInCars = [];
    
    for (const inputCar of executionInputData) {
      const saved = carsMap.get(inputCar.rentprog_id);
      if (!saved) {
        missingInCars.push(inputCar);
        continue;
      }
      
      // Проверяем NULL значения в критичных полях
      const nullFields = [];
      const criticalFields = [
        'car_name', 'code', 'number', 'vin', 'color', 'year',
        'deposit', 'price_hour', 'hourly_deposit', 'monthly_deposit',
        'investor_id', 'purchase_price', 'age_limit', 'driver_year_limit'
      ];
      
      for (const field of criticalFields) {
        if (saved[field] === null || saved[field] === undefined) {
          nullFields.push(field);
        }
      }
      
      if (nullFields.length > 0) {
        nullFieldsInCars.push({
          rentprog_id: inputCar.rentprog_id,
          car_name: inputCar.car_name,
          nullFields
        });
      }
    }

    if (missingInCars.length > 0) {
      console.log('❌ НЕ НАЙДЕНЫ в cars:');
      missingInCars.forEach(car => {
        console.log(`  - ${car.car_name} (${car.code}) - rentprog_id: ${car.rentprog_id}`);
      });
      console.log();
    }

    if (nullFieldsInCars.length > 0) {
      console.log('⚠️ NULL значения в cars:');
      nullFieldsInCars.forEach(item => {
        console.log(`  - ${item.car_name} (rentprog_id: ${item.rentprog_id}): ${item.nullFields.join(', ')}`);
      });
      console.log();
    }

    // 3. Проверяем, не затерлись ли существующие данные NULL значениями
    console.log('='.repeat(80));
    console.log('3️⃣ ПРОВЕРКА: Не затерлись ли существующие данные NULL?');
    console.log('='.repeat(80));
    
    // Для каждой машины проверяем, были ли данные до обновления
    // Сравниваем с предыдущей версией в snapshot (если есть)
    const overwriteIssues = [];
    
    for (const inputCar of executionInputData) {
      const saved = snapshotMap.get(inputCar.rentprog_id);
      if (!saved) continue;
      
      // Проверяем, есть ли предыдущая версия
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
        WHERE rentprog_id = ${inputCar.rentprog_id}
          AND fetched_at < (SELECT MAX(fetched_at) FROM rentprog_car_states_snapshot WHERE rentprog_id = ${inputCar.rentprog_id})
        ORDER BY fetched_at DESC
        LIMIT 1
      `;
      
      if (previousVersion.length > 0) {
        const prev = previousVersion[0];
        const issues = [];
        
        // Проверяем, не затерлись ли данные
        const fieldsToCheck = [
          'car_name', 'code', 'number', 'deposit', 'price_hour',
          'hourly_deposit', 'monthly_deposit', 'investor_id',
          'purchase_price', 'age_limit', 'driver_year_limit'
        ];
        
        for (const field of fieldsToCheck) {
          const prevValue = prev[field];
          const currValue = saved[field];
          
          // Если было значение, а стало NULL - это проблема
          if (prevValue !== null && prevValue !== undefined && 
              (currValue === null || currValue === undefined)) {
            issues.push({
              field,
              was: prevValue,
              now: currValue
            });
          }
        }
        
        if (issues.length > 0) {
          overwriteIssues.push({
            rentprog_id: inputCar.rentprog_id,
            car_name: inputCar.car_name,
            issues
          });
        }
      }
    }

    if (overwriteIssues.length > 0) {
      console.log('\n❌ ОБНАРУЖЕНЫ ПЕРЕЗАПИСИ NULL значениями:');
      overwriteIssues.forEach(item => {
        console.log(`\n  ${item.car_name} (rentprog_id: ${item.rentprog_id}):`);
        item.issues.forEach(issue => {
          console.log(`    - ${issue.field}: было "${issue.was}", стало ${issue.now}`);
        });
      });
      console.log();
    } else {
      console.log('\n✅ Перезаписей NULL значениями не обнаружено!\n');
    }

    // Итоговый отчет
    console.log('='.repeat(80));
    console.log('📊 ИТОГОВЫЙ ОТЧЕТ');
    console.log('='.repeat(80));
    console.log(`Всего машин на входе: ${executionInputData.length}`);
    console.log(`Сохранено в snapshot: ${snapshotCars.length}`);
    console.log(`Сохранено в cars: ${carsFromDB.length}`);
    console.log(`Пропущено в snapshot: ${missingInSnapshot.length}`);
    console.log(`Пропущено в cars: ${missingInCars.length}`);
    console.log(`NULL значений в snapshot: ${nullFieldsInSnapshot.length}`);
    console.log(`NULL значений в cars: ${nullFieldsInCars.length}`);
    console.log(`Перезаписей NULL: ${overwriteIssues.length}`);
    
    if (missingInSnapshot.length === 0 && missingInCars.length === 0 && 
        nullFieldsInSnapshot.length === 0 && nullFieldsInCars.length === 0 && 
        overwriteIssues.length === 0) {
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

checkExecutionData();

