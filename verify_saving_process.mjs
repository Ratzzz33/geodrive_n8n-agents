import postgres from 'postgres';
import 'dotenv/config';

const sql = postgres(process.env.DATABASE_URL);

(async () => {
  try {
    console.log('🔍 Проверка процесса сохранения истории...\n');
    
    // 1. Проверяем, что данные сохраняются при каждом проходе
    // Смотрим записи за последние 10 минут
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    
    const recentSpeed = await sql`
      SELECT 
        c.plate,
        sh.timestamp,
        sh.speed,
        sh.is_moving,
        sh.status
      FROM speed_history sh
      JOIN cars c ON c.id = sh.car_id
      WHERE sh.timestamp > ${tenMinutesAgo.toISOString()}
      ORDER BY sh.timestamp DESC
      LIMIT 50
    `;
    
    console.log(`📈 Записи скорости за последние 10 минут: ${recentSpeed.length}`);
    if (recentSpeed.length > 0) {
      console.log('   Примеры (последние 5):');
      recentSpeed.slice(0, 5).forEach((r, i) => {
        console.log(`   ${i + 1}. ${r.plate}: ${Number(r.speed).toFixed(0)} км/ч, ${r.timestamp.toISOString()}, движется: ${r.is_moving}, статус: ${r.status}`);
      });
    }
    console.log();
    
    const recentVoltage = await sql`
      SELECT 
        c.plate,
        bvh.timestamp,
        bvh.battery_voltage,
        bvh.status
      FROM battery_voltage_history bvh
      JOIN cars c ON c.id = bvh.car_id
      WHERE bvh.timestamp > ${tenMinutesAgo.toISOString()}
      ORDER BY bvh.timestamp DESC
      LIMIT 50
    `;
    
    console.log(`🔋 Записи вольтажа за последние 10 минут: ${recentVoltage.length}`);
    if (recentVoltage.length > 0) {
      console.log('   Примеры (последние 5):');
      recentVoltage.slice(0, 5).forEach((r, i) => {
        console.log(`   ${i + 1}. ${r.plate}: ${Number(r.battery_voltage).toFixed(2)}V, ${r.timestamp.toISOString()}, статус: ${r.status}`);
      });
    }
    console.log();
    
    // 2. Проверяем частоту сохранения для конкретной машины (BE021ES)
    const rav4Speed = await sql`
      SELECT 
        timestamp,
        speed,
        is_moving,
        status
      FROM speed_history
      WHERE car_id = (SELECT id FROM cars WHERE plate = 'BE021ES' LIMIT 1)
        AND timestamp > ${tenMinutesAgo.toISOString()}
      ORDER BY timestamp DESC
    `;
    
    console.log(`🚗 BE021ES - записи скорости за последние 10 минут: ${rav4Speed.length}`);
    if (rav4Speed.length > 0) {
      console.log('   Все записи:');
      rav4Speed.forEach((r, i) => {
        const interval = i > 0 ? ((new Date(r.timestamp) - new Date(rav4Speed[i - 1].timestamp)) / 1000 / 60).toFixed(1) : 'N/A';
        console.log(`   ${i + 1}. ${r.timestamp.toISOString()} - ${Number(r.speed).toFixed(0)} км/ч, движется: ${r.is_moving}, статус: ${r.status} ${i > 0 ? `(интервал: ${interval} мин)` : ''}`);
      });
    } else {
      console.log('   ⚠️  Нет записей за последние 10 минут');
    }
    console.log();
    
    const rav4Voltage = await sql`
      SELECT 
        timestamp,
        battery_voltage,
        status
      FROM battery_voltage_history
      WHERE car_id = (SELECT id FROM cars WHERE plate = 'BE021ES' LIMIT 1)
        AND timestamp > ${tenMinutesAgo.toISOString()}
      ORDER BY timestamp DESC
    `;
    
    console.log(`🚗 BE021ES - записи вольтажа за последние 10 минут: ${rav4Voltage.length}`);
    if (rav4Voltage.length > 0) {
      console.log('   Все записи:');
      rav4Voltage.forEach((r, i) => {
        const interval = i > 0 ? ((new Date(r.timestamp) - new Date(rav4Voltage[i - 1].timestamp)) / 1000 / 60).toFixed(1) : 'N/A';
        console.log(`   ${i + 1}. ${r.timestamp.toISOString()} - ${Number(r.battery_voltage).toFixed(2)}V, статус: ${r.status} ${i > 0 ? `(интервал: ${interval} мин)` : ''}`);
      });
    } else {
      console.log('   ⚠️  Нет записей за последние 10 минут');
    }
    console.log();
    
    // 3. Проверяем логику сохранения
    // Скорость должна сохраняться если: speed > 0 ИЛИ is_moving = true
    const speedZeroNotMoving = await sql`
      SELECT COUNT(*) as count
      FROM speed_history
      WHERE speed = 0 AND is_moving = false
    `;
    
    console.log('📊 Проверка логики сохранения скорости:');
    console.log(`   Записей с speed=0 и is_moving=false: ${speedZeroNotMoving[0].count} (должно быть 0)`);
    
    if (speedZeroNotMoving[0].count > 0) {
      console.log('   ⚠️  ВНИМАНИЕ: Есть записи с нулевой скоростью и без движения!');
    } else {
      console.log('   ✅ Логика работает правильно - не сохраняем speed=0 при is_moving=false');
    }
    console.log();
    
    // Вольтаж должен сохраняться только если он не NULL
    const voltageNull = await sql`
      SELECT COUNT(*) as count
      FROM battery_voltage_history
      WHERE battery_voltage IS NULL
    `;
    
    console.log('📊 Проверка логики сохранения вольтажа:');
    console.log(`   Записей с NULL вольтажем: ${voltageNull[0].count} (должно быть 0)`);
    
    if (voltageNull[0].count > 0) {
      console.log('   ⚠️  ВНИМАНИЕ: Есть записи с NULL вольтажем!');
    } else {
      console.log('   ✅ Логика работает правильно - не сохраняем NULL вольтаж');
    }
    console.log();
    
    // 4. Проверяем, что данные сохраняются для всех машин
    const carsWithSpeed = await sql`
      SELECT COUNT(DISTINCT car_id) as count
      FROM speed_history
      WHERE timestamp > ${tenMinutesAgo.toISOString()}
    `;
    
    const carsWithVoltage = await sql`
      SELECT COUNT(DISTINCT car_id) as count
      FROM battery_voltage_history
      WHERE timestamp > ${tenMinutesAgo.toISOString()}
    `;
    
    console.log('📊 Охват машин за последние 10 минут:');
    console.log(`   Машин с записями скорости: ${carsWithSpeed[0].count}`);
    console.log(`   Машин с записями вольтажа: ${carsWithVoltage[0].count}`);
    console.log();
    
    // 5. Итоговая оценка
    console.log('📋 ИТОГОВАЯ ОЦЕНКА:');
    if (recentSpeed.length > 0 && recentVoltage.length > 0) {
      console.log('   ✅ Данные сохраняются регулярно');
      console.log(`   ✅ Скорость: ${recentSpeed.length} записей за 10 минут`);
      console.log(`   ✅ Вольтаж: ${recentVoltage.length} записей за 10 минут`);
      
      if (rav4Speed.length > 0 && rav4Voltage.length > 0) {
        console.log(`   ✅ BE021ES: ${rav4Speed.length} записей скорости, ${rav4Voltage.length} записей вольтажа`);
      }
      
      if (speedZeroNotMoving[0].count === 0 && voltageNull[0].count === 0) {
        console.log('   ✅ Логика сохранения работает правильно');
      }
    } else {
      console.log('   ⚠️  Нет данных за последние 10 минут - возможно workflow не выполняется');
    }
    
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    console.error(error.stack);
  } finally {
    await sql.end();
  }
})();

