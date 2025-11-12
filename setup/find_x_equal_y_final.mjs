import postgres from 'postgres';
const sql = postgres('postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require', {max:1, ssl:{rejectUnauthorized:false}});

// Ищем диалоги, где есть и loaded и total
const dialogs = await sql`
  SELECT 
    umnico_conversation_id,
    metadata->>'loaded' as loaded,
    metadata->>'total' as total,
    metadata->>'incomplete' as incomplete,
    metadata
  FROM conversations
  WHERE umnico_conversation_id IS NOT NULL
    AND metadata IS NOT NULL
    AND metadata::text LIKE '%"total"%'
  ORDER BY umnico_conversation_id
  LIMIT 100
`;

console.log('\n=== ДИАЛОГИ С ПОЛЕМ total ===\n');
console.log(`Найдено: ${dialogs.length} диалогов\n`);

if (dialogs.length > 0) {
  // Показываем первые 10 для примера
  console.log('Примеры метаданных:');
  dialogs.slice(0, 10).forEach(d => {
    console.log(`ID: ${d.umnico_conversation_id}`);
    console.log(`  loaded: ${d.loaded}, total: ${d.total}`);
    console.log(`  metadata: ${JSON.stringify(d.metadata)}`);
    console.log();
  });
  
  // Ищем где x=y
  const xEqualY = dialogs.filter(d => {
    const loaded = parseInt(d.loaded);
    const total = parseInt(d.total);
    return !isNaN(loaded) && !isNaN(total) && loaded === total && total > 0;
  });
  
  console.log(`\n=== ДИАЛОГИ ГДЕ x=y ===\n`);
  console.log(`Найдено: ${xEqualY.length} диалогов\n`);
  
  if (xEqualY.length > 0) {
    console.log('ID диалога | x/y | Неполный');
    console.log('-'.repeat(50));
    xEqualY.forEach(d => {
      const incomplete = d.incomplete === 'true' ? '⚠️ Да' : '✅ Нет';
      console.log(`${d.umnico_conversation_id} | ${d.loaded}/${d.total} | ${incomplete}`);
    });
    
    console.log('\n📋 Список ID:');
    console.log(xEqualY.map(d => d.umnico_conversation_id).join(', '));
  }
} else {
  console.log('⚠️  Диалогов с полем "total" в метаданных не найдено');
  console.log('   Возможно, поле "total" не сохраняется в БД');
}

await sql.end();

