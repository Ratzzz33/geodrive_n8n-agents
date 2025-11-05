import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

console.log('\n📋 Добавление company_id в таблицу branches...\n');

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

try {
  // 1. Добавляем колонку company_id
  console.log('1️⃣ Добавление колонки company_id...');
  
  await sql.unsafe(`
    ALTER TABLE branches 
    ADD COLUMN IF NOT EXISTS company_id INTEGER;
  `);
  
  console.log('   ✅ Колонка добавлена\n');
  
  // 2. Обновляем данные для каждого филиала
  console.log('2️⃣ Заполнение company_id для филиалов...');
  
  const mapping = {
    'tbilisi': 9247,
    'batumi': 9506,
    'kutaisi': 9248,
    'service-center': 11163
  };
  
  for (const [code, company_id] of Object.entries(mapping)) {
    await sql.unsafe(`
      UPDATE branches 
      SET company_id = ${company_id}, 
          updated_at = NOW()
      WHERE code = '${code}';
    `);
    
    console.log(`   ✅ ${code} → company_id = ${company_id}`);
  }
  
  console.log('\n3️⃣ Добавление ограничения уникальности...');
  
  // Создаём UNIQUE constraint для company_id
  await sql.unsafe(`
    DO $$ 
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'branches_company_id_unique'
      ) THEN
        ALTER TABLE branches 
        ADD CONSTRAINT branches_company_id_unique 
        UNIQUE (company_id);
      END IF;
    END $$;
  `);
  
  console.log('   ✅ Constraint создан\n');
  
  // 4. Создаём индекс
  console.log('4️⃣ Создание индекса...');
  
  await sql.unsafe(`
    CREATE INDEX IF NOT EXISTS idx_branches_company_id 
    ON branches(company_id);
  `);
  
  console.log('   ✅ Индекс создан\n');
  
  // 5. Проверяем результат
  console.log('5️⃣ Проверка данных...');
  
  const result = await sql.unsafe(`
    SELECT id, code, name, company_id, created_at 
    FROM branches 
    ORDER BY company_id;
  `);
  
  console.log('\n📊 Филиалы в БД:');
  console.log('═════════════════════════════════════════════════════════════════════════');
  result.forEach(row => {
    console.log(`   UUID: ${row.id}`);
    console.log(`   Code: ${row.code}`);
    console.log(`   Name: ${row.name}`);
    console.log(`   Company ID (RentProg): ${row.company_id}`);
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


