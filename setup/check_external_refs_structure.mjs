import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

async function checkExternalRefsStructure() {
  const sql = postgres(CONNECTION_STRING, {
    max: 1,
    ssl: { rejectUnauthorized: false },
  });

  console.log('\n🔍 Проверка структуры таблицы external_refs...\n');

  try {
    // Получить структуру таблицы
    const columns = await sql`
      SELECT 
        column_name,
        data_type,
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_name = 'external_refs'
      ORDER BY ordinal_position;
    `;

    console.log('📋 Колонки в external_refs:');
    columns.forEach((col, idx) => {
      console.log(`   ${idx + 1}. ${col.column_name} (${col.data_type}) ${col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}`);
    });

    // Проверить есть ли поле data
    const hasData = columns.some(col => col.column_name === 'data');
    
    console.log(`\n❓ Поле "data" ${hasData ? '✅ СУЩЕСТВУЕТ' : '❌ НЕ НАЙДЕНО'}`);
    
    if (!hasData) {
      console.log('\n💡 Нужно добавить поле data типа JSONB');
      console.log('   ALTER TABLE external_refs ADD COLUMN data JSONB;');
    }

    // Показать примеры данных
    console.log('\n📊 Примеры записей:');
    const samples = await sql`
      SELECT * FROM external_refs LIMIT 3;
    `;
    
    samples.forEach((row, idx) => {
      console.log(`\n   ${idx + 1}. ${JSON.stringify(row, null, 2)}`);
    });

  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

checkExternalRefsStructure();

