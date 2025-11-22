import postgres from 'postgres';
const sql = postgres('postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require', {max:1, ssl:{rejectUnauthorized:false}});

console.log('📊 Статус создания векторной БД:\n');

// Общая статистика
const stats = await sql`
  SELECT 
    (SELECT COUNT(*) FROM website_pages) as pages,
    (SELECT COUNT(*) FROM website_content_chunks) as chunks,
    (SELECT COUNT(*) FROM website_content_chunks WHERE embedding IS NOT NULL) as with_emb,
    (SELECT COUNT(*) FROM website_content_chunks WHERE embedding IS NULL) as without_emb
`;

// Статистика по страницам
const pagesStats = await sql`
  SELECT 
    COUNT(*) as total,
    COUNT(DISTINCT page_type) as types,
    SUM(CASE WHEN scraped_at > NOW() - INTERVAL '1 hour' THEN 1 ELSE 0 END) as recent
  FROM website_pages
`;

// Последний лог
const lastLog = await sql`
  SELECT status, pages_found, chunks_created, started_at, completed_at
  FROM website_scraping_log
  ORDER BY started_at DESC
  LIMIT 1
`;

console.log('📄 СТРАНИЦЫ:');
console.log(`   Всего: ${stats[0].pages}`);
console.log(`   Типов: ${pagesStats[0].types}`);
console.log(`   За последний час: ${pagesStats[0].recent}`);

console.log('\n📦 ЧАНКИ:');
console.log(`   Всего создано: ${stats[0].chunks}`);
console.log(`   ✅ С эмбеддингами: ${stats[0].with_emb}`);
console.log(`   ⏳ Без эмбеддингов: ${stats[0].without_emb}`);

if (stats[0].chunks > 0) {
  const percent = Math.round((stats[0].with_emb / stats[0].chunks) * 100);
  const remaining = stats[0].without_emb;
  console.log(`   📈 Прогресс: ${percent}%`);
  console.log(`   ⏱️  Осталось: ${remaining} чанков`);
  
  if (remaining > 0) {
    // Примерная оценка времени (если известно время на чанк)
    console.log(`\n⚠️  ПРОЦЕСС НЕ ЗАВЕРШЕН`);
    console.log(`   Создание эмбеддингов продолжается...`);
  } else {
    console.log(`\n✅ ПРОЦЕСС ЗАВЕРШЕН!`);
    console.log(`   Все чанки имеют эмбеддинги`);
  }
}

if (lastLog.length > 0) {
  const log = lastLog[0];
  console.log('\n📝 ПОСЛЕДНИЙ ЗАПУСК:');
  const status = log.status === 'success' ? '✅ Завершен' : 
                log.status === 'error' ? '❌ Ошибка' : '⏳ В процессе';
  console.log(`   Статус: ${status}`);
  
  if (log.completed_at) {
    console.log(`   Завершен: ${new Date(log.completed_at).toLocaleString('ru-RU')}`);
  } else {
    const running = Math.floor((Date.now() - new Date(log.started_at)) / 1000 / 60);
    console.log(`   Работает: ${running} минут`);
  }
}

console.log('\n' + '═'.repeat(60));

await sql.end();

