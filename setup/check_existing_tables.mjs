import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

async function checkExistingTables() {
  const sql = postgres(CONNECTION_STRING, {
    max: 1,
    ssl: { rejectUnauthorized: false },
  });

  console.log('\n🔍 Проверка существующих таблиц...\n');

  try {
    const tables = ['clients', 'cars', 'bookings'];
    
    for (const tableName of tables) {
      console.log(`\n📋 Таблица: ${tableName}`);
      console.log('─'.repeat(50));
      
      const columns = await sql`
        SELECT 
          column_name,
          data_type,
          is_nullable,
          column_default
        FROM information_schema.columns
        WHERE table_name = ${tableName}
        ORDER BY ordinal_position;
      `;
      
      if (columns.length === 0) {
        console.log('   ❌ Таблица не существует');
        continue;
      }
      
      console.log(`   Колонок: ${columns.length}\n`);
      columns.forEach((col, idx) => {
        const nullable = col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL';
        const defaultVal = col.column_default ? ` DEFAULT ${col.column_default}` : '';
        console.log(`   ${idx + 1}. ${col.column_name} (${col.data_type}) ${nullable}${defaultVal}`);
      });
    }

  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

checkExistingTables();

