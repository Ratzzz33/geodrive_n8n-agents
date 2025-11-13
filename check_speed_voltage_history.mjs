import postgres from 'postgres';
import 'dotenv/config';

const sql = postgres(process.env.DATABASE_URL);

(async () => {
  try {
    console.log('🔍 Проверка истории скорости и вольтажа...\n');
    
    // 1. Проверяем наличие таблиц
    const tablesCheck = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name IN ('speed_history', 'battery_voltage_history')
      ORDER BY table_name
    `;
    console.log('📊 Таблицы в БД:');
    tablesCheck.forEach(t => console.log(`   ✅ ${t.table_name}`));
    console.log();
    
    // 2. Статистика по speed_history
    const speedStats = await sql`
      SELECT 
        COUNT(*) as total,
        COUNT(DISTINCT car_id) as unique_cars,
        MIN(timestamp) as first_record,
        MAX(timestamp) as last_record,
        AVG(speed) as avg_speed,
        MAX(speed) as max_speed
      FROM speed_history
    `;
    console.log('📈 Статистика speed_history:');
    console.log(`   Всего записей: ${speedStats[0].total}`);
    console.log(`   Уникальных машин: ${speedStats[0].unique_cars}`);
    console.log(`   Первая запись: ${speedStats[0].first_record || 'Нет данных'}`);
    console.log(`   Последняя запись: ${speedStats[0].last_record || 'Нет данных'}`);
    if (speedStats[0].avg_speed) {
      console.log(`   Средняя скорость: ${Number(speedStats[0].avg_speed).toFixed(2)} км/ч`);
      console.log(`   Максимальная скорость: ${Number(speedStats[0].max_speed).toFixed(2)} км/ч`);
    }
    console.log();
    
    // 3. Статистика по battery_voltage_history
    const voltageStats = await sql`
      SELECT 
        COUNT(*) as total,
        COUNT(DISTINCT car_id) as unique_cars,
        MIN(timestamp) as first_record,
        MAX(timestamp) as last_record,
        AVG(battery_voltage) as avg_voltage,
        MIN(battery_voltage) as min_voltage,
        MAX(battery_voltage) as max_voltage
      FROM battery_voltage_history
    `;
    console.log('🔋 Статистика battery_voltage_history:');
    console.log(`   Всего записей: ${voltageStats[0].total}`);
    console.log(`   Уникальных машин: ${voltageStats[0].unique_cars}`);
    console.log(`   Первая запись: ${voltageStats[0].first_record || 'Нет данных'}`);
    console.log(`   Последняя запись: ${voltageStats[0].last_record || 'Нет данных'}`);
    if (voltageStats[0].avg_voltage) {
      console.log(`   Средний вольтаж: ${Number(voltageStats[0].avg_voltage).toFixed(2)}V`);
      console.log(`   Минимальный вольтаж: ${Number(voltageStats[0].min_voltage).toFixed(2)}V`);
      console.log(`   Максимальный вольтаж: ${Number(voltageStats[0].max_voltage).toFixed(2)}V`);
    }
    console.log();
    
    // 4. Ищем Toyota RAV4 021
    const rav4Car = await sql`
      SELECT id, plate, model, car_visual_name as brand
      FROM cars
      WHERE plate LIKE '%021%' 
         OR plate LIKE '%BE021%'
         OR model ILIKE '%rav%4%'
         OR model ILIKE '%rav4%'
      LIMIT 5
    `;
    
    if (rav4Car.length === 0) {
      console.log('⚠️ Toyota RAV4 021 не найдена в таблице cars');
      console.log('   Показываю примеры для всех машин:\n');
      
      // Примеры скорости для всех машин
      const speedExamples = await sql`
        SELECT 
          c.plate,
          c.model,
          sh.speed,
          sh.timestamp,
          sh.latitude,
          sh.longitude,
          sh.is_moving
        FROM speed_history sh
        JOIN cars c ON c.id = sh.car_id
        ORDER BY sh.timestamp DESC
        LIMIT 20
      `;
      console.log('📈 Примеры скорости (последние 20 записей):');
      speedExamples.forEach((r, i) => {
        console.log(`   ${i + 1}. ${r.plate} (${r.model || 'N/A'}): ${Number(r.speed).toFixed(0)} км/ч, ${r.timestamp.toISOString()}, движется: ${r.is_moving}`);
      });
      console.log();
      
      // Примеры вольтажа для всех машин
      const voltageExamples = await sql`
        SELECT 
          c.plate,
          c.model,
          bvh.battery_voltage,
          bvh.timestamp,
          bvh.ignition_on,
          bvh.engine_running
        FROM battery_voltage_history bvh
        JOIN cars c ON c.id = bvh.car_id
        ORDER BY bvh.timestamp DESC
        LIMIT 20
      `;
      console.log('🔋 Примеры вольтажа (последние 20 записей):');
      voltageExamples.forEach((r, i) => {
        console.log(`   ${i + 1}. ${r.plate} (${r.model || 'N/A'}): ${Number(r.battery_voltage).toFixed(2)}V, ${r.timestamp.toISOString()}, зажигание: ${r.ignition_on}, двигатель: ${r.engine_running}`);
      });
    } else {
      console.log('🚗 Найдена Toyota RAV4 021:');
      rav4Car.forEach(c => {
        console.log(`   ${c.plate} - ${c.brand || ''} ${c.model} (ID: ${c.id})`);
      });
      console.log();
      
      const carId = rav4Car[0].id;
      
      // Примеры скорости для RAV4 021
      const speedExamples = await sql`
        SELECT 
          speed,
          timestamp,
          latitude,
          longitude,
          is_moving,
          ignition_on,
          engine_running,
          status
        FROM speed_history
        WHERE car_id = ${carId}
        ORDER BY timestamp DESC
        LIMIT 20
      `;
      console.log(`📈 Примеры скорости для ${rav4Car[0].plate} (последние 20 записей):`);
      if (speedExamples.length === 0) {
        console.log('   ⚠️ Нет записей скорости для этой машины');
      } else {
        speedExamples.forEach((r, i) => {
          console.log(`   ${i + 1}. ${Number(r.speed).toFixed(0)} км/ч, ${r.timestamp.toISOString()}, движется: ${r.is_moving}, зажигание: ${r.ignition_on}, двигатель: ${r.engine_running}, статус: ${r.status}`);
        });
      }
      console.log();
      
      // Примеры вольтажа для RAV4 021
      const voltageExamples = await sql`
        SELECT 
          battery_voltage,
          timestamp,
          ignition_on,
          engine_running,
          status
        FROM battery_voltage_history
        WHERE car_id = ${carId}
        ORDER BY timestamp DESC
        LIMIT 20
      `;
      console.log(`🔋 Примеры вольтажа для ${rav4Car[0].plate} (последние 20 записей):`);
      if (voltageExamples.length === 0) {
        console.log('   ⚠️ Нет записей вольтажа для этой машины');
      } else {
        voltageExamples.forEach((r, i) => {
          console.log(`   ${i + 1}. ${Number(r.battery_voltage).toFixed(2)}V, ${r.timestamp.toISOString()}, зажигание: ${r.ignition_on}, двигатель: ${r.engine_running}, статус: ${r.status}`);
        });
      }
    }
    
    console.log();
    
    // 5. Статистика по машинам
    const carsSpeedStats = await sql`
      SELECT 
        c.plate,
        c.model,
        COUNT(sh.id) as speed_records,
        MAX(sh.speed) as max_speed,
        AVG(sh.speed) as avg_speed
      FROM cars c
      LEFT JOIN speed_history sh ON sh.car_id = c.id
      WHERE sh.id IS NOT NULL
      GROUP BY c.plate, c.model
      ORDER BY speed_records DESC
      LIMIT 10
    `;
    console.log('📊 Топ-10 машин по количеству записей скорости:');
    carsSpeedStats.forEach((r, i) => {
      console.log(`   ${i + 1}. ${r.plate} (${r.model || 'N/A'}): ${r.speed_records} записей, макс: ${Number(r.max_speed).toFixed(0)} км/ч, средняя: ${Number(r.avg_speed).toFixed(1)} км/ч`);
    });
    console.log();
    
    const carsVoltageStats = await sql`
      SELECT 
        c.plate,
        c.model,
        COUNT(bvh.id) as voltage_records,
        AVG(bvh.battery_voltage) as avg_voltage,
        MIN(bvh.battery_voltage) as min_voltage
      FROM cars c
      LEFT JOIN battery_voltage_history bvh ON bvh.car_id = c.id
      WHERE bvh.id IS NOT NULL
      GROUP BY c.plate, c.model
      ORDER BY voltage_records DESC
      LIMIT 10
    `;
    console.log('📊 Топ-10 машин по количеству записей вольтажа:');
    carsVoltageStats.forEach((r, i) => {
      console.log(`   ${i + 1}. ${r.plate} (${r.model || 'N/A'}): ${r.voltage_records} записей, средний: ${Number(r.avg_voltage).toFixed(2)}V, мин: ${Number(r.min_voltage).toFixed(2)}V`);
    });
    
  } catch (error) {
    console.error('❌ Ошибка:', error);
  } finally {
    await sql.end();
  }
})();

