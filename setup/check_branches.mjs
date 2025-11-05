import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

try {
  console.log('📊 Проверка филиалов в таблице branches...\n');
  
  const branches = await sql`
    SELECT code, name, id, created_at 
    FROM branches 
    ORDER BY code
  `;
  
  if (branches.length === 0) {
    console.log('❌ Филиалов нет в БД!');
    console.log('📝 Создаю филиалы...\n');
    
    await sql`
      INSERT INTO branches (id, code, name, created_at, updated_at)
      VALUES 
        (gen_random_uuid(), 'tbilisi', 'Тбилиси', NOW(), NOW()),
        (gen_random_uuid(), 'batumi', 'Батуми', NOW(), NOW()),
        (gen_random_uuid(), 'kutaisi', 'Кутаиси', NOW(), NOW()),
        (gen_random_uuid(), 'service-center', 'Сервисный центр', NOW(), NOW())
      ON CONFLICT (code) DO NOTHING
    `;
    
    const newBranches = await sql`SELECT code, name FROM branches ORDER BY code`;
    console.log('✅ Филиалы созданы:');
    newBranches.forEach(b => console.log(`   • ${b.code} - ${b.name}`));
  } else {
    console.log('✅ Филиалы найдены:');
    branches.forEach(b => console.log(`   • ${b.code} - ${b.name}`));
    
    // Проверка нужных филиалов
    const needed = ['tbilisi', 'batumi', 'kutaisi', 'service-center'];
    const existing = branches.map(b => b.code);
    const missing = needed.filter(n => !existing.includes(n));
    
    if (missing.length > 0) {
      console.log(`\n⚠️  Отсутствуют филиалы: ${missing.join(', ')}`);
      console.log('📝 Создаю недостающие...');
      
      for (const code of missing) {
        const names = {
          'tbilisi': 'Тбилиси',
          'batumi': 'Батуми',
          'kutaisi': 'Кутаиси',
          'service-center': 'Сервисный центр'
        };
        
        await sql`
          INSERT INTO branches (id, code, name, created_at, updated_at)
          VALUES (gen_random_uuid(), ${code}, ${names[code]}, NOW(), NOW())
          ON CONFLICT (code) DO NOTHING
        `;
        console.log(`   ✅ ${code} добавлен`);
      }
    }
  }
  
  console.log('\n✅ Проверка завершена!');
} catch (error) {
  console.error('❌ Ошибка:', error.message);
  process.exit(1);
} finally {
  await sql.end();
}

