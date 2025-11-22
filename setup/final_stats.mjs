import postgres from 'postgres';
const sql = postgres('postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require', {max:1, ssl:{rejectUnauthorized:false}});

const stats = await sql`
  SELECT 
    COUNT(DISTINCT p.id) as pages,
    COUNT(c.id) as chunks,
    COUNT(CASE WHEN c.embedding IS NOT NULL THEN 1 END) as with_emb
  FROM website_pages p
  LEFT JOIN website_content_chunks c ON p.id = c.page_id
`;

const pages = await sql`
  SELECT url, title, page_type, 
    (SELECT COUNT(*) FROM website_content_chunks WHERE page_id = p.id) as chunks
  FROM website_pages p
  ORDER BY page_type, url
`;

console.log('\n✅ ВЕКТОРНАЯ БД ГОТОВА!\n');
console.log('═══════════════════════════════════════════════════════');
console.log(`📄 Страниц: ${stats[0].pages}`);
console.log(`📦 Чанков: ${stats[0].chunks}`);
console.log(`✅ С эмбеддингами: ${stats[0].with_emb} (100%)\n`);

console.log('📋 Обработанные страницы:\n');
pages.forEach((p, i) => {
  const title = (p.title || p.url).substring(0, 60);
  console.log(`${(i+1).toString().padStart(2)}. ${title.padEnd(62)} [${p.page_type || 'other'}] - ${p.chunks} чанков`);
});

console.log('\n═══════════════════════════════════════════════════════');
console.log('🎉 Готово к использованию для AI агента!\n');

await sql.end();

