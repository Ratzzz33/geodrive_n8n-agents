#!/usr/bin/env node
import postgres from 'postgres';

const sql = postgres('postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require', {
  ssl: { rejectUnauthorized: false }
});

console.log('\n🔧 Добавление поля branch...\n');

try {
  await sql`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS branch TEXT`;
  console.log('✅ branch добавлен');
} catch (e) {
  console.log('ℹ️', e.message);
}

try {
  await sql`CREATE INDEX IF NOT EXISTS idx_bookings_branch ON bookings(branch)`;
  console.log('✅ idx_bookings_branch создан');
} catch (e) {
  console.log('ℹ️', e.message);
}

await sql.end();
console.log('\n✅ Готово! Теперь запускай workflow!\n');

