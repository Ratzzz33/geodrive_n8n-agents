/**
 * Проверка данных о напряжении батареи в БД
 * Сравнение с актуальными данными Starline API
 */

import postgres from 'postgres';

const sql = postgres('postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require', {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

try {
  console.log('📊 Проверка данных о напряжении батареи в БД\n');

  // 1. Проверяем текущие значения voltage по машинам
  const voltageData = await sql`
    SELECT
      c.plate,
      gt.starline_alias,
      gt.battery_voltage,
      gt.last_sync,
      gt.status,
      gt.is_moving
    FROM gps_tracking gt
    JOIN cars c ON c.id = gt.car_id
    WHERE gt.battery_voltage IS NOT NULL
    ORDER BY gt.last_sync DESC
    LIMIT 30
  `;

  console.log(`✅ Найдено ${voltageData.length} записей с напряжением батареи:\n`);

  // Группируем по уникальным значениям voltage
  const voltageGroups = {};
  voltageData.forEach(row => {
    const v = row.battery_voltage;
    if (!voltageGroups[v]) voltageGroups[v] = [];
    voltageGroups[v].push(`${row.starline_alias || row.plate}`);
  });

  console.log('📈 Распределение значений напряжения:');
  Object.keys(voltageGroups)
    .sort((a, b) => parseFloat(b) - parseFloat(a))
    .forEach(voltage => {
      const count = voltageGroups[voltage].length;
      const cars = voltageGroups[voltage].slice(0, 3).join(', ');
      console.log(`   ${voltage}V: ${count} машин (${cars}${count > 3 ? '...' : ''})`);
    });

  // 2. Статистика по уникальным значениям
  const uniqueVoltages = Object.keys(voltageGroups).length;
  const totalCars = voltageData.length;
  
  console.log(`\n📊 Статистика:`);
  console.log(`   Уникальных значений напряжения: ${uniqueVoltages}`);
  console.log(`   Всего записей: ${totalCars}`);
  console.log(`   Разнообразие: ${((uniqueVoltages / totalCars) * 100).toFixed(1)}%`);

  // 3. Проверяем диапазон значений
  const voltages = voltageData.map(r => parseFloat(r.battery_voltage)).filter(v => !isNaN(v));
  const minV = Math.min(...voltages);
  const maxV = Math.max(...voltages);
  const avgV = (voltages.reduce((a, b) => a + b, 0) / voltages.length).toFixed(2);

  console.log(`\n📉 Диапазон значений:`);
  console.log(`   Минимум: ${minV}V`);
  console.log(`   Максимум: ${maxV}V`);
  console.log(`   Среднее: ${avgV}V`);

  // 4. Проверяем есть ли подозрительные паттерны (все одинаковые значения)
  if (uniqueVoltages === 1) {
    console.log(`\n⚠️  ПРОБЛЕМА: ВСЕ машины имеют одинаковое напряжение: ${Object.keys(voltageGroups)[0]}V`);
    console.log('   Это подозрительно - возможна та же проблема что была со скоростью!');
  } else if (uniqueVoltages < 5 && totalCars > 10) {
    console.log(`\n⚠️  ПОДОЗРИТЕЛЬНО: Слишком мало уникальных значений (${uniqueVoltages}) для ${totalCars} машин`);
  } else {
    console.log(`\n✅ ХОРОШО: Значения напряжения различаются между машинами (${uniqueVoltages} уникальных значений)`);
  }

  // 5. Примеры конкретных машин
  console.log(`\n📋 Примеры (последние 10 машин):`);
  voltageData.slice(0, 10).forEach(row => {
    const time = new Date(row.last_sync).toLocaleString('ru-RU');
    console.log(`   ${row.starline_alias || row.plate}: ${row.battery_voltage}V | ${row.status} | ${time}`);
  });

  // 6. Проверяем историю изменений для одной машины (Maserati)
  const maseratiHistory = await sql`
    SELECT
      battery_voltage,
      last_sync,
      status
    FROM gps_tracking gt
    JOIN cars c ON c.id = gt.car_id
    WHERE c.plate LIKE '%686%' OR gt.starline_alias LIKE '%Maserati%'
    ORDER BY last_sync DESC
    LIMIT 5
  `;

  if (maseratiHistory.length > 0) {
    console.log(`\n🏎️ История напряжения Maserati (последние записи):`);
    const voltageChanges = new Set(maseratiHistory.map(r => r.battery_voltage));
    maseratiHistory.forEach(row => {
      const time = new Date(row.last_sync).toLocaleString('ru-RU');
      console.log(`   ${row.battery_voltage}V | ${time}`);
    });
    
    if (voltageChanges.size === 1) {
      console.log(`   ⚠️  Напряжение не меняется: всегда ${[...voltageChanges][0]}V`);
    } else {
      console.log(`   ✅ Напряжение меняется: ${voltageChanges.size} разных значений`);
    }
  }

} catch (error) {
  console.error('❌ Ошибка:', error.message);
} finally {
  await sql.end();
}

