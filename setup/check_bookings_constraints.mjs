#!/usr/bin/env node
import postgres from 'postgres';

const sql = postgres('postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require', {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

try {
  console.log('📝 Проверяем constraints на таблице bookings...\n');
  
  const constraints = await sql`
    SELECT 
      conname as constraint_name,
      contype as constraint_type,
      pg_get_constraintdef(oid) as definition
    FROM pg_constraint
    WHERE conrelid = 'bookings'::regclass
    ORDER BY conname
  `;
  
  console.log('Найдено constraints:', constraints.length);
  constraints.forEach(c => {
    console.log(`\n${c.constraint_name} (${c.constraint_type}):`);
    console.log(`  ${c.definition}`);
  });
  
  // Проверим индексы
  console.log('\n\n📝 Индексы на таблице bookings:\n');
  
  const indexes = await sql`
    SELECT 
      indexname,
      indexdef
    FROM pg_indexes
    WHERE tablename = 'bookings'
    ORDER BY indexname
  `;
  
  indexes.forEach(idx => {
    console.log(`${idx.indexname}:`);
    console.log(`  ${idx.indexdef}`);
    console.log('');
  });
  
} catch (error) {
  console.error('❌ Ошибка:', error.message);
} finally {
  await sql.end();
}

