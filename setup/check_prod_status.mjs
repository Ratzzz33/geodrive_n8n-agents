#!/usr/bin/env node

import postgres from 'postgres';

const PROD_URL = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(PROD_URL, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  console.log('📊 Production Database Status Check\n');
  
  // 1. Статистика external_refs
  console.log('1. External Refs Statistics:');
  const refsStats = await sql`
    SELECT system, entity_type, COUNT(*) as count
    FROM external_refs
    GROUP BY system, entity_type
    ORDER BY system, entity_type
  `;
  for (const row of refsStats) {
    console.log(`   ${row.system}.${row.entity_type}: ${row.count}`);
  }
  console.log('');
  
  // 2. Проверка FK
  console.log('2. Foreign Keys:');
  const fks = await sql`
    SELECT 
      tc.table_name,
      kcu.column_name,
      ccu.table_name AS foreign_table
    FROM information_schema.table_constraints AS tc
    JOIN information_schema.key_column_usage AS kcu 
      ON tc.constraint_name = kcu.constraint_name
    JOIN information_schema.constraint_column_usage AS ccu 
      ON ccu.constraint_name = tc.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema = 'public'
    ORDER BY tc.table_name, kcu.column_name
  `;
  for (const fk of fks) {
    console.log(`   ${fk.table_name}.${fk.column_name} -> ${fk.foreign_table}`);
  }
  console.log(`   Total: ${fks.length} foreign keys\n`);
  
  // 3. Проверка удалённых колонок
  console.log('3. Removed Columns Check:');
  const paymentsCols = await sql`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_name = 'payments'
      AND column_name IN ('car_id', 'client_id', 'user_id')
  `;
  const tasksCols = await sql`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_name = 'tasks'
      AND column_name IN ('tg_chat_id', 'tg_topic_id')
  `;
  
  if (paymentsCols.length === 0) {
    console.log('   ✅ payments alias columns removed');
  } else {
    console.log(`   ⚠️  payments still has: ${paymentsCols.map(c => c.column_name).join(', ')}`);
  }
  
  if (tasksCols.length === 0) {
    console.log('   ✅ tasks telegram columns removed');
  } else {
    console.log(`   ⚠️  tasks still has: ${tasksCols.map(c => c.column_name).join(', ')}`);
  }
  console.log('');
  
  // 4. Проверка индексов
  console.log('4. Indexes on external_refs:');
  const indexes = await sql`
    SELECT indexname
    FROM pg_indexes
    WHERE tablename = 'external_refs'
    ORDER BY indexname
  `;
  for (const idx of indexes) {
    console.log(`   ✅ ${idx.indexname}`);
  }
  
  await sql.end();
}

main().catch(console.error);

