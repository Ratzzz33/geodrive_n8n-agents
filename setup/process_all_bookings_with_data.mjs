#!/usr/bin/env node
import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 10,
  ssl: { rejectUnauthorized: false }
});

async function processAllBookingsWithData() {
  console.log('🔄 Обработка всех броней с непустым data...\n');
  
  try {
    // Подсчитать брони с непустым data
    const totalCount = await sql`
      SELECT COUNT(*) as count
      FROM bookings
      WHERE data IS NOT NULL 
        AND data::TEXT != '{}'
        AND data::TEXT != 'null'
    `.then(rows => parseInt(rows[0].count));
    
    console.log(`📊 Найдено броней для обработки: ${totalCount}\n`);
    
    if (totalCount === 0) {
      console.log('✅ Все брони уже обработаны!');
      return;
    }
    
    // Обрабатываем батчами по 100
    const batchSize = 100;
    let processed = 0;
    let errors = 0;
    
    while (processed < totalCount) {
      // Получить следующий батч
      const batch = await sql`
        SELECT id
        FROM bookings
        WHERE data IS NOT NULL 
          AND data::TEXT != '{}'
          AND data::TEXT != 'null'
        ORDER BY created_at DESC
        LIMIT ${batchSize}
      `;
      
      if (batch.length === 0) break;
      
      console.log(`\n📦 Обработка батча: ${processed + 1}-${Math.min(processed + batch.length, totalCount)} из ${totalCount}`);
      
      // Обработать каждую бронь (UPDATE запустит триггер)
      for (const booking of batch) {
        try {
          // UPDATE с SET data = data запустит триггер
          // Триггер обработает данные и очистит data
          await sql`
            UPDATE bookings
            SET updated_at = NOW()
            WHERE id = ${booking.id}
          `;
          
          processed++;
          
          if (processed % 10 === 0) {
            process.stdout.write(`   Обработано: ${processed}/${totalCount}\r`);
          }
        } catch (error) {
          errors++;
          if (errors <= 5) {
            console.error(`\n   ❌ Ошибка обработки брони ${booking.id}: ${error.message}`);
          }
        }
      }
    }
    
    console.log(`\n\n✅ Обработка завершена!`);
    console.log(`   Обработано: ${processed}`);
    console.log(`   Ошибок: ${errors}`);
    
    // Проверить результат
    const remainingCount = await sql`
      SELECT COUNT(*) as count
      FROM bookings
      WHERE data IS NOT NULL 
        AND data::TEXT != '{}'
        AND data::TEXT != 'null'
    `.then(rows => parseInt(rows[0].count));
    
    console.log(`   Осталось необработанных: ${remainingCount}`);
    
    // Показать статистику
    const stats = await sql`
      SELECT 
        COUNT(*) FILTER (WHERE data::TEXT = '{}') as processed,
        COUNT(*) FILTER (WHERE car_id IS NOT NULL) as with_car,
        COUNT(*) FILTER (WHERE client_id IS NOT NULL) as with_client,
        COUNT(*) FILTER (WHERE start_date IS NOT NULL) as with_dates,
        COUNT(*) as total
      FROM bookings
    `.then(rows => rows[0]);
    
    console.log(`\n📊 Статистика:`);
    console.log(`   Всего броней: ${stats.total}`);
    console.log(`   Обработано (data = {}): ${stats.processed}`);
    console.log(`   С привязкой к машине: ${stats.with_car}`);
    console.log(`   С привязкой к клиенту: ${stats.with_client}`);
    console.log(`   С датами: ${stats.with_dates}`);
    
  } catch (error) {
    console.error('❌ Критическая ошибка:', error.message);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

processAllBookingsWithData();

