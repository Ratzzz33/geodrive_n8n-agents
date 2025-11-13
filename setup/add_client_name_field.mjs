#!/usr/bin/env node
import postgres from 'postgres';

const sql = postgres('postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require', {
  ssl: { rejectUnauthorized: false }
});

try {
  await sql`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS client_name TEXT`;
  console.log('✅ client_name добавлен');
} catch (e) {
  console.log('ℹ️', e.message);
}

try {
  await sql`CREATE INDEX IF NOT EXISTS idx_bookings_client_name ON bookings(client_name)`;
  console.log('✅ idx_bookings_client_name создан');
} catch (e) {
  console.log('ℹ️', e.message);
}

try {
  await sql`COMMENT ON COLUMN bookings.client_name IS 'Полное имя клиента'`;
  console.log('✅ Комментарий добавлен');
} catch (e) {
  console.log('ℹ️', e.message);
}

await sql.end();
console.log('\n✅ Готово!');

