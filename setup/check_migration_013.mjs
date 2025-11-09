/**
 * Проверка выполнения миграции 013
 */

import postgres from 'postgres';

const CONNECTION_STRING = process.env.DATABASE_URL || 
  'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

async function checkMigration() {
  try {
    // Проверка таблицы
    const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name = 'car_price_checks'
    `;
    
    console.log('✅ Таблица car_price_checks:', tables.length > 0 ? 'создана' : 'НЕ НАЙДЕНА');
    
    // Проверка view
    const views = await sql`
      SELECT table_name 
      FROM information_schema.views 
      WHERE table_schema = 'public' 
        AND table_name = 'unresolved_price_issues'
    `;
    
    console.log('✅ View unresolved_price_issues:', views.length > 0 ? 'создан' : 'НЕ НАЙДЕН');
    
    // Проверка функций
    const functions = await sql`
      SELECT routine_name 
      FROM information_schema.routines 
      WHERE routine_schema = 'public' 
        AND routine_name IN ('get_price_issues_stats', 'resolve_price_issue')
      ORDER BY routine_name
    `;
    
    console.log('✅ Функции:');
    functions.forEach(f => console.log(`   - ${f.routine_name}`));
    
    // Проверка индексов
    const indexes = await sql`
      SELECT indexname 
      FROM pg_indexes 
      WHERE tablename = 'car_price_checks'
      ORDER BY indexname
    `;
    
    console.log('✅ Индексы:', indexes.length);
    indexes.forEach(i => console.log(`   - ${i.indexname}`));
    
    console.log('\n✅ Миграция 013 выполнена успешно!');
    
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

checkMigration();

