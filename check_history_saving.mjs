import postgres from 'postgres';
import 'dotenv/config';

const sql = postgres(process.env.DATABASE_URL);

(async () => {
  try {
    console.log('🔍 Проверка процесса сохранения истории скорости и вольтажа...\n');
    
    // 1. Проверяем последние записи по времени
    const recentSpeed = await sql`
      SELECT 
        c.plate,
        c.model,
        sh.speed,
        sh.timestamp,
        sh.is_moving,
        sh.ignition_on,
        sh.engine_running,
        sh.status
      FROM speed_history sh
      JOIN cars c ON c.id = sh.car_id
      ORDER BY sh.timestamp DESC
      LIMIT 10
    `;
    
    console.log('📈 Последние 10 записей скорости:');
    recentSpeed.forEach((r, i) => {
      console.log(`   ${i + 1}. ${r.plate} (${r.model || 'N/A'}): ${Number(r.speed).toFixed(0)} км/ч, ${r.timestamp.toISOString()}, движется: ${r.is_moving}, статус: ${r.status}`);
    });
    console.log();
    
    // 2. Проверяем последние записи вольтажа
    const recentVoltage = await sql`
      SELECT 
        c.plate,
        c.model,
        bvh.battery_voltage,
        bvh.timestamp,
        bvh.ignition_on,
        bvh.engine_running,
        bvh.status
      FROM battery_voltage_history bvh
      JOIN cars c ON c.id = bvh.car_id
      ORDER BY bvh.timestamp DESC
      LIMIT 10
    `;
    
    console.log('🔋 Последние 10 записей вольтажа:');
    recentVoltage.forEach((r, i) => {
      console.log(`   ${i + 1}. ${r.plate} (${r.model || 'N/A'}): ${Number(r.battery_voltage).toFixed(2)}V, ${r.timestamp.toISOString()}, зажигание: ${r.ignition_on}, двигатель: ${r.engine_running}, статус: ${r.status}`);
    });
    console.log();
    
    // 3. Проверяем частоту сохранения (записи за последний час)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    
    const speedLastHour = await sql`
      SELECT COUNT(*) as count
      FROM speed_history
      WHERE timestamp > ${oneHourAgo.toISOString()}
    `;
    
    const voltageLastHour = await sql`
      SELECT COUNT(*) as count
      FROM battery_voltage_history
      WHERE timestamp > ${oneHourAgo.toISOString()}
    `;
    
    console.log('⏱️  Записи за последний час:');
    console.log(`   Скорость: ${speedLastHour[0].count} записей`);
    console.log(`   Вольтаж: ${voltageLastHour[0].count} записей`);
    console.log();
    
    // 4. Проверяем распределение по машинам
    const speedByCar = await sql`
      SELECT 
        c.plate,
        COUNT(sh.id) as records_count,
        MAX(sh.timestamp) as last_record
      FROM speed_history sh
      JOIN cars c ON c.id = sh.car_id
      GROUP BY c.plate
      ORDER BY records_count DESC
      LIMIT 10
    `;
    
    console.log('📊 Топ-10 машин по количеству записей скорости:');
    speedByCar.forEach((r, i) => {
      console.log(`   ${i + 1}. ${r.plate}: ${r.records_count} записей, последняя: ${r.last_record.toISOString()}`);
    });
    console.log();
    
    const voltageByCar = await sql`
      SELECT 
        c.plate,
        COUNT(bvh.id) as records_count,
        MAX(bvh.timestamp) as last_record
      FROM battery_voltage_history bvh
      JOIN cars c ON c.id = bvh.car_id
      GROUP BY c.plate
      ORDER BY records_count DESC
      LIMIT 10
    `;
    
    console.log('📊 Топ-10 машин по количеству записей вольтажа:');
    voltageByCar.forEach((r, i) => {
      console.log(`   ${i + 1}. ${r.plate}: ${r.records_count} записей, последняя: ${r.last_record.toISOString()}`);
    });
    console.log();
    
    // 5. Проверяем, что записи добавляются регулярно (интервал между записями)
    const speedIntervals = await sql`
      SELECT 
        c.plate,
        sh.timestamp,
        LAG(sh.timestamp) OVER (PARTITION BY sh.car_id ORDER BY sh.timestamp) as prev_timestamp
      FROM speed_history sh
      JOIN cars c ON c.id = sh.car_id
      WHERE sh.car_id = (SELECT id FROM cars WHERE plate = 'BE021ES' LIMIT 1)
      ORDER BY sh.timestamp DESC
      LIMIT 5
    `;
    
    console.log('⏱️  Интервалы между записями скорости для BE021ES (последние 5):');
    speedIntervals.forEach((r, i) => {
      if (r.prev_timestamp) {
        const interval = (new Date(r.timestamp) - new Date(r.prev_timestamp)) / 1000 / 60; // минуты
        console.log(`   ${i + 1}. ${r.timestamp.toISOString()} (интервал: ${interval.toFixed(1)} мин)`);
      } else {
        console.log(`   ${i + 1}. ${r.timestamp.toISOString()} (первая запись)`);
      }
    });
    console.log();
    
    // 6. Проверяем, что скорость сохраняется даже при speed = 0 (если is_moving = true)
    const zeroSpeedMoving = await sql`
      SELECT COUNT(*) as count
      FROM speed_history
      WHERE speed = 0 AND is_moving = true
    `;
    
    console.log('📊 Записи с нулевой скоростью, но движением:');
    console.log(`   ${zeroSpeedMoving[0].count} записей`);
    console.log();
    
    // 7. Проверяем, что вольтаж сохраняется только когда он есть
    const voltageNull = await sql`
      SELECT COUNT(*) as count
      FROM battery_voltage_history
      WHERE battery_voltage IS NULL
    `;
    
    console.log('📊 Записи вольтажа с NULL:');
    console.log(`   ${voltageNull[0].count} записей (должно быть 0)`);
    
    if (voltageNull[0].count > 0) {
      console.log('   ⚠️  ВНИМАНИЕ: Есть записи с NULL вольтажем!');
    }
    
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    console.error(error.stack);
  } finally {
    await sql.end();
  }
})();

