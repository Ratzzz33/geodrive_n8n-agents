import postgres from 'postgres';
import 'dotenv/config';

const sql = postgres(process.env.DATABASE_URL);

(async () => {
  try {
    console.log('🔍 Проверка сохранения данных по каждому устройству...\n');
    
    // Получаем список всех устройств, которые должны обновляться
    const devices = await sql`
      SELECT 
        sd.device_id,
        sd.alias,
        c.plate,
        c.model
      FROM starline_devices sd
      JOIN cars c ON c.id = sd.car_id
      WHERE sd.matched = TRUE AND sd.active = TRUE
      ORDER BY c.plate
      LIMIT 20
    `;
    
    console.log(`📊 Проверяем ${devices.length} устройств...\n`);
    
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    
    // Для каждого устройства проверяем, есть ли записи за последние 10 минут
    const results = [];
    
    for (const device of devices) {
      const speedCount = await sql`
        SELECT COUNT(*) as count
        FROM speed_history
        WHERE starline_device_id = ${device.device_id}
          AND timestamp > ${tenMinutesAgo.toISOString()}
      `;
      
      const voltageCount = await sql`
        SELECT COUNT(*) as count
        FROM battery_voltage_history
        WHERE starline_device_id = ${device.device_id}
          AND timestamp > ${tenMinutesAgo.toISOString()}
      `;
      
      const lastSpeed = await sql`
        SELECT timestamp
        FROM speed_history
        WHERE starline_device_id = ${device.device_id}
        ORDER BY timestamp DESC
        LIMIT 1
      `;
      
      const lastVoltage = await sql`
        SELECT timestamp
        FROM battery_voltage_history
        WHERE starline_device_id = ${device.device_id}
        ORDER BY timestamp DESC
        LIMIT 1
      `;
      
      results.push({
        device: device,
        speedCount: speedCount[0].count,
        voltageCount: voltageCount[0].count,
        lastSpeed: lastSpeed[0]?.timestamp,
        lastVoltage: lastVoltage[0]?.timestamp
      });
    }
    
    // Группируем результаты
    const withSpeed = results.filter(r => r.speedCount > 0);
    const withVoltage = results.filter(r => r.voltageCount > 0);
    const withoutSpeed = results.filter(r => r.speedCount === 0);
    const withoutVoltage = results.filter(r => r.voltageCount === 0);
    
    console.log('📊 Статистика сохранения за последние 10 минут:');
    console.log(`   Устройств с записями скорости: ${withSpeed.length} из ${devices.length}`);
    console.log(`   Устройств с записями вольтажа: ${withVoltage.length} из ${devices.length}`);
    console.log();
    
    if (withSpeed.length > 0) {
      console.log('✅ Устройства с записями скорости:');
      withSpeed.slice(0, 10).forEach(r => {
        console.log(`   ${r.device.plate} (${r.device.alias}): ${r.speedCount} записей, последняя: ${r.lastSpeed ? r.lastSpeed.toISOString() : 'N/A'}`);
      });
      console.log();
    }
    
    if (withVoltage.length > 0) {
      console.log('✅ Устройства с записями вольтажа:');
      withVoltage.slice(0, 10).forEach(r => {
        console.log(`   ${r.device.plate} (${r.device.alias}): ${r.voltageCount} записей, последняя: ${r.lastVoltage ? r.lastVoltage.toISOString() : 'N/A'}`);
      });
      console.log();
    }
    
    if (withoutSpeed.length > 0) {
      console.log('⚠️  Устройства БЕЗ записей скорости за последние 10 минут:');
      withoutSpeed.slice(0, 10).forEach(r => {
        const lastSpeedTime = r.lastSpeed ? `(последняя: ${r.lastSpeed.toISOString()})` : '(нет записей)';
        console.log(`   ${r.device.plate} (${r.device.alias}): 0 записей ${lastSpeedTime}`);
      });
      console.log();
    }
    
    if (withoutVoltage.length > 0) {
      console.log('⚠️  Устройства БЕЗ записей вольтажа за последние 10 минут:');
      withoutVoltage.slice(0, 10).forEach(r => {
        const lastVoltageTime = r.lastVoltage ? `(последняя: ${r.lastVoltage.toISOString()})` : '(нет записей)';
        console.log(`   ${r.device.plate} (${r.device.alias}): 0 записей ${lastVoltageTime}`);
      });
      console.log();
    }
    
    // Проверяем частоту сохранения (должно быть примерно каждые 2-3 минуты)
    const intervals = await sql`
      WITH intervals AS (
        SELECT 
          timestamp,
          LAG(timestamp) OVER (PARTITION BY car_id ORDER BY timestamp) as prev_timestamp
        FROM speed_history
        WHERE timestamp > ${tenMinutesAgo.toISOString()}
          AND car_id = (SELECT id FROM cars WHERE plate = 'BE021ES' LIMIT 1)
      )
      SELECT AVG(EXTRACT(EPOCH FROM (timestamp - prev_timestamp)) / 60) as avg_interval_minutes
      FROM intervals
      WHERE prev_timestamp IS NOT NULL
    `;
    
    if (intervals[0]?.avg_interval_minutes) {
      console.log(`⏱️  Средний интервал между записями для BE021ES: ${Number(intervals[0].avg_interval_minutes).toFixed(1)} минут`);
      if (Number(intervals[0].avg_interval_minutes) > 0 && Number(intervals[0].avg_interval_minutes) < 5) {
        console.log('   ✅ Интервал нормальный (2-3 минуты)');
      } else {
        console.log('   ⚠️  Интервал необычный');
      }
    }
    console.log();
    
    // Итоговая оценка
    console.log('📋 ИТОГОВАЯ ОЦЕНКА:');
    if (withSpeed.length > 0 && withVoltage.length > 0) {
      console.log('   ✅ Данные сохраняются для большинства устройств');
      console.log(`   ✅ Скорость: ${withSpeed.length}/${devices.length} устройств (${Math.round(withSpeed.length / devices.length * 100)}%)`);
      console.log(`   ✅ Вольтаж: ${withVoltage.length}/${devices.length} устройств (${Math.round(withVoltage.length / devices.length * 100)}%)`);
      
      if (withSpeed.length === devices.length && withVoltage.length === devices.length) {
        console.log('   ✅ ВСЕ устройства получают обновления!');
      } else {
        console.log(`   ⚠️  ${devices.length - withSpeed.length} устройств без записей скорости`);
        console.log(`   ⚠️  ${devices.length - withVoltage.length} устройств без записей вольтажа`);
      }
    } else {
      console.log('   ⚠️  Нет данных за последние 10 минут');
    }
    
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    console.error(error.stack);
  } finally {
    await sql.end();
  }
})();

