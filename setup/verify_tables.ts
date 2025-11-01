/**
 * Проверка создания таблиц n8n
 */

import postgres from 'postgres';

const CONNECTION_STRING = process.env.DATABASE_URL || 
  'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech:5432/neondb?sslmode=require';

async function verifyTables() {
  const sql = postgres(CONNECTION_STRING, {
    ssl: 'require',
    max: 1,
  });

  try {
    console.log('📊 Проверка таблиц...\n');

    const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('events', 'sync_runs', 'health')
      ORDER BY table_name;
    `;

    console.log('✅ Найденные таблицы:');
    for (const table of tables) {
      console.log(`   ✓ ${table.table_name}`);
      
      // Проверяем количество записей
      const count = await sql.unsafe(`SELECT COUNT(*) as count FROM ${sql(table.table_name)}`);
      console.log(`     Записей: ${count[0].count}`);
    }

    // Проверяем структуру таблиц
    console.log('\n📋 Структура таблиц:');
    
    for (const table of tables) {
      const columns = await sql.unsafe(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = '${table.table_name}'
        ORDER BY ordinal_position;
      `);
      console.log(`\n   ${table.table_name}:`);
      columns.forEach(col => {
        console.log(`     - ${col.column_name}: ${col.data_type}`);
      });
    }

  } catch (error: any) {
    console.error('❌ Ошибка:', error.message);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

verifyTables();

