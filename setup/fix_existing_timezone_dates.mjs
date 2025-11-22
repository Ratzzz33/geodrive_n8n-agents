#!/usr/bin/env node

import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

async function fixExistingDates() {
  try {
    console.log('🔧 Исправление существующих дат в формате UTC на Asia/Tbilisi\n');
    console.log('='.repeat(80));
    
    // Сначала проверим сколько записей нужно обновить
    const countBefore = await sql`
      SELECT COUNT(*) as count
      FROM bookings
      WHERE start_date LIKE '%+00' OR end_date LIKE '%+00'
    `;
    
    console.log(`📊 Найдено записей с UTC форматом: ${countBefore[0].count}`);
    
    if (countBefore[0].count === 0) {
      console.log('✅ Все записи уже в правильном формате');
      return;
    }
    
    console.log('\n⏳ Обновление записей...');
    
    // Обновляем записи
    const result = await sql`
      UPDATE bookings
      SET
        -- Конвертируем start_date из UTC в Asia/Tbilisi
        start_date = CASE
          WHEN start_at IS NOT NULL THEN
            TO_CHAR(start_at AT TIME ZONE 'Asia/Tbilisi', 'YYYY-MM-DD HH24:MI:SS') || '+04'
          WHEN start_date IS NOT NULL AND start_date LIKE '%+00' THEN
            -- Конвертируем существующий UTC формат в Asia/Tbilisi
            TO_CHAR((start_date::timestamptz) AT TIME ZONE 'Asia/Tbilisi', 'YYYY-MM-DD HH24:MI:SS') || '+04'
          ELSE start_date
        END,
        -- Конвертируем end_date из UTC в Asia/Tbilisi
        end_date = CASE
          WHEN end_at IS NOT NULL THEN
            TO_CHAR(end_at AT TIME ZONE 'Asia/Tbilisi', 'YYYY-MM-DD HH24:MI:SS') || '+04'
          WHEN end_date IS NOT NULL AND end_date LIKE '%+00' THEN
            -- Конвертируем существующий UTC формат в Asia/Tbilisi
            TO_CHAR((end_date::timestamptz) AT TIME ZONE 'Asia/Tbilisi', 'YYYY-MM-DD HH24:MI:SS') || '+04'
          ELSE end_date
        END
      WHERE start_date LIKE '%+00' OR end_date LIKE '%+00'
         OR (start_at IS NOT NULL AND (start_date IS NULL OR start_date NOT LIKE '%+04'))
         OR (end_at IS NOT NULL AND (end_date IS NULL OR end_date NOT LIKE '%+04'))
      RETURNING id
    `;
    
    console.log(`✅ Обновлено записей: ${result.length}`);
    
    // Проверяем результат
    const countAfter = await sql`
      SELECT 
        COUNT(*) FILTER (WHERE start_date LIKE '%+00' OR end_date LIKE '%+00') as utc_count,
        COUNT(*) FILTER (WHERE start_date LIKE '%+04' OR end_date LIKE '%+04') as tbilisi_count
      FROM bookings
      WHERE start_at IS NOT NULL OR end_at IS NOT NULL
    `;
    
    console.log('\n📊 Результат:');
    console.log(`   UTC формат (+00): ${countAfter[0].utc_count}`);
    console.log(`   Asia/Tbilisi формат (+04): ${countAfter[0].tbilisi_count}`);
    
    if (countAfter[0].utc_count > 0) {
      console.log(`\n⚠️  Осталось ${countAfter[0].utc_count} записей с UTC форматом`);
    } else {
      console.log('\n✅ Все записи обновлены на формат Asia/Tbilisi!');
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('✅ Исправление завершено');
    
  } catch (error) {
    console.error('❌ Ошибка:', error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

fixExistingDates();

