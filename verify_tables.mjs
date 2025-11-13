import postgres from 'postgres';
import 'dotenv/config';

const sql = postgres(process.env.DATABASE_URL);

(async () => {
  try {
    console.log('🔍 Проверка таблиц и данных...\n');
    
    // Проверяем наличие таблиц
    const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name IN ('speed_history', 'battery_voltage_history', 'speed_violations', 'battery_voltage_alerts')
      ORDER BY table_name
    `;
    console.log('📊 Найденные таблицы:');
    if (tables.length === 0) {
      console.log('   ⚠️  Таблицы не найдены в information_schema');
      // Попробуем прямой запрос к таблицам
      try {
        await sql`SELECT 1 FROM speed_history LIMIT 1`;
        console.log('   ✅ speed_history существует (прямая проверка)');
      } catch (e) {
        console.log('   ❌ speed_history не существует');
      }
      try {
        await sql`SELECT 1 FROM battery_voltage_history LIMIT 1`;
        console.log('   ✅ battery_voltage_history существует (прямая проверка)');
      } catch (e) {
        console.log('   ❌ battery_voltage_history не существует');
      }
    } else {
      tables.forEach(t => console.log(`   ✅ ${t.table_name}`));
    }
    console.log();
    
    if (tables.length === 0) {
      console.log('⚠️  Таблицы не найдены в information_schema, но могут существовать');
      // Продолжаем проверку данных
    }
    
    // Статистика по speed_history
    if (tables.find(t => t.table_name === 'speed_history')) {
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
      if (speedStats[0].first_record) {
        console.log(`   Первая запись: ${speedStats[0].first_record}`);
        console.log(`   Последняя запись: ${speedStats[0].last_record}`);
        if (speedStats[0].avg_speed) {
          console.log(`   Средняя скорость: ${Number(speedStats[0].avg_speed).toFixed(2)} км/ч`);
          console.log(`   Максимальная скорость: ${Number(speedStats[0].max_speed).toFixed(2)} км/ч`);
        }
      }
      console.log();
    }
    
    // Статистика по battery_voltage_history
    if (tables.find(t => t.table_name === 'battery_voltage_history')) {
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
      if (voltageStats[0].first_record) {
        console.log(`   Первая запись: ${voltageStats[0].first_record}`);
        console.log(`   Последняя запись: ${voltageStats[0].last_record}`);
        if (voltageStats[0].avg_voltage) {
          console.log(`   Средний вольтаж: ${Number(voltageStats[0].avg_voltage).toFixed(2)}V`);
          console.log(`   Минимальный вольтаж: ${Number(voltageStats[0].min_voltage).toFixed(2)}V`);
          console.log(`   Максимальный вольтаж: ${Number(voltageStats[0].max_voltage).toFixed(2)}V`);
        }
      }
      console.log();
    }
    
    // Ищем Toyota RAV4 021 (BE021ES)
    const rav4Car = await sql`
      SELECT id, plate, model, car_visual_name as brand
      FROM cars
      WHERE plate = 'BE021ES'
      LIMIT 1
    `;
    
    if (rav4Car.length === 0) {
      console.log('⚠️ Toyota RAV4 BE021ES не найдена');
      process.exit(0);
    }
    
    const carId = rav4Car[0].id;
    console.log(`🚗 Найдена: ${rav4Car[0].plate} - ${rav4Car[0].brand || ''} ${rav4Car[0].model} (ID: ${carId})\n`);
    
    // Примеры скорости для BE021ES
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
    console.log(`📈 Примеры скорости для ${rav4Car[0].plate} (последние 20):`);
    if (speedExamples.length === 0) {
      console.log('   ⚠️ Нет записей скорости для этой машины');
    } else {
      speedExamples.forEach((r, i) => {
        console.log(`   ${i + 1}. ${Number(r.speed).toFixed(0)} км/ч, ${r.timestamp.toISOString()}, движется: ${r.is_moving}, зажигание: ${r.ignition_on}, двигатель: ${r.engine_running}, статус: ${r.status}`);
      });
    }
    console.log();
    
    // Примеры вольтажа для BE021ES
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
    console.log(`🔋 Примеры вольтажа для ${rav4Car[0].plate} (последние 20):`);
    if (voltageExamples.length === 0) {
      console.log('   ⚠️ Нет записей вольтажа для этой машины');
    } else {
      voltageExamples.forEach((r, i) => {
        console.log(`   ${i + 1}. ${Number(r.battery_voltage).toFixed(2)}V, ${r.timestamp.toISOString()}, зажигание: ${r.ignition_on}, двигатель: ${r.engine_running}, статус: ${r.status}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await sql.end();
  }
})();

