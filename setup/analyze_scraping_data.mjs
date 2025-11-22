import postgres from 'postgres';
const sql = postgres('postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require', {max:1, ssl:{rejectUnauthorized:false}});

console.log('📊 Анализ данных парсинга:\n');

// Статистика по страницам
const pagesStats = await sql`
  SELECT 
    p.url,
    p.title,
    p.page_type,
    COUNT(c.id) as chunks_count,
    COUNT(CASE WHEN c.embedding IS NOT NULL THEN 1 END) as chunks_with_emb
  FROM website_pages p
  LEFT JOIN website_content_chunks c ON p.id = c.page_id
  GROUP BY p.id, p.url, p.title, p.page_type
  ORDER BY chunks_count DESC
`;

console.log('📄 Статистика по страницам (топ-20 по количеству чанков):\n');
pagesStats.slice(0, 20).forEach((p, i) => {
  const title = (p.title || 'без заголовка').substring(0, 50);
  console.log(`${(i+1).toString().padStart(2)}. ${title.padEnd(52)} [${p.page_type || 'other'}] - ${p.chunks_count} чанков (${p.chunks_with_emb} с эмбеддингами)`);
});

// Общая статистика
const avgChunks = await sql`
  SELECT 
    AVG(chunk_count) as avg_chunks
  FROM (
    SELECT page_id, COUNT(*) as chunk_count
    FROM website_content_chunks
    GROUP BY page_id
  ) sub
`;

console.log('\n📈 Общая статистика:');
console.log(`   Страниц: ${pagesStats.length}`);
console.log(`   Всего чанков: ${pagesStats.reduce((sum, p) => sum + parseInt(p.chunks_count), 0)}`);
console.log(`   Среднее чанков на страницу: ${Math.round(avgChunks[0].avg_chunks || 0)}`);

// Типы страниц
const pageTypes = await sql`
  SELECT 
    page_type,
    COUNT(*) as pages,
    SUM((SELECT COUNT(*) FROM website_content_chunks WHERE page_id = p.id)) as chunks
  FROM website_pages p
  GROUP BY page_type
  ORDER BY chunks DESC
`;

console.log('\n📋 По типам страниц:');
pageTypes.forEach(pt => {
  const type = pt.page_type || 'other';
  const avg = Math.round((pt.chunks / pt.pages) || 0);
  console.log(`   ${type.padEnd(20)} ${pt.pages} страниц, ${pt.chunks} чанков (${avg} на страницу)`);
});

// Главная страница
const homePage = await sql`
  SELECT url, title, 
    (SELECT COUNT(*) FROM website_content_chunks WHERE page_id = p.id) as chunks
  FROM website_pages p
  WHERE page_type = 'home' OR url = 'https://geodrive.info' OR url = 'https://geodrive.info/'
  LIMIT 1
`;

if (homePage.length > 0) {
  console.log(`\n🏠 Главная страница: ${homePage[0].chunks} чанков`);
}

console.log('\n💡 Рекомендация:');
console.log('   Для обучения агента достаточно:');
console.log('   - Главная страница');
console.log('   - 5-10 страниц услуг');
console.log('   - Страница "О нас"');
console.log('   - Страница контактов');
console.log('   Итого: ~10-15 страниц вместо 90');

await sql.end();

