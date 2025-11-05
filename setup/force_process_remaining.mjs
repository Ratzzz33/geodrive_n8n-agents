import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 10,
  ssl: { rejectUnauthorized: false }
});

async function forceProcessRemaining() {
  console.log('🔧 Принудительная обработка оставшихся 50 броней\n');
  
  try {
    // Получить ID необработанных броней
    const unprocessedIds = await sql`
      SELECT id
      FROM bookings
      WHERE data IS NOT NULL 
        AND data::TEXT != '{}' 
        AND data::TEXT != 'null'
      ORDER BY created_at DESC
    `;
    
    console.log(`Найдено необработанных броней: ${unprocessedIds.length}\n`);
    
    let processedCount = 0;
    let errorCount = 0;
    
    for (const { id } of unprocessedIds) {
      try {
        // Принудительно вызвать триггер через UPDATE
        await sql`
          UPDATE bookings
          SET updated_at = NOW()
          WHERE id = ${id}
        `;
        
        processedCount++;
        if (processedCount % 10 === 0) {
          console.log(`   ✅ Обработано: ${processedCount}/${unprocessedIds.length}`);
        }
      } catch (error) {
        console.error(`   ❌ Ошибка для ${id}:`, error.message);
        errorCount++;
      }
    }
    
    console.log(`\n✅ Завершено: ${processedCount} успешно, ${errorCount} ошибок\n`);
    
    // Финальная проверка
    const finalStats = await sql`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE data::TEXT = '{}') as processed,
        COUNT(*) FILTER (WHERE data IS NOT NULL AND data::TEXT != '{}' AND data::TEXT != 'null') as remaining
      FROM bookings
    `.then(rows => rows[0]);
    
    console.log('📊 Финальная статистика:');
    console.log(`   Всего: ${finalStats.total}`);
    console.log(`   Обработано: ${finalStats.processed} (${((parseInt(finalStats.processed) / parseInt(finalStats.total)) * 100).toFixed(2)}%)`);
    console.log(`   Осталось: ${finalStats.remaining}`);
    
    if (parseInt(finalStats.remaining) === 0) {
      console.log('\n🎉 ВСЕ БРОНИ ОБРАБОТАНЫ!');
    } else {
      console.log(`\n⚠️ Всё ещё осталось ${finalStats.remaining} необработанных`);
      
      // Показать пример проблемной брони
      const sample = await sql`
        SELECT id, data, car_id, client_id, start_date
        FROM bookings
        WHERE data IS NOT NULL 
          AND data::TEXT != '{}' 
          AND data::TEXT != 'null'
        LIMIT 1
      `.then(rows => rows[0]);
      
      if (sample) {
        console.log('\nПример необработанной брони:');
        console.log(`   ID: ${sample.id}`);
        console.log(`   car_id: ${sample.car_id}`);
        console.log(`   client_id: ${sample.client_id}`);
        console.log(`   start_date: ${sample.start_date}`);
        console.log(`   data length: ${sample.data ? JSON.stringify(sample.data).length : 0} chars`);
      }
    }
    
  } catch (error) {
    console.error('❌ Ошибка:', error);
    throw error;
  } finally {
    await sql.end();
  }
}

forceProcessRemaining().catch(error => {
  console.error(error);
  process.exit(1);
});

