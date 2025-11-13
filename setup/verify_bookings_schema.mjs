#!/usr/bin/env node
import postgres from 'postgres';

const sql = postgres('postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require', {
  ssl: { rejectUnauthorized: false }
});

console.log('\n🔍 Проверка схемы таблицы bookings...\n');

const columns = await sql`
  SELECT column_name, data_type, is_nullable
  FROM information_schema.columns
  WHERE table_name = 'bookings'
  ORDER BY ordinal_position
`;

console.log(`📋 Всего полей: ${columns.length}\n`);

// Поля, которые нужны для workflow
const requiredFields = [
  'branch',
  'number',
  'is_active',
  'start_date',
  'end_date',
  'start_date_formatted',
  'end_date_formatted',
  'client_id',
  'client_name',
  'client_category',
  'car_id',
  'car_name',
  'car_code',
  'location_start',
  'location_end',
  'total',
  'deposit',
  'rental_cost',
  'days',
  'state',
  'in_rent',
  'archive',
  'start_worker_id',
  'end_worker_id',
  'responsible',
  'description',
  'source',
  'data'
];

console.log('✅ Необходимые поля для workflow:\n');

let allPresent = true;

requiredFields.forEach(field => {
  const col = columns.find(c => c.column_name === field);
  if (col) {
    console.log(`   ✅ ${field.padEnd(25)} ${col.data_type.padEnd(20)} ${col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}`);
  } else {
    console.log(`   ❌ ${field.padEnd(25)} НЕ НАЙДЕНО!`);
    allPresent = false;
  }
});

await sql.end();

if (allPresent) {
  console.log('\n✅ Все необходимые поля присутствуют!');
  console.log('🚀 Workflow сможет быстро сохранять данные в БД\n');
} else {
  console.log('\n❌ Не все поля присутствуют!');
  process.exit(1);
}

