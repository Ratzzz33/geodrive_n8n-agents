import postgres from 'postgres';
const sql = postgres('postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require', {max:1, ssl:{rejectUnauthorized:false}});

// Проверяем все возможные варианты наличия total
const all = await sql`
  SELECT umnico_conversation_id, metadata
  FROM conversations
  WHERE umnico_conversation_id IS NOT NULL
  LIMIT 1000
`;

console.log(`\nПроверка ${all.length} диалогов на наличие поля 'total'...\n`);

const withTotal = [];
all.forEach(row => {
  try {
    const meta = typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata;
    if (meta && typeof meta === 'object' && 'total' in meta && meta.total !== null && meta.total !== undefined) {
      withTotal.push({
        id: row.umnico_conversation_id,
        loaded: meta.loaded,
        total: meta.total,
        incomplete: meta.incomplete
      });
    }
  } catch (e) {
    // ignore
  }
});

if (withTotal.length > 0) {
  console.log(`✅ Найдено ${withTotal.length} диалогов с полем 'total':\n`);
  
  // Ищем где x=y
  const xEqualY = withTotal.filter(d => {
    const loaded = parseInt(d.loaded);
    const total = parseInt(d.total);
    return !isNaN(loaded) && !isNaN(total) && loaded === total && total > 0;
  });
  
  if (xEqualY.length > 0) {
    console.log(`\n=== ДИАЛОГИ ГДЕ x=y (loaded = total) ===\n`);
    console.log(`Найдено: ${xEqualY.length} диалогов\n`);
    console.log('ID диалога | x/y | Неполный');
    console.log('-'.repeat(40));
    xEqualY.forEach(d => {
      const incomplete = d.incomplete === 'true' ? '⚠️ Да' : '✅ Нет';
      console.log(`${d.id} | ${d.loaded}/${d.total} | ${incomplete}`);
    });
    
    console.log('\n📋 Список ID:');
    console.log(xEqualY.map(d => d.id).join(', '));
  } else {
    console.log(`\n⚠️  Среди ${withTotal.length} диалогов с полем 'total' нет таких, где x=y`);
  }
  
  // Показываем примеры с total
  console.log(`\n📊 Примеры диалогов с полем 'total':`);
  withTotal.slice(0, 5).forEach(d => {
    console.log(`  ID: ${d.id}, loaded: ${d.loaded}, total: ${d.total}`);
  });
  
} else {
  console.log('❌ В БД нет диалогов с полем "total" в метаданных');
  console.log('   Поле "total" не сохраняется при парсинге');
  console.log('\n💡 Рекомендация:');
  console.log('   Используйте список из логов (90 диалогов с "total неизвестен")');
  console.log('   или проверьте диалоги с incomplete: true');
}

await sql.end();

