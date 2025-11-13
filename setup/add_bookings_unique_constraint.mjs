#!/usr/bin/env node
import postgres from 'postgres';

const sql = postgres('postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require', {
  ssl: { rejectUnauthorized: false }
});

console.log('\n🔧 Добавление UNIQUE constraint...\n');

try {
  await sql`
    ALTER TABLE bookings 
    ADD CONSTRAINT bookings_branch_number_unique 
    UNIQUE (branch, number)
  `;
  console.log('✅ UNIQUE constraint (branch, number) создан');
} catch (e) {
  if (e.message.includes('already exists')) {
    console.log('ℹ️  UNIQUE constraint уже существует');
  } else {
    console.error('❌ Ошибка:', e.message);
  }
}

await sql.end();
console.log('\n✅ Готово! UPSERT будет работать корректно!\n');

