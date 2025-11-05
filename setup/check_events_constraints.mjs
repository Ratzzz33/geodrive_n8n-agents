import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

console.log('\n🔍 Проверка constraints таблицы events...\n');

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

try {
  // Проверка constraints
  const constraints = await sql`
    SELECT 
      conname as constraint_name,
      pg_get_constraintdef(oid) as definition
    FROM pg_constraint
    WHERE conrelid = 'events'::regclass;
  `;
  
  console.log('📊 Constraints:');
  if (constraints.length > 0) {
    constraints.forEach(c => {
      console.log(`   ${c.constraint_name}`);
      console.log(`   ${c.definition}\n`);
    });
  } else {
    console.log('   Нет constraints\n');
  }
  
  // Проверка indexes
  const indexes = await sql`
    SELECT 
      indexname,
      indexdef
    FROM pg_indexes
    WHERE tablename = 'events';
  `;
  
  console.log('📊 Indexes:');
  if (indexes.length > 0) {
    indexes.forEach(i => {
      console.log(`   ${i.indexname}`);
      console.log(`   ${i.indexdef}\n`);
    });
  } else {
    console.log('   Нет indexes\n');
  }
  
  // Проверка структуры таблицы
  const columns = await sql`
    SELECT 
      column_name,
      data_type,
      is_nullable
    FROM information_schema.columns
    WHERE table_name = 'events'
    ORDER BY ordinal_position;
  `;
  
  console.log('📊 Колонки таблицы events:');
  columns.forEach(c => {
    const nullable = c.is_nullable === 'YES' ? 'NULL' : 'NOT NULL';
    console.log(`   ${c.column_name.padEnd(20)} ${c.data_type.padEnd(25)} ${nullable}`);
  });
  console.log('');
  
} catch (error) {
  console.error('❌ Ошибка:', error.message);
  console.error(error);
} finally {
  await sql.end();
}


