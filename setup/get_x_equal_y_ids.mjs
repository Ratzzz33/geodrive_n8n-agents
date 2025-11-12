import postgres from 'postgres';
const sql = postgres('postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require', {max:1, ssl:{rejectUnauthorized:false}});

const dialogs = await sql`
  SELECT umnico_conversation_id, metadata->>'loaded' as loaded, metadata->>'total' as total, metadata->>'incomplete' as incomplete
  FROM conversations
  WHERE umnico_conversation_id IS NOT NULL
    AND metadata->>'loaded' IS NOT NULL
    AND metadata->>'total' IS NOT NULL
    AND (metadata->>'loaded')::int = (metadata->>'total')::int
    AND (metadata->>'total')::int > 0
  ORDER BY umnico_conversation_id
`;

console.log('\n=== ДИАЛОГИ ГДЕ x=y (loaded = total) ===\n');
console.log(`Найдено: ${dialogs.length} диалогов\n`);

if (dialogs.length > 0) {
  console.log('ID диалога | x/y | Неполный');
  console.log('-'.repeat(40));
  dialogs.forEach(d => {
    const incomplete = d.incomplete === 'true' ? '⚠️ Да' : '✅ Нет';
    console.log(`${d.umnico_conversation_id} | ${d.loaded}/${d.total} | ${incomplete}`);
  });
  
  console.log('\n📋 Список ID:');
  console.log(dialogs.map(d => d.umnico_conversation_id).join(', '));
  
  const incomplete = dialogs.filter(d => d.incomplete === 'true').length;
  console.log(`\nСтатистика: ${incomplete} из ${dialogs.length} помечены как incomplete`);
}

await sql.end();

