import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';
const sql = postgres(CONNECTION_STRING, { max: 1, ssl: { rejectUnauthorized: false } });

const pages = await sql`SELECT COUNT(*) as count FROM website_pages`;
const chunks = await sql`SELECT COUNT(*) as count FROM website_content_chunks`;
const recent = await sql`SELECT url, title, scraped_at FROM website_pages ORDER BY scraped_at DESC LIMIT 5`;

console.log(`Страниц: ${pages[0].count}`);
console.log(`Чанков: ${chunks[0].count}`);
console.log('\nПоследние страницы:');
recent.forEach(p => console.log(`  ${p.url} - ${p.title || 'без заголовка'}`));

await sql.end();

