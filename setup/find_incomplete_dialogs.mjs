import postgres from 'postgres';
const sql = postgres('postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require', {max:1, ssl:{rejectUnauthorized:false}});

// Ищем диалоги с incomplete: true (это те, где x=y и не удалось загрузить больше)
const incomplete = await sql`
  SELECT 
    umnico_conversation_id,
    client_name,
    channel,
    metadata->>'loaded' as loaded,
    metadata->>'total' as total,
    metadata->>'incomplete' as incomplete,
    metadata,
    updated_at
  FROM conversations
  WHERE umnico_conversation_id IS NOT NULL
    AND metadata->>'incomplete' = 'true'
  ORDER BY updated_at DESC
`;

console.log('\n=== ДИАЛОГИ С incomplete: true (x=y) ===\n');
console.log(`Найдено: ${incomplete.length} диалогов\n`);

if (incomplete.length > 0) {
  console.log('ID диалога'.padEnd(15) + ' | ' + 'Клиент'.padEnd(20) + ' | ' + 'Канал'.padEnd(10) + ' | ' + 'loaded/total');
  console.log('-'.repeat(70));
  
  incomplete.forEach(d => {
    const id = d.umnico_conversation_id || 'N/A';
    const client = (d.client_name || 'Unknown').substring(0, 18);
    const channel = (d.channel || 'unknown').substring(0, 8);
    const loaded = d.loaded || '?';
    const total = d.total || '?';
    const xy = `${loaded}/${total}`;
    
    console.log(id.padEnd(15) + ' | ' + client.padEnd(20) + ' | ' + channel.padEnd(10) + ' | ' + xy);
  });
  
  console.log('\n📋 Список ID (для копирования):');
  console.log(incomplete.map(d => d.umnico_conversation_id).join(', '));
  
  // Статистика по каналам
  const byChannel = {};
  incomplete.forEach(d => {
    const ch = d.channel || 'unknown';
    byChannel[ch] = (byChannel[ch] || 0) + 1;
  });
  
  console.log('\n📊 По каналам:');
  Object.entries(byChannel).forEach(([ch, count]) => {
    console.log(`   ${ch}: ${count}`);
  });
  
} else {
  console.log('✅ Диалогов с incomplete: true не найдено');
  console.log('   Это означает, что все диалоги были успешно обработаны');
}

// Также проверим, есть ли диалоги с total в метаданных (на случай, если они есть)
const withTotal = await sql`
  SELECT COUNT(*)::int as cnt
  FROM conversations
  WHERE umnico_conversation_id IS NOT NULL
    AND metadata IS NOT NULL
    AND metadata::text LIKE '%total%'
    AND (metadata->>'total')::int > 0
`;

console.log(`\n📈 Дополнительно: диалогов с полем 'total' в метаданных: ${withTotal[0].cnt}`);

await sql.end();

