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
    tables.forEach(t => console.log(`   ✅ ${t.table_name}`));
    console.log();
    
    if (tables.length === 0) {
      console.log('⚠️  Таблицы не найдены. Применяю миграции...\n');
      const fs = await import('fs');
      const migrations = [
        'setup/migrations/0018_create_battery_voltage_history.sql',
        'setup/migrations/0019_create_battery_voltage_alerts.sql',
        'setup/migrations/0020_create_speed_history.sql',
        'setup/migrations/0021_create_speed_violations.sql'
      ];
      
      for (const migrationFile of migrations) {
        try {
          console.log(`📄 Применяю: ${migrationFile}...`);
          const migrationSQL = fs.readFileSync(migrationFile, 'utf8');
          await sql.unsafe(migrationSQL);
          console.log(`   ✅ Успешно применена\n`);
        } catch (error) {
          if (error.message.includes('already exists') || error.message.includes('duplicate')) {
            console.log(`   ⚠️  Таблица уже существует, пропускаю\n`);
          } else {
            console.error(`   ❌ Ошибка: ${error.message}\n`);
          }
        }
      }
    }
    
    // Статистика по speed_history
    try {
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
    } catch (e) {
      console.log('⚠️  speed_history: таблица не существует или пуста\n');
    }
    
    // Статистика по battery_voltage_history
    try {
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
    } catch (e) {
      console.log('⚠️  battery_voltage_history: таблица не существует или пуста\n');
    }
    
    // Ищем Toyota RAV4 021
    const rav4Car = await sql`
      SELECT id, plate, model, car_visual_name as brand
      FROM cars
      WHERE plate LIKE '%021%' 
         OR plate LIKE '%BE021%'
         OR (model ILIKE '%rav%' AND plate LIKE '%4%')
      LIMIT 5
    `;
    
    if (rav4Car.length === 0) {
      console.log('⚠️ Toyota RAV4 021 не найдена. Показываю примеры для всех машин:\n');
      
      // Примеры скорости
      try {
        const speedExamples = await sql`
          SELECT 
            c.plate,
            c.model,
            sh.speed,
            sh.timestamp,
            sh.is_moving
          FROM speed_history sh
          JOIN cars c ON c.id = sh.car_id
          ORDER BY sh.timestamp DESC
          LIMIT 20
        `;
        console.log('📈 Примеры скорости (последние 20):');
        speedExamples.forEach((r, i) => {
          console.log(`   ${i + 1}. ${r.plate} (${r.model || 'N/A'}): ${Number(r.speed).toFixed(0)} км/ч, ${r.timestamp.toISOString()}, движется: ${r.is_moving}`);
        });
        console.log();
      } catch (e) {
        console.log('⚠️  Нет данных скорости\n');
      }
      
      // Примеры вольтажа
      try {
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
        console.log('🔋 Примеры вольтажа (последние 20):');
        voltageExamples.forEach((r, i) => {
          console.log(`   ${i + 1}. ${r.plate} (${r.model || 'N/A'}): ${Number(r.battery_voltage).toFixed(2)}V, ${r.timestamp.toISOString()}, зажигание: ${r.ignition_on}, двигатель: ${r.engine_running}`);
        });
      } catch (e) {
        console.log('⚠️  Нет данных вольтажа\n');
      }
    } else {
      console.log('🚗 Найдена Toyota RAV4 021:');
      rav4Car.forEach(c => {
        console.log(`   ${c.plate} - ${c.brand || ''} ${c.model} (ID: ${c.id})`);
      });
      console.log();
      
      const carId = rav4Car[0].id;
      
      // Примеры скорости для RAV4 021
      try {
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
      } catch (e) {
        console.log(`⚠️  Ошибка при получении скорости для ${rav4Car[0].plate}: ${e.message}\n`);
      }
      
      // Примеры вольтажа для RAV4 021
      try {
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
      } catch (e) {
        console.log(`⚠️  Ошибка при получении вольтажа для ${rav4Car[0].plate}: ${e.message}\n`);
      }
    }
    
  } catch (error) {
    console.error('❌ Ошибка:', error);
  } finally {
    await sql.end();
  }
})();

