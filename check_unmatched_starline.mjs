import postgres from 'postgres';

const CONNECTION_STRING = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

try {
  console.log('🔍 Поиск несопоставленных трекеров Starline...\n');

  // Получаем все несопоставленные устройства
  const unmatched = await sql`
    SELECT 
      device_id,
      alias,
      extracted_model,
      extracted_digits,
      active,
      last_seen,
      match_method,
      match_notes
    FROM starline_devices
    WHERE matched = FALSE
       OR car_id IS NULL
    ORDER BY active DESC, alias ASC
  `;

  console.log(`📊 Всего несопоставленных трекеров: ${unmatched.length}\n`);

  if (unmatched.length === 0) {
    console.log('✅ Все трекеры сопоставлены!');
  } else {
    console.log('📋 Список несопоставленных трекеров:\n');
    console.log('─'.repeat(80));
    
    unmatched.forEach((device, index) => {
      console.log(`${index + 1}. ${device.alias || 'Без названия'}`);
      console.log(`   Device ID (IMEI): ${device.device_id}`);
      if (device.extracted_model) {
        console.log(`   Модель: ${device.extracted_model}`);
      }
      if (device.extracted_digits) {
        console.log(`   Цифры: ${device.extracted_digits}`);
      }
      console.log(`   Активен: ${device.active ? '✅' : '❌'}`);
      if (device.last_seen) {
        const lastSeen = new Date(device.last_seen);
        console.log(`   Последний раз видели: ${lastSeen.toLocaleString('ru-RU')}`);
      }
      if (device.match_method) {
        console.log(`   Метод сопоставления: ${device.match_method}`);
      }
      if (device.match_notes) {
        console.log(`   Заметки: ${device.match_notes}`);
      }
      console.log('');
    });
    
    console.log('─'.repeat(80));
    console.log(`\n💡 Всего: ${unmatched.length} несопоставленных трекеров`);
    
    const activeCount = unmatched.filter(d => d.active).length;
    const inactiveCount = unmatched.length - activeCount;
    console.log(`   ✅ Активных: ${activeCount}`);
    console.log(`   ❌ Неактивных: ${inactiveCount}`);
  }

} catch (error) {
  console.error('❌ Ошибка:', error.message);
  process.exit(1);
} finally {
  await sql.end();
}

