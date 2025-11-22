#!/usr/bin/env node
import postgres from 'postgres';

const sql = postgres('postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require', {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

try {
  console.log('📝 Добавляем колонку rentprog_id в таблицу bookings...');
  
  // Добавляем колонку rentprog_id
  await sql`
    ALTER TABLE bookings 
    ADD COLUMN IF NOT EXISTS rentprog_id TEXT
  `;
  
  console.log('✅ Колонка rentprog_id добавлена');
  
  // Создаём индекс для быстрого поиска
  await sql`
    CREATE INDEX IF NOT EXISTS bookings_rentprog_id_idx 
    ON bookings(rentprog_id)
  `;
  
  console.log('✅ Индекс создан');
  
  // Добавляем комментарий
  await sql`
    COMMENT ON COLUMN bookings.rentprog_id IS 'RentProg booking ID (duplicated from external_refs for fast lookups)'
  `;
  
  console.log('✅ Комментарий добавлен');
  
  console.log('\n🎉 Миграция завершена успешно!');
  
} catch (error) {
  console.error('❌ Ошибка:', error.message);
  process.exit(1);
} finally {
  await sql.end();
}

