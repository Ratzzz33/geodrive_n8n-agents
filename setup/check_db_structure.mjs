import postgres from 'postgres';
const sql = postgres('postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require', {max:1, ssl:{rejectUnauthorized:false}});

console.log('📊 Структура БД neondb:\n');

// Все таблицы в БД
const tables = await sql`
  SELECT table_name 
  FROM information_schema.tables 
  WHERE table_schema = 'public' 
  ORDER BY table_name
`;

console.log('📋 Все таблицы в БД:');
tables.forEach((t, i) => {
  const isWebsite = t.table_name.startsWith('website_');
  const marker = isWebsite ? '🆕 (новые для парсинга)' : '';
  console.log(`   ${(i+1).toString().padStart(2)}. ${t.table_name.padEnd(40)} ${marker}`);
});

// Проверить таблицы проекта
const projectTables = await sql`
  SELECT table_name 
  FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name IN ('events', 'cars', 'clients', 'bookings', 'website_pages')
  ORDER BY table_name
`;

console.log('\n🔍 Проверка основных таблиц проекта:');
projectTables.forEach(t => {
  console.log(`   ✅ ${t.table_name} - существует`);
});

// Статистика по таблицам парсинга
const websiteStats = await sql`
  SELECT 
    (SELECT COUNT(*) FROM website_pages) as pages,
    (SELECT COUNT(*) FROM website_content_chunks) as chunks
`;

console.log('\n📊 Данные парсинга:');
console.log(`   website_pages: ${websiteStats[0].pages} записей`);
console.log(`   website_content_chunks: ${websiteStats[0].chunks} записей`);

console.log('\n✅ Это ОСНОВНАЯ БД проекта (neondb)');
console.log('   Новые таблицы добавлены в ту же БД, не создана отдельная ветка\n');

await sql.end();

