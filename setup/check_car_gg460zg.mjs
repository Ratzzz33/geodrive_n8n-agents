#!/usr/bin/env node

import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

async function checkCar() {
  try {
    const plate = 'GG460ZG';
    const rentprogId = '63336';
    
    console.log('🔍 Проверка информации об автомобиле GG460ZG\n');
    console.log('='.repeat(80));
    
    // 1. Проверка автомобиля в БД по номеру
    console.log('\n📋 1. Поиск автомобиля в БД по номеру:', plate);
    console.log('-'.repeat(80));
    
    const cars = await sql`
      SELECT 
        c.id,
        c.plate,
        c.model,
        c.vin,
        c.state,
        c.branch_id,
        b.code as branch_code,
        b.name as branch_name,
        er.external_id as rentprog_id
      FROM cars c
      LEFT JOIN branches b ON b.id = c.branch_id
      LEFT JOIN external_refs er ON er.entity_id = c.id 
        AND er.entity_type = 'car' 
        AND er.system = 'rentprog'
      WHERE UPPER(REPLACE(c.plate, ' ', '')) = UPPER(REPLACE(${plate}, ' ', ''))
    `;
    
    if (cars.length === 0) {
      console.log('❌ Автомобиль НЕ НАЙДЕН в БД по номеру', plate);
    } else {
      const car = cars[0];
      console.log('✅ Автомобиль найден:');
      console.log(`   ID: ${car.id}`);
      console.log(`   Номер: ${car.plate}`);
      console.log(`   Модель: ${car.model || 'N/A'}`);
      console.log(`   VIN: ${car.vin || 'N/A'}`);
      console.log(`   Состояние: ${car.state || 'N/A'}`);
      console.log(`   Филиал: ${car.branch_name || 'N/A'} (${car.branch_code || 'N/A'})`);
      console.log(`   RentProg ID: ${car.rentprog_id || 'N/A'}`);
      
      // 2. Проверка по RentProg ID
      if (car.rentprog_id !== rentprogId) {
        console.log(`\n⚠️  ВНИМАНИЕ: RentProg ID в БД (${car.rentprog_id}) не совпадает с указанным (${rentprogId})`);
      }
      
      // 3. Проверка текущих броней
      console.log('\n📅 2. Проверка текущих броней');
      console.log('-'.repeat(80));
      
      const now = new Date();
      const currentBookings = await sql`
        SELECT 
          b.id,
          b.state,
          b.status,
          COALESCE(b.start_date::timestamptz, b.start_at) as start_time,
          COALESCE(b.end_date::timestamptz, b.end_at) as end_time,
          b.data
        FROM bookings b
        WHERE b.car_id = ${car.id}
          AND (
            (COALESCE(b.start_date::timestamptz, b.start_at) <= ${now}::timestamptz
             AND COALESCE(b.end_date::timestamptz, b.end_at) >= ${now}::timestamptz)
            OR
            (COALESCE(b.start_date::timestamptz, b.start_at) >= ${now}::timestamptz
             AND COALESCE(b.start_date::timestamptz, b.start_at) <= ${now}::timestamptz + INTERVAL '7 days')
          )
        ORDER BY COALESCE(b.start_date::timestamptz, b.start_at) ASC
      `;
      
      if (currentBookings.length === 0) {
        console.log('❌ Текущая бронь: нет');
        console.log('❌ Ближайшая бронь: нет (в ближайшие 7 дней)');
      } else {
        const activeBookings = currentBookings.filter(b => {
          const start = b.start_time;
          const end = b.end_time;
          return start <= now && end >= now;
        });
        
        const upcomingBookings = currentBookings.filter(b => {
          const start = b.start_time;
          return start > now;
        });
        
        if (activeBookings.length > 0) {
          console.log('✅ Текущая бронь: ЕСТЬ');
          activeBookings.forEach((b, idx) => {
            console.log(`   ${idx + 1}. ID: ${b.id}`);
            console.log(`      Статус: ${b.status || 'N/A'}`);
            console.log(`      С: ${b.start_time}`);
            console.log(`      До: ${b.end_time}`);
          });
        } else {
          console.log('❌ Текущая бронь: нет');
        }
        
        if (upcomingBookings.length > 0) {
          const nearest = upcomingBookings[0];
          console.log('\n✅ Ближайшая бронь: ЕСТЬ');
          console.log(`   ID: ${nearest.id}`);
          console.log(`   Статус: ${nearest.status || 'N/A'}`);
          console.log(`   С: ${nearest.start_time}`);
          console.log(`   До: ${nearest.end_time}`);
        } else {
          console.log('\n❌ Ближайшая бронь: нет (в ближайшие 7 дней)');
        }
      }
      
      // 4. Проверка всех броней (последние 10)
      console.log('\n📊 3. Последние брони (топ 10)');
      console.log('-'.repeat(80));
      
      const allBookings = await sql`
        SELECT 
          b.id,
          b.state,
          b.status,
          COALESCE(b.start_date::timestamptz, b.start_at) as start_time,
          COALESCE(b.end_date::timestamptz, b.end_at) as end_time
        FROM bookings b
        WHERE b.car_id = ${car.id}
        ORDER BY COALESCE(b.start_date::timestamptz, b.start_at) DESC
        LIMIT 10
      `;
      
      if (allBookings.length === 0) {
        console.log('❌ Брони не найдены');
      } else {
        console.log(`Найдено броней: ${allBookings.length}\n`);
        allBookings.forEach((b, idx) => {
          const isActive = b.start_time <= now && b.end_time >= now;
          const isUpcoming = b.start_time > now;
          const statusIcon = isActive ? '🟢' : isUpcoming ? '🔵' : '⚪';
          console.log(`${statusIcon} ${idx + 1}. ID: ${b.id}`);
          console.log(`      С: ${b.start_time}`);
          console.log(`      До: ${b.end_time}`);
          console.log(`      Статус: ${b.status || 'N/A'}`);
        });
      }
    }
    
    // 5. Проверка по RentProg ID напрямую
    console.log('\n🔗 4. Проверка по RentProg ID:', rentprogId);
    console.log('-'.repeat(80));
    
    const carsByRentprog = await sql`
      SELECT 
        c.id,
        c.plate,
        c.model,
        er.external_id as rentprog_id
      FROM cars c
      JOIN external_refs er ON er.entity_id = c.id 
        AND er.entity_type = 'car' 
        AND er.system = 'rentprog'
      WHERE er.external_id = ${rentprogId}
    `;
    
    if (carsByRentprog.length === 0) {
      console.log(`❌ Автомобиль с RentProg ID ${rentprogId} НЕ НАЙДЕН в БД`);
    } else {
      const carByRentprog = carsByRentprog[0];
      console.log('✅ Автомобиль найден по RentProg ID:');
      console.log(`   ID: ${carByRentprog.id}`);
      console.log(`   Номер: ${carByRentprog.plate}`);
      console.log(`   Модель: ${carByRentprog.model || 'N/A'}`);
      
      if (cars.length > 0 && cars[0].id !== carByRentprog.id) {
        console.log('\n⚠️  ВНИМАНИЕ: Найдены разные автомобили по номеру и RentProg ID!');
      }
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('✅ Проверка завершена');
    
  } catch (error) {
    console.error('❌ Ошибка:', error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

checkCar();

