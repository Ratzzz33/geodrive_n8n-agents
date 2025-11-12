import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

try {
  console.log('🔍 Проверка GPS данных для OB700OB и OC700OC\n');

  const gps = await sql`
    SELECT 
      car_id,
      starline_device_id,
      starline_alias,
      current_lat,
      current_lng,
      last_sync,
      c.plate,
      c.car_visual_name
    FROM gps_tracking gt
    JOIN cars c ON c.id = gt.car_id
    WHERE car_id IN ('b4505fd6-ef4d-4462-bbed-86f9a1fcf647', '6593e33f-b4a1-4374-89dd-61dfa7bd69f6')
    ORDER BY last_sync DESC
  `;

  console.log('📍 GPS данные:');
  for (const row of gps) {
    console.log(`\n🚗 ${row.plate} (${row.car_visual_name || row.plate}):`);
    console.log(`   Device ID: ${row.starline_device_id}`);
    console.log(`   Alias: ${row.starline_alias}`);
    console.log(`   Координаты: ${row.current_lat}, ${row.current_lng}`);
    console.log(`   Последняя синхронизация: ${row.last_sync}`);
    
    // Проверяем правильность сопоставления
    if (row.plate === 'OB700OB' && row.starline_device_id !== '864326066742275') {
      console.log(`   ⚠️ ОШИБКА: OB700OB должен иметь device_id 864326066742275, но имеет ${row.starline_device_id}`);
    }
    if (row.plate === 'OC700OC' && row.starline_device_id !== '864326067074728') {
      console.log(`   ⚠️ ОШИБКА: OC700OC должен иметь device_id 864326067074728, но имеет ${row.starline_device_id}`);
    }
  }

} catch (error) {
  console.error('❌ Ошибка:', error);
} finally {
  await sql.end();
}

