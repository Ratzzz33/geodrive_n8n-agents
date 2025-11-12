import postgres from 'postgres';
const sql = postgres('postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require', {max:1, ssl:{rejectUnauthorized:false}});

// Проверяем формат метаданных
const sample = await sql`
  SELECT umnico_conversation_id, metadata
  FROM conversations
  WHERE umnico_conversation_id IS NOT NULL
    AND metadata IS NOT NULL
  LIMIT 5
`;

console.log('\n=== ПРИМЕРЫ МЕТАДАННЫХ ===\n');
sample.forEach((row, idx) => {
  console.log(`${idx + 1}. ID: ${row.umnico_conversation_id}`);
  console.log(`   Метаданные: ${JSON.stringify(row.metadata, null, 2)}`);
  console.log();
});

// Проверяем, есть ли поля loaded и total
const withLoaded = await sql`
  SELECT COUNT(*)::int as cnt
  FROM conversations
  WHERE umnico_conversation_id IS NOT NULL
    AND metadata->>'loaded' IS NOT NULL
`;

const withTotal = await sql`
  SELECT COUNT(*)::int as cnt
  FROM conversations
  WHERE umnico_conversation_id IS NOT NULL
    AND metadata->>'total' IS NOT NULL
`;

const withBoth = await sql`
  SELECT COUNT(*)::int as cnt
  FROM conversations
  WHERE umnico_conversation_id IS NOT NULL
    AND metadata->>'loaded' IS NOT NULL
    AND metadata->>'total' IS NOT NULL
`;

console.log('\n=== СТАТИСТИКА ===\n');
console.log(`Диалогов с полем 'loaded': ${withLoaded[0].cnt}`);
console.log(`Диалогов с полем 'total': ${withTotal[0].cnt}`);
console.log(`Диалогов с обоими полями: ${withBoth[0].cnt}`);

// Ищем x=y
const xEqualY = await sql`
  SELECT COUNT(*)::int as cnt
  FROM conversations
  WHERE umnico_conversation_id IS NOT NULL
    AND metadata->>'loaded' IS NOT NULL
    AND metadata->>'total' IS NOT NULL
    AND (metadata->>'loaded')::int = (metadata->>'total')::int
`;

console.log(`Диалогов где x=y: ${xEqualY[0].cnt}`);

await sql.end();

