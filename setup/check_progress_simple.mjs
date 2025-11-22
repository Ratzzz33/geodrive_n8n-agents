import postgres from 'postgres';
const sql = postgres('postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require', {max:1, ssl:{rejectUnauthorized:false}});

const stats = await sql`SELECT (SELECT COUNT(*) FROM website_pages) as pages, (SELECT COUNT(*) FROM website_content_chunks) as chunks, (SELECT COUNT(*) FROM website_content_chunks WHERE embedding IS NOT NULL) as with_emb`;
const recent = await sql`SELECT url, title, page_type, scraped_at FROM website_pages ORDER BY scraped_at DESC LIMIT 5`;
const log = await sql`SELECT status, pages_found, chunks_created, started_at FROM website_scraping_log ORDER BY started_at DESC LIMIT 1`;

console.log('\n═══════════════════════════════════════════════════════');
console.log('📊 ПРОГРЕСС ПАРСИНГА geodrive.info');
console.log('═══════════════════════════════════════════════════════\n');

console.log(`📄 Страниц обработано: ${stats[0].pages}`);
console.log(`📦 Чанков создано: ${stats[0].chunks}`);
console.log(`✅ Чанков с эмбеддингами: ${stats[0].with_emb}`);

if (stats[0].chunks > 0) {
  const percent = Math.round((stats[0].with_emb / stats[0].chunks) * 100);
  console.log(`📈 Прогресс эмбеддингов: ${percent}%`);
}

if (recent.length > 0) {
  console.log('\n🕐 Последние страницы:');
  recent.forEach((p, i) => {
    const time = Math.floor((Date.now() - new Date(p.scraped_at)) / 1000);
    const timeStr = time < 60 ? `${time}с` : `${Math.floor(time/60)}м`;
    console.log(`   ${i+1}. ${(p.title || 'без заголовка').substring(0, 50)} [${p.page_type || 'other'}] - ${timeStr} назад`);
  });
}

if (log.length > 0) {
  const l = log[0];
  console.log(`\n📝 Статус: ${l.status === 'success' ? '✅' : l.status === 'error' ? '❌' : '⏳'} ${l.status}`);
  if (l.pages_found) console.log(`   Страниц: ${l.pages_found}`);
  if (l.chunks_created) console.log(`   Чанков: ${l.chunks_created}`);
}

console.log('\n═══════════════════════════════════════════════════════\n');

await sql.end();

