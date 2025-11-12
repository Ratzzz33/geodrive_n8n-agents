#!/usr/bin/env node
import postgres from 'postgres';
import 'dotenv/config';

const sql = postgres(process.env.DATABASE_URL);

async function checkMatched() {
  try {
    // Проверяем общую статистику
    const stats = await sql`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN matched = TRUE THEN 1 END) as matched,
        COUNT(CASE WHEN car_id IS NOT NULL THEN 1 END) as with_car_id,
        COUNT(CASE WHEN matched = TRUE AND car_id IS NOT NULL THEN 1 END) as matched_with_car
      FROM starline_devices 
      WHERE active = TRUE
    `;
    
    console.log('📊 Статистика starline_devices:');
    console.log(JSON.stringify(stats[0], null, 2));
    
    // Проверяем записи с matched = TRUE
    const matchedDevices = await sql`
      SELECT 
        sd.device_id,
        sd.alias,
        sd.matched,
        sd.car_id,
        c.plate,
        c.car_visual_name as brand,
        c.model
      FROM starline_devices sd
      LEFT JOIN cars c ON c.id = sd.car_id
      WHERE sd.active = TRUE 
        AND sd.matched = TRUE
      LIMIT 10
    `;
    
    console.log(`\n🔗 Устройства с matched = TRUE (первые 10):`);
    console.log(JSON.stringify(matchedDevices, null, 2));
    
    // Проверяем записи с car_id но без matched
    const withCarButNotMatched = await sql`
      SELECT 
        sd.device_id,
        sd.alias,
        sd.matched,
        sd.car_id
      FROM starline_devices sd
      WHERE sd.active = TRUE 
        AND sd.car_id IS NOT NULL
        AND sd.matched = FALSE
      LIMIT 5
    `;
    
    console.log(`\n⚠️ Устройства с car_id но matched = FALSE (первые 5):`);
    console.log(JSON.stringify(withCarButNotMatched, null, 2));
    
  } catch (error) {
    console.error('❌ Ошибка:', error);
  } finally {
    await sql.end();
  }
}

checkMatched();

