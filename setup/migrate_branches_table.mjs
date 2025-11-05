import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

console.log('\n📋 Создание таблицы branches...\n');

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

try {
  // 1. Создаём таблицу branches
  console.log('1️⃣ Создание таблицы branches...');
  
  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS branches (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      company_id INTEGER UNIQUE NOT NULL,
      name VARCHAR(100) NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
  
  console.log('   ✅ Таблица создана\n');
  
  // 2. Создаём индексы
  console.log('2️⃣ Создание индексов...');
  
  await sql.unsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_branches_company_id 
    ON branches(company_id);
  `);
  
  await sql.unsafe(`
    CREATE INDEX IF NOT EXISTS idx_branches_name 
    ON branches(name);
  `);
  
  console.log('   ✅ Индексы созданы\n');
  
  // 3. Заполняем данными о филиалах
  console.log('3️⃣ Заполнение данными филиалов...');
  
  const branches = [
    { company_id: 9247, name: 'tbilisi' },
    { company_id: 9248, name: 'kutaisi' },
    { company_id: 9506, name: 'batumi' },
    { company_id: 11163, name: 'service-center' }
  ];
  
  for (const branch of branches) {
    await sql.unsafe(`
      INSERT INTO branches (company_id, name)
      VALUES (${branch.company_id}, '${branch.name}')
      ON CONFLICT (company_id) DO UPDATE SET
        name = EXCLUDED.name,
        updated_at = NOW();
    `);
    
    console.log(`   ✅ ${branch.name} (company_id: ${branch.company_id})`);
  }
  
  console.log('\n4️⃣ Проверка данных...');
  
  const result = await sql.unsafe(`
    SELECT id, company_id, name, created_at 
    FROM branches 
    ORDER BY company_id;
  `);
  
  console.log('\n📊 Филиалы в БД:');
  console.log('─────────────────────────────────────────────────────────────────────────');
  result.forEach(row => {
    console.log(`   UUID: ${row.id}`);
    console.log(`   Company ID: ${row.company_id}`);
    console.log(`   Name: ${row.name}`);
    console.log(`   Created: ${row.created_at.toISOString()}`);
    console.log('─────────────────────────────────────────────────────────────────────────');
  });
  
  console.log('\n✅ Миграция завершена успешно!\n');
  
} catch (error) {
  console.error('❌ Ошибка:', error.message);
  console.error(error);
  process.exit(1);
} finally {
  await sql.end();
}


