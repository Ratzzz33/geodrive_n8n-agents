import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

async function addDataColumn() {
  const sql = postgres(CONNECTION_STRING, {
    max: 1,
    ssl: { rejectUnauthorized: false },
  });

  console.log('\n📝 Добавление поля "data" в таблицу external_refs...\n');

  try {
    // Добавить колонку data
    await sql`
      ALTER TABLE external_refs 
      ADD COLUMN IF NOT EXISTS data JSONB;
    `;
    
    console.log('✅ Поле "data" (JSONB) добавлено!');
    
    // Проверить результат
    const columns = await sql`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'external_refs'
      AND column_name IN ('data', 'meta')
      ORDER BY column_name;
    `;
    
    console.log('\n📋 Проверка:');
    columns.forEach(col => {
      console.log(`   ✓ ${col.column_name}: ${col.data_type}`);
    });
    
    console.log('\n💡 Теперь workflow может сохранять данные в поле "data"');

  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

addDataColumn();

