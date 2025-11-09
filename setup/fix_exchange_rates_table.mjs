#!/usr/bin/env node
import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

try {
  console.log('🔧 Fixing exchange_rates table...\n');
  
  // Добавляем created_at если его нет
  await sql.unsafe(`
    ALTER TABLE exchange_rates 
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  `);
  
  console.log('✅ Column created_at added!');
  
  // Проверяем структуру
  const columns = await sql`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'exchange_rates'
    ORDER BY ordinal_position
  `;
  
  console.log('\n📋 Current table structure:');
  columns.forEach(col => {
    console.log(`  - ${col.column_name} (${col.data_type})`);
  });
  
} catch (error) {
  console.error('❌ Fix failed:', error);
  process.exit(1);
} finally {
  await sql.end();
}

