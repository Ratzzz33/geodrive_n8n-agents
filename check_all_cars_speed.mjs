/**
 * Проверка скорости ВСЕХ машин - есть ли хоть одна с speed > 0
 */

import postgres from 'postgres';

const sql = postgres('postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require', {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

try {
  console.log('🚗 Проверка скорости ВСЕХ машин в БД\n');

  // Последние записи из speed_history
  const recentSpeeds = await sql`
    SELECT
      c.plate,
      sh.starline_device_id as device_alias,
      sh.speed,
      sh.status,
      sh.timestamp
    FROM speed_history sh
    JOIN cars c ON c.id = sh.car_id
    WHERE sh.timestamp > NOW() - INTERVAL '10 minutes'
    ORDER BY sh.timestamp DESC
    LIMIT 50
  `;

  console.log(`📊 Последние 50 записей скорости за 10 минут:\n`);

  const withSpeed = recentSpeeds.filter(r => Number(r.speed) > 0);
  const withoutSpeed = recentSpeeds.filter(r => Number(r.speed) === 0);

  console.log(`   С ненулевой скоростью: ${withSpeed.length}`);
  console.log(`   С нулевой скоростью: ${withoutSpeed.length}`);

  if (withSpeed.length > 0) {
    console.log(`\n✅ УСПЕХ! Найдены машины с ненулевой скоростью:\n`);
    withSpeed.forEach(r => {
      const time = new Date(r.timestamp).toLocaleTimeString('ru-RU');
      console.log(`   🚗 ${r.plate}: ${r.speed} км/ч | ${r.status} | ${time}`);
    });
  } else {
    console.log(`\n❌ Все машины стоят или движутся медленно (speed = 0)`);
    console.log(`   Это нормально если сейчас ночь или нет активных поездок`);
  }

  // Проверяем gps_tracking
  console.log(`\n📊 Текущие данные из gps_tracking:\n`);
  
  const currentTracking = await sql`
    SELECT
      c.plate,
      gt.starline_alias,
      gt.speed,
      gt.is_moving,
      gt.status,
      gt.last_sync
    FROM gps_tracking gt
    JOIN cars c ON c.id = gt.car_id
    WHERE gt.last_sync > NOW() - INTERVAL '10 minutes'
    ORDER BY gt.speed DESC
    LIMIT 10
  `;

  console.log(`   Топ 10 машин по скорости (последние 10 минут):\n`);
  currentTracking.forEach((r, idx) => {
    const speed = Number(r.speed).toFixed(0);
    const icon = speed > 0 ? '🚗' : '🅿️';
    const time = new Date(r.last_sync).toLocaleTimeString('ru-RU');
    console.log(`   ${idx + 1}. ${icon} ${r.starline_alias || r.plate}: ${speed} км/ч | ${r.status} | ${time}`);
  });

  const anyMoving = currentTracking.some(r => Number(r.speed) > 0);
  
  if (anyMoving) {
    console.log(`\n🎉 ОТЛИЧНО! Исправление работает - есть машины с ненулевой скоростью!`);
  } else {
    console.log(`\n💡 Все машины стоят. Это нормально если:`)
    console.log(`   • Сейчас ночь/утро (мало активных поездок)`);
    console.log(`   • GPS устройства в режиме gps_offline`);
    console.log(`   • Машины припаркованы`);
    console.log(`\n   Подождите когда какая-то машина начнет двигаться - скорость появится.`);
  }

} catch (error) {
  console.error('❌ Ошибка:', error.message);
} finally {
  await sql.end();
}

