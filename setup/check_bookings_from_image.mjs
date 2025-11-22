#!/usr/bin/env node
/**
 * Проверка наличия броней из изображения календаря в БД
 * Дата: 2025-11-18
 */

import postgres from 'postgres';

const CONNECTION_STRING = process.env.DATABASE_URL || 
  'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

// Брони из изображения
const bookingsFromImage = [
  {
    carName: 'Buick Encore 279',
    carNumber: '279',
    startDate: '2025-11-19',
    endDate: '2025-11-20',
    location: 'Kutaisi',
    description: 'Kutaisi, MAX COMFORT 11:00 - Kutaisi, - 11:00'
  },
  {
    carName: 'BMW X6 704',
    carNumber: '704',
    startDate: '2025-11-19',
    endDate: '2025-11-20',
    location: 'Kutaisi Airport',
    description: 'Kutaisi Airport, 5FJ8+R62, Zeda Bashi 19:30 - Kutaisi A'
  },
  {
    carName: 'Tiguan 630 Allspace',
    carNumber: '630',
    startDate: '2025-11-22',
    endDate: '2025-11-23',
    location: 'Kutaisi Airport',
    description: 'Kutaisi Airport, FS 7905, Zeda Bash'
  },
  {
    carName: 'VW Tiguan 468 4x4',
    carNumber: '468',
    startDate: '2025-11-27',
    endDate: '2025-11-28',
    location: 'Tbilisi',
    description: 'Tbilisi, Al Chavchavadze Street, 11, M'
  },
  {
    carName: 'Cruze 551 Hatch',
    carNumber: '551',
    startDate: '2025-11-28',
    endDate: '2025-11-29',
    location: 'Tbilisi Airport',
    description: 'Tbilisi, Airport 16:00 - Tbilisi, Airport 14:00'
  },
  {
    carName: 'Kia Sportage 738',
    carNumber: '738',
    startDate: '2025-11-25',
    endDate: '2025-11-26',
    location: 'Kutaisi Airport',
    description: 'Kutaisi Airport, 5FJ8+R62, Zed'
  },
  {
    carName: 'Subaru Forester 390',
    carNumber: '390',
    startDate: '2025-11-21',
    endDate: '2025-11-22',
    location: 'Kutaisi Office',
    description: 'Kutaisi Office, 2 shartava st, Kutaisi 11:30 - Kutaisi Office, 2 shartava st, Kutaisi 11:30'
  },
  {
    carName: 'Subaru Forester 390',
    carNumber: '390',
    startDate: '2025-11-24',
    endDate: '2025-11-25',
    location: 'Kutaisi Airport',
    description: 'Kutaisi Airport, W6 7920, Zeda Bashi 1:15 - Kutaisi Airport, W6 7919, Zeda Bashi'
  },
  {
    carName: 'Mercedes GLE 700',
    carNumber: '700',
    startDate: '2025-11-17',
    endDate: '2025-11-20',
    location: 'Batumi → Kutaisi',
    description: '90 Lermontov Str, Batumi 9:30 - Kutaisi 16:00'
  }
];

async function checkBookings() {
  try {
    console.log('🔍 Проверка наличия броней из календаря в БД\n');
    console.log('━'.repeat(80));
    
    const results = [];
    
    for (const booking of bookingsFromImage) {
      console.log(`\n📋 Проверка: ${booking.carName}`);
      console.log(`   Период: ${booking.startDate} - ${booking.endDate}`);
      console.log(`   Локация: ${booking.location}`);
      
      // 1. Ищем машину по номеру или названию
      const cars = await sql`
        SELECT 
          c.id,
          c.plate,
          c.model,
          c.car_visual_name,
          er.external_id as rentprog_id
        FROM cars c
        LEFT JOIN external_refs er ON er.entity_id = c.id 
          AND er.entity_type = 'car'
          AND er.system = 'rentprog'
        WHERE 
          -- Поиск по номеру в plate
          (c.plate LIKE ${`%${booking.carNumber}%`} 
           OR UPPER(REPLACE(c.plate, ' ', '')) LIKE ${`%${booking.carNumber}%`})
          -- Или по названию модели
          OR (c.model ILIKE ${`%${booking.carName.split(' ')[0]}%`} 
              AND c.model ILIKE ${`%${booking.carNumber}%`})
          OR (c.car_visual_name ILIKE ${`%${booking.carName}%`})
      `;
      
      if (cars.length === 0) {
        console.log(`   ❌ Машина НЕ НАЙДЕНА в БД`);
        results.push({
          booking,
          found: false,
          reason: 'Машина не найдена',
          car: null,
          bookings: []
        });
        continue;
      }
      
      console.log(`   ✅ Найдено машин: ${cars.length}`);
      for (const car of cars) {
        console.log(`      - ${car.model || car.car_visual_name} (${car.plate || 'без номера'}) [RentProg: ${car.rentprog_id || 'N/A'}]`);
      }
      
      // 2. Проверяем брони для каждой найденной машины
      let foundBooking = false;
      const foundBookings = [];
      
      for (const car of cars) {
        // Ищем брони в указанном периоде
        const bookings = await sql`
          SELECT 
            b.id,
            b.start_at,
            b.end_at,
            b.start_date,
            b.end_date,
            b.status,
            b.state,
            b.location_start,
            b.location_end,
            b.branch,
            b.client_name,
            b.data,
            er.external_id as rentprog_booking_id
          FROM bookings b
          LEFT JOIN external_refs er ON er.entity_id = b.id 
            AND er.entity_type = 'booking'
            AND er.system = 'rentprog'
          WHERE b.car_id = ${car.id}
            AND (
              -- Проверка пересечения дат (start_at/end_at)
              (b.start_at IS NOT NULL AND b.end_at IS NOT NULL
               AND b.start_at::date <= ${booking.endDate}::date
               AND b.end_at::date >= ${booking.startDate}::date)
              -- Или через start_date/end_date
              OR (b.start_date IS NOT NULL AND b.end_date IS NOT NULL
                  AND b.start_date::date <= ${booking.endDate}::date
                  AND b.end_date::date >= ${booking.startDate}::date)
            )
          ORDER BY COALESCE(b.start_at, b.start_date::timestamptz)
        `;
        
        if (bookings.length > 0) {
          foundBooking = true;
          for (const b of bookings) {
            foundBookings.push({
              car,
              booking: b
            });
            
            const startDate = b.start_at || b.start_date;
            const endDate = b.end_at || b.end_date;
            const location = b.location_start || b.location_end || b.branch || 'N/A';
            
            console.log(`   ✅ Найдена бронь:`);
            console.log(`      ID: ${b.id}`);
            console.log(`      Период: ${startDate} - ${endDate}`);
            console.log(`      Локация: ${location}`);
            console.log(`      Статус: ${b.status || b.state || 'N/A'}`);
            console.log(`      Клиент: ${b.client_name || 'N/A'}`);
            console.log(`      RentProg ID: ${b.rentprog_booking_id || 'N/A'}`);
            
            // Проверяем соответствие локации
            const locationMatch = 
              location.toLowerCase().includes(booking.location.toLowerCase().split(' ')[0]) ||
              booking.location.toLowerCase().includes(location.toLowerCase().split(' ')[0]);
            
            if (!locationMatch) {
              console.log(`      ⚠️  Локация не совпадает: ожидалось "${booking.location}"`);
            }
          }
        }
      }
      
      if (!foundBooking) {
        console.log(`   ❌ Бронь НЕ НАЙДЕНА в БД для периода ${booking.startDate} - ${booking.endDate}`);
      }
      
      results.push({
        booking,
        found: foundBooking,
        reason: foundBooking ? 'Найдена' : 'Бронь не найдена',
        cars: cars,
        bookings: foundBookings
      });
    }
    
    // Итоговая статистика
    console.log('\n\n' + '═'.repeat(80));
    console.log('📊 ИТОГОВАЯ СТАТИСТИКА');
    console.log('═'.repeat(80));
    
    const foundCount = results.filter(r => r.found).length;
    const notFoundCount = results.filter(r => !r.found).length;
    const carsNotFound = results.filter(r => !r.car || r.car.length === 0).length;
    
    console.log(`\n✅ Найдено броней: ${foundCount} из ${results.length}`);
    console.log(`❌ Не найдено броней: ${notFoundCount} из ${results.length}`);
    console.log(`🚗 Машин не найдено: ${carsNotFound}`);
    
    if (notFoundCount > 0) {
      console.log('\n📋 Детали отсутствующих броней:');
      results.filter(r => !r.found).forEach(r => {
        console.log(`\n   - ${r.booking.carName} (${r.booking.startDate} - ${r.booking.endDate})`);
        console.log(`     Причина: ${r.reason}`);
        if (r.car && r.car.length === 0) {
          console.log(`     ⚠️  Машина не найдена в БД`);
        } else if (r.car && r.car.length > 0) {
          console.log(`     ⚠️  Машина найдена, но бронь отсутствует`);
        }
      });
    }
    
  } catch (error) {
    console.error('❌ Ошибка:', error);
  } finally {
    await sql.end();
  }
}

checkBookings();

