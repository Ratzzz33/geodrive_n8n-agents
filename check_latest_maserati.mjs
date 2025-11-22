import postgres from 'postgres';

const sql = postgres('postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require', {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

try {
  console.log('🏎️  Последние записи Maserati:\n');

  const recent = await sql`
    SELECT
      sh.speed,
      sh.timestamp,
      sh.is_moving,
      sh.status
    FROM speed_history sh
    JOIN cars c ON c.id = sh.car_id
    WHERE c.plate LIKE '%686%'
    ORDER BY sh.timestamp DESC
    LIMIT 5
  `;

  recent.forEach((row, idx) => {
    const time = new Date(row.timestamp).toLocaleString('ru-RU');
    const speedIcon = Number(row.speed) > 0 ? '🚗' : '🅿️';
    console.log(`   ${idx + 1}. ${speedIcon} ${row.speed} км/ч | ${row.is_moving ? '🚗' : '🅿️'} | ${row.status} | ${time}`);
  });

  if (recent.some(r => Number(r.speed) > 0)) {
    console.log(`\n   🎉 НЕНУЛЕВАЯ СКОРОСТЬ НАЙДЕНА!`);
  } else {
    console.log(`\n   ❌ Всё равно скорость 0`);
  }

} finally {
  await sql.end();
}

