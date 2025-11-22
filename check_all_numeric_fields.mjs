/**
 * Проверка всех числовых полей GPS данных
 * Убедимся что нет других проблем как со скоростью
 */

import postgres from 'postgres';

const sql = postgres('postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require', {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

try {
  console.log('🔍 Проверка всех числовых полей GPS данных\n');

  // Получаем данные по всем числовым полям
  const data = await sql`
    SELECT
      c.plate,
      gt.starline_alias,
      gt.speed,
      gt.battery_voltage,
      gt.gps_level,
      gt.gsm_level,
      gt.distance_moved,
      gt.is_moving,
      gt.status,
      gt.last_sync
    FROM gps_tracking gt
    JOIN cars c ON c.id = gt.car_id
    ORDER BY gt.last_sync DESC
    LIMIT 30
  `;

  console.log(`✅ Найдено ${data.length} записей\n`);

  // Функция для анализа поля
  function analyzeField(data, fieldName, label) {
    const values = data.map(r => r[fieldName]).filter(v => v !== null && v !== undefined);
    const uniqueValues = [...new Set(values)];
    const min = Math.min(...values.map(v => parseFloat(v) || 0));
    const max = Math.max(...values.map(v => parseFloat(v) || 0));
    const avg = (values.reduce((a, b) => (parseFloat(a) || 0) + (parseFloat(b) || 0), 0) / values.length).toFixed(2);
    const diversity = ((uniqueValues.length / values.length) * 100).toFixed(1);

    console.log(`📊 ${label}:`);
    console.log(`   Уникальных значений: ${uniqueValues.length} из ${values.length} (разнообразие: ${diversity}%)`);
    console.log(`   Диапазон: ${min} - ${max}`);
    console.log(`   Среднее: ${avg}`);

    // Проверка на подозрительные паттерны
    if (uniqueValues.length === 1) {
      console.log(`   ⚠️  ПРОБЛЕМА: Все значения одинаковые (${uniqueValues[0]})!`);
      return false;
    } else if (uniqueValues.length < 3 && values.length > 10) {
      console.log(`   ⚠️  ПОДОЗРИТЕЛЬНО: Слишком мало уникальных значений`);
      return false;
    } else {
      console.log(`   ✅ ОК: Значения различаются`);
      return true;
    }
  }

  // Анализируем каждое поле
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  const results = {
    speed: analyzeField(data, 'speed', '⚡ СКОРОСТЬ (speed)'),
  };
  console.log('');

  results.battery = analyzeField(data, 'battery_voltage', '🔋 НАПРЯЖЕНИЕ БАТАРЕИ (battery_voltage)');
  console.log('');

  results.gps = analyzeField(data, 'gps_level', '📡 GPS УРОВЕНЬ (gps_level)');
  console.log('');

  results.gsm = analyzeField(data, 'gsm_level', '📶 GSM УРОВЕНЬ (gsm_level)');
  console.log('');

  results.distance = analyzeField(data, 'distance_moved', '📏 ДИСТАНЦИЯ (distance_moved)');
  console.log('');

  // Проверяем корреляцию is_moving и speed
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('🔗 Проверка корреляции: is_moving vs speed\n');

  const movingWithSpeed = data.filter(r => r.is_moving && r.speed > 0);
  const movingWithoutSpeed = data.filter(r => r.is_moving && r.speed === 0);
  const notMovingWithSpeed = data.filter(r => !r.is_moving && r.speed > 0);

  console.log(`   Движется + скорость > 0: ${movingWithSpeed.length} машин ✅`);
  console.log(`   Движется + скорость = 0: ${movingWithoutSpeed.length} машин ${movingWithoutSpeed.length > 0 ? '⚠️' : '✅'}`);
  console.log(`   Не движется + скорость > 0: ${notMovingWithSpeed.length} машин ${notMovingWithSpeed.length > 0 ? '⚠️' : '✅'}`);

  if (movingWithoutSpeed.length > 0) {
    console.log(`\n   ⚠️  Примеры машин с противоречием (движется но speed=0):`);
    movingWithoutSpeed.slice(0, 3).forEach(r => {
      console.log(`      ${r.starline_alias || r.plate}: distance=${r.distance_moved.toFixed(0)}m, status=${r.status}`);
    });
  }

  // Итоговый отчет
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('🎯 ИТОГОВЫЙ ОТЧЕТ:\n');

  const allOk = Object.values(results).every(v => v === true);
  
  Object.keys(results).forEach(field => {
    const status = results[field] ? '✅' : '❌';
    const fieldLabels = {
      speed: 'Скорость',
      battery: 'Напряжение батареи',
      gps: 'GPS уровень',
      gsm: 'GSM уровень',
      distance: 'Дистанция'
    };
    console.log(`   ${status} ${fieldLabels[field]}: ${results[field] ? 'корректно' : 'ПРОБЛЕМА!'}`);
  });

  if (allOk) {
    console.log(`\n   🎉 ВСЕ ПОЛЯ ПАРСЯТСЯ И СОХРАНЯЮТСЯ КОРРЕКТНО!`);
  } else {
    console.log(`\n   ⚠️  ОБНАРУЖЕНЫ ПРОБЛЕМЫ В НЕКОТОРЫХ ПОЛЯХ!`);
  }

} catch (error) {
  console.error('❌ Ошибка:', error.message);
} finally {
  await sql.end();
}

