import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

console.log('\n🔍 Проверка структуры таблицы branches...\n');

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

try {
  // Проверяем структуру таблицы
  const columns = await sql.unsafe(`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_name = 'branches'
    ORDER BY ordinal_position;
  `);
  
  if (columns.length === 0) {
    console.log('❌ Таблица branches не найдена\n');
  } else {
    console.log('📊 Текущая структура таблицы branches:');
    console.log('─────────────────────────────────────────────────────────────');
    columns.forEach(col => {
      console.log(`   ${col.column_name} (${col.data_type})`);
      console.log(`      nullable: ${col.is_nullable}`);
      if (col.column_default) {
        console.log(`      default: ${col.column_default}`);
      }
      console.log('');
    });
    console.log('─────────────────────────────────────────────────────────────\n');
  }
  
  // Проверяем данные
  const rows = await sql.unsafe(`SELECT * FROM branches LIMIT 10;`);
  
  console.log(`📋 Данные в таблице (${rows.length} записей):\n`);
  if (rows.length > 0) {
    rows.forEach((row, i) => {
      console.log(`${i + 1}. ${JSON.stringify(row, null, 2)}`);
    });
  } else {
    console.log('   (таблица пустая)\n');
  }
  
} catch (error) {
  console.error('❌ Ошибка:', error.message);
} finally {
  await sql.end();
}


