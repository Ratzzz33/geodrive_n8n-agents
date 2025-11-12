import postgres from 'postgres';

const sql = postgres('postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require', {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

try {
  const [conv] = await sql`SELECT COUNT(*)::int as cnt FROM conversations WHERE umnico_conversation_id IS NOT NULL`;
  const [msg] = await sql`SELECT COUNT(*)::int as cnt FROM messages`;
  const [clients] = await sql`SELECT COUNT(*)::int as cnt FROM clients`;
  const [incomplete] = await sql`SELECT COUNT(*)::int as cnt FROM conversations WHERE umnico_conversation_id IS NOT NULL AND metadata->>'incomplete' = 'true'`;
  
  const fileData = JSON.parse(await import('fs').then(m => m.promises.readFile('umnico_chat_ids_full.json', 'utf8')));
  const totalIds = fileData.ids?.length || fileData.length || 0;
  
  console.log('\n=== СТАТУС ПАРСИНГА ===');
  console.log(`ID в файле: ${totalIds}`);
  console.log(`Диалоги в БД: ${conv.cnt}`);
  console.log(`Сообщения: ${msg.cnt}`);
  console.log(`Клиенты: ${clients.cnt}`);
  console.log(`Неполных диалогов: ${incomplete.cnt}`);
  console.log(`Прогресс: ${((conv.cnt / totalIds) * 100).toFixed(1)}%`);
  console.log('======================\n');
  
} catch (error) {
  console.error('Ошибка:', error.message);
} finally {
  await sql.end();
  process.exit(0);
}

