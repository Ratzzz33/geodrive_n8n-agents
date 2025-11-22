/**
 * Проверка реальных данных Maserati в БД (после деплоя исправления)
 */

import postgres from 'postgres';

const sql = postgres('postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require', {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

try {
  console.log('🏎️  Проверка данных Maserati ПОСЛЕ деплоя исправления\n');
  console.log('Время пользователя: 14.11.2025, 08:56\n');

  // 1. Последние записи из speed_history
  const speedHistory = await sql`
    SELECT
      sh.speed,
      sh.timestamp,
      sh.is_moving,
      sh.status,
      sh.ignition_on,
      sh.engine_running,
      sh.latitude,
      sh.longitude
    FROM speed_history sh
    JOIN cars c ON c.id = sh.car_id
    WHERE c.plate LIKE '%686%'
    ORDER BY sh.timestamp DESC
    LIMIT 20
  `;

  console.log('📈 ИСТОРИЯ СКОРОСТИ (последние 20 записей):\n');
  
  speedHistory.forEach((row, idx) => {
    const time = new Date(row.timestamp).toLocaleString('ru-RU');
    const speedIcon = Number(row.speed) > 0 ? '🚗' : '🅿️';
    const moving = row.is_moving ? '🚗 движется' : '🅿️ стоит';
    console.log(`   ${idx + 1}. ${speedIcon} ${row.speed} км/ч | ${moving} | ${row.status} | ${time}`);
  });

  // Статистика
  const nonZero = speedHistory.filter(r => Number(r.speed) > 0);
  const maxSpeed = Math.max(...speedHistory.map(r => Number(r.speed)));
  
  console.log(`\n   📊 Статистика за последние записи:`);
  console.log(`   Всего записей: ${speedHistory.length}`);
  console.log(`   С ненулевой скоростью: ${nonZero.length}`);
  console.log(`   Максимальная скорость: ${maxSpeed} км/ч`);

  // 2. Текущие данные из gps_tracking
  const current = await sql`
    SELECT
      c.plate,
      gt.starline_alias,
      gt.speed,
      gt.is_moving,
      gt.distance_moved,
      gt.status,
      gt.battery_voltage,
      gt.gps_level,
      gt.gsm_level,
      gt.last_sync
    FROM gps_tracking gt
    JOIN cars c ON c.id = gt.car_id
    WHERE c.plate LIKE '%686%'
  `;

  if (current.length > 0) {
    const r = current[0];
    console.log(`\n📊 ТЕКУЩИЕ ДАННЫЕ (gps_tracking):\n`);
    console.log(`   Машина: ${r.starline_alias || r.plate}`);
    console.log(`   Скорость: ${r.speed} км/ч ${Number(r.speed) > 0 ? '✅' : '❌'}`);
    console.log(`   Движется: ${r.is_moving} ${r.is_moving ? '🚗' : '🅿️'}`);
    const dist = r.distance_moved != null ? Number(r.distance_moved).toFixed(0) : '0';
    console.log(`   Дистанция: ${dist}m`);
    console.log(`   Статус: ${r.status}`);
    console.log(`   Напряжение: ${r.battery_voltage}V`);
    console.log(`   GPS: ${r.gps_level}/10, GSM: ${r.gsm_level}/31`);
    const lastUpdate = new Date(r.last_sync);
    console.log(`   Обновлено: ${lastUpdate.toLocaleString('ru-RU')}`);
    
    const minutesAgo = Math.floor((new Date() - lastUpdate) / 1000 / 60);
    console.log(`   (${minutesAgo} минут назад)`);
  }

  // 3. Анализ проблемы
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`\n🔍 АНАЛИЗ:\n`);

  if (nonZero.length > 0) {
    console.log(`   ✅ УСПЕХ! Найдены записи с ненулевой скоростью!`);
    console.log(`   Исправление работает. Скорость сохраняется в БД.`);
  } else {
    console.log(`   ❌ Все записи с нулевой скоростью.`);
    console.log(`\n   Возможные причины:`);
    console.log(`   1. Машина движется ОЧЕНЬ медленно (< 1 км/ч)`);
    console.log(`   2. Starline API возвращает pos.s = null/undefined для этой машины`);
    console.log(`   3. GPS качество плохое (gps_offline) - неточные данные`);
    console.log(`   4. Нужно проверить сырой ответ API для этой машины`);
  }

  // 4. Рекомендации
  console.log(`\n💡 РЕКОМЕНДАЦИИ:\n`);
  if (nonZero.length === 0) {
    console.log(`   • Проверить логи starline-monitor на сервере`);
    console.log(`   • Проверить сырой ответ Starline API для device_id Maserati`);
    console.log(`   • Дождаться когда машина будет ехать быстрее (> 10 км/ч)`);
  } else {
    console.log(`   • Всё работает! Telegram бот показывает устаревшие данные.`);
  }

} catch (error) {
  console.error('❌ Ошибка:', error.message);
  console.error(error.stack);
} finally {
  await sql.end();
}

