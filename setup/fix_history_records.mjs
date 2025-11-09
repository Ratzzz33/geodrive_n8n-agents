/**
 * Исправление записей в history - заполнение entity_type и operation_type из raw_data
 */

import postgres from 'postgres';

const sql = postgres('postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require', {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  console.log('🔧 Исправление записей в history\n');

  try {
    // 1. Проверим несколько записей
    console.log('📊 Примеры записей в history:');
    const samples = await sql`
      SELECT id, entity_id, operation_id, branch, ts, raw_data
      FROM history
      LIMIT 5
    `;
    
    samples.forEach((record, i) => {
      console.log(`\nЗапись ${i + 1}:`);
      console.log(`  ID: ${record.id}`);
      console.log(`  Branch: ${record.branch}`);
      console.log(`  Entity ID: ${record.entity_id}`);
      console.log(`  Operation ID: ${record.operation_id}`);
      console.log(`  Raw Data:`, JSON.stringify(record.raw_data, null, 2).substring(0, 200));
    });
    console.log();

    // 2. Анализ типов из raw_data
    console.log('📊 Анализ типов операций из raw_data:');
    const typeAnalysis = await sql`
      SELECT 
        raw_data->>'object_type' as object_type,
        raw_data->>'event_type' as event_type,
        COUNT(*) as count
      FROM history
      WHERE raw_data IS NOT NULL
      GROUP BY raw_data->>'object_type', raw_data->>'event_type'
      ORDER BY count DESC
    `;
    
    typeAnalysis.forEach(row => {
      console.log(`  ${row.object_type || 'null'} / ${row.event_type || 'null'}: ${row.count}`);
    });
    console.log();

    // 3. Проверим структуру одной записи подробно
    console.log('📊 Подробная структура одной записи:');
    const [detailed] = await sql`
      SELECT raw_data
      FROM history
      WHERE raw_data IS NOT NULL
      LIMIT 1
    `;
    
    if (detailed) {
      console.log('Полная структура raw_data:');
      console.log(JSON.stringify(detailed.raw_data, null, 2));
      console.log();
      
      // Ключи верхнего уровня
      const keys = Object.keys(detailed.raw_data || {});
      console.log('Доступные ключи:', keys.join(', '));
      console.log();
    }

    // 4. Подсчитаем, сколько записей можно исправить
    console.log('📊 Анализ возможности исправления:');
    const fixableCount = await sql`
      SELECT 
        COUNT(*) FILTER (WHERE raw_data->>'object_type' IS NOT NULL) as has_object_type,
        COUNT(*) FILTER (WHERE raw_data->>'event_type' IS NOT NULL) as has_event_type,
        COUNT(*) FILTER (WHERE raw_data->>'id' IS NOT NULL) as has_id,
        COUNT(*) as total
      FROM history
    `;
    
    console.log(`  Всего записей: ${fixableCount[0].total}`);
    console.log(`  С object_type: ${fixableCount[0].has_object_type}`);
    console.log(`  С event_type: ${fixableCount[0].has_event_type}`);
    console.log(`  С id: ${fixableCount[0].has_id}`);
    console.log();

    // 5. Предложение плана исправления
    console.log('📋 План исправления:');
    console.log('  1. entity_type = raw_data->>"object_type" (booking/car/client)');
    console.log('  2. operation_type = raw_data->>"event_type" (created/updated/deleted)');
    console.log('  3. processed = true');
    console.log();

  } catch (error) {
    console.error('❌ Ошибка:', error);
  } finally {
    await sql.end();
  }
}

main().catch(console.error);

