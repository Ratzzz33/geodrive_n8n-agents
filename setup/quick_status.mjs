import postgres from 'postgres';
const sql = postgres('postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require', { max: 1, ssl: { rejectUnauthorized: false } });

const [conv] = await sql`SELECT COUNT(*) as cnt FROM conversations WHERE umnico_conversation_id IS NOT NULL`;
const [msg] = await sql`SELECT COUNT(*) as cnt FROM messages`;
const [clients] = await sql`SELECT COUNT(*) as cnt FROM clients`;

console.log(`Диалоги: ${conv.cnt}, Сообщения: ${msg.cnt}, Клиенты: ${clients.cnt}`);

await sql.end();

