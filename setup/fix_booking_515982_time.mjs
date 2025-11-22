#!/usr/bin/env node

import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

async function fixBookingTime() {
  try {
    const bookingUuid = 'cdeb50a1-f0c0-418e-9d5b-e33d6720cd51';
    console.log(`🔧 Исправление времени для брони ${bookingUuid}\n`);
    
    // 1. Получить текущее время
    const booking = await sql`
      SELECT start_at, end_at 
      FROM bookings 
      WHERE id = ${bookingUuid}
    `;
    
    if (booking.length === 0) {
      console.log('❌ Бронь не найдена');
      return;
    }
    
    const oldStart = booking[0].start_at;
    const oldEnd = booking[0].end_at;
    
    console.log(`Старое время (UTC):`);
    console.log(`Start: ${oldStart.toISOString()}`);
    console.log(`End:   ${oldEnd.toISOString()}`);
    
    // Сдвигаем на -4 часа
    // 12:00 UTC (было) -> 08:00 UTC (станет) = 12:00 Tbilisi
    const newStart = new Date(oldStart.getTime() - 4 * 60 * 60 * 1000);
    const newEnd = new Date(oldEnd.getTime() - 4 * 60 * 60 * 1000);
    
    console.log(`\nНовое время (UTC):`);
    console.log(`Start: ${newStart.toISOString()}`);
    console.log(`End:   ${newEnd.toISOString()}`);
    
    // Обновляем в БД
    // Триггер sync_booking_fields должен автоматически обновить текстовые поля start_date/end_date
    await sql`
      UPDATE bookings 
      SET 
        start_at = ${newStart},
        end_at = ${newEnd},
        updated_at = NOW()
      WHERE id = ${bookingUuid}
    `;
    
    console.log('\n✅ Время обновлено в БД');
    
    // Проверяем результат (включая текстовые поля)
    const updated = await sql`
      SELECT start_at, end_at, start_date, end_date 
      FROM bookings 
      WHERE id = ${bookingUuid}
    `;
    
    console.log('\nРезультат:');
    console.log(`Start (UTC): ${updated[0].start_at.toISOString()}`);
    console.log(`Start (Text): ${updated[0].start_date}`);
    console.log(`End (UTC):   ${updated[0].end_at.toISOString()}`);
    console.log(`End (Text):   ${updated[0].end_date}`);

  } catch (error) {
    console.error('❌ Ошибка:', error);
  } finally {
    await sql.end();
  }
}

fixBookingTime();

