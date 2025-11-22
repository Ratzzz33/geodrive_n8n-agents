import postgres from 'postgres';

const sql = postgres('postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require', {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

try {
  const stats = await sql`
    SELECT 
      (SELECT COUNT(*) FROM website_pages) as pages,
      (SELECT COUNT(*) FROM website_content_chunks) as chunks,
      (SELECT COUNT(*) FROM website_content_chunks WHERE embedding IS NOT NULL) as chunks_with_emb
  `;
  
  const pages = await sql`
    SELECT url, title, page_type, scraped_at 
    FROM website_pages 
    ORDER BY scraped_at DESC 
    LIMIT 10
  `;
  
  console.log('📊 Статистика:');
  console.log(`  Страниц: ${stats[0].pages}`);
  console.log(`  Чанков: ${stats[0].chunks}`);
  console.log(`  Чанков с эмбеддингами: ${stats[0].chunks_with_emb}`);
  console.log('\n📄 Последние страницы:');
  pages.forEach((p, i) => {
    console.log(`  ${i+1}. ${p.url}`);
    console.log(`     ${p.title || 'без заголовка'} (${p.page_type || 'other'})`);
  });
  
} finally {
  await sql.end();
}

