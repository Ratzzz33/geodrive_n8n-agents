#!/usr/bin/env node

import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

async function checkCar() {
  try {
    const plate = 'QZ101QQ';
    const rentprogId = '65470';
    
    console.log('🔍 Проверка информации об автомобиле QZ101QQ\n');
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
      
      // Проверка модели
      if (car.model && !car.model.toLowerCase().includes('kia') && !car.model.toLowerCase().includes('soul')) {
        console.log(`\n⚠️  ВНИМАНИЕ: Модель в БД (${car.model}) не совпадает с указанной (Kia Soul)`);
      }
      
      // 2. Проверка по RentProg ID
      if (car.rentprog_id !== rentprogId) {
        console.log(`\n⚠️  ВНИМАНИЕ: RentProg ID в БД (${car.rentprog_id}) не совпадает с указанным (${rentprogId})`);
      }
      
      // 3. Проверка текущих броней
      console.log('\n📅 2. Проверка текущих броней');
      console.log('-'.repeat(80));
      
      const now = new Date();
      console.log(`   Текущее время: ${now.toISOString()}`);
      console.log(`   Текущее время (Asia/Tbilisi): ${now.toLocaleString('ru-RU', { timeZone: 'Asia/Tbilisi' })}`);
      
      const currentBookings = await sql`
        SELECT 
          b.id,
          b.state,
          b.status,
          COALESCE(b.start_date::timestamptz, b.start_at) as start_time,
          COALESCE(b.end_date::timestamptz, b.end_at) as end_time,
          b.branch,
          b.data
        FROM bookings b
        WHERE b.car_id = ${car.id}
          AND (
            (COALESCE(b.start_date::timestamptz, b.start_at) <= ${now}::timestamptz
             AND COALESCE(b.end_date::timestamptz, b.end_at) >= ${now}::timestamptz)
            OR
            (COALESCE(b.start_date::timestamptz, b.start_at) >= ${now}::timestamptz
             AND COALESCE(b.start_date::timestamptz, b.start_at) <= ${now}::timestamptz + INTERVAL '30 days')
          )
        ORDER BY COALESCE(b.start_date::timestamptz, b.start_at) ASC
      `;
      
      if (currentBookings.length === 0) {
        console.log('❌ Текущая бронь: нет');
        console.log('❌ Ближайшая бронь: нет (в ближайшие 30 дней)');
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
            console.log(`      Статус: ${b.status || b.state || 'N/A'}`);
            console.log(`      Филиал: ${b.branch || 'N/A'}`);
            console.log(`      С: ${b.start_time} (${new Date(b.start_time).toLocaleString('ru-RU', { timeZone: 'Asia/Tbilisi' })})`);
            console.log(`      До: ${b.end_time} (${new Date(b.end_time).toLocaleString('ru-RU', { timeZone: 'Asia/Tbilisi' })})`);
          });
        } else {
          console.log('❌ Текущая бронь: нет');
        }
        
        if (upcomingBookings.length > 0) {
          const nearest = upcomingBookings[0];
          const timeUntilStart = new Date(nearest.start_time) - now;
          const hoursUntil = Math.floor(timeUntilStart / (1000 * 60 * 60));
          const minutesUntil = Math.floor((timeUntilStart % (1000 * 60 * 60)) / (1000 * 60));
          
          console.log('\n✅ Ближайшая бронь: ЕСТЬ');
          console.log(`   ID: ${nearest.id}`);
          console.log(`   Статус: ${nearest.status || nearest.state || 'N/A'}`);
          console.log(`   Филиал: ${nearest.branch || 'N/A'}`);
          console.log(`   С: ${nearest.start_time} (${new Date(nearest.start_time).toLocaleString('ru-RU', { timeZone: 'Asia/Tbilisi' })})`);
          console.log(`   До: ${nearest.end_time} (${new Date(nearest.end_time).toLocaleString('ru-RU', { timeZone: 'Asia/Tbilisi' })})`);
          console.log(`   Через: ${hoursUntil} ч ${minutesUntil} мин`);
          
          // Проверка соответствия с данными пользователя
          const expectedStart = new Date('2025-11-22T01:00:00+04:00'); // 22.11.2025 01:00 Asia/Tbilisi
          const expectedEnd = new Date('2025-11-23T01:00:00+04:00'); // 23.11.2025 01:00 Asia/Tbilisi
          const actualStart = new Date(nearest.start_time);
          const actualEnd = new Date(nearest.end_time);
          
          const startDiff = Math.abs(actualStart - expectedStart);
          const endDiff = Math.abs(actualEnd - expectedEnd);
          
          if (startDiff > 60000 || endDiff > 60000) { // Разница больше 1 минуты
            console.log(`\n⚠️  ВНИМАНИЕ: Даты брони не совпадают с указанными!`);
            console.log(`   Ожидалось: ${expectedStart.toLocaleString('ru-RU', { timeZone: 'Asia/Tbilisi' })} - ${expectedEnd.toLocaleString('ru-RU', { timeZone: 'Asia/Tbilisi' })}`);
            console.log(`   В БД: ${actualStart.toLocaleString('ru-RU', { timeZone: 'Asia/Tbilisi' })} - ${actualEnd.toLocaleString('ru-RU', { timeZone: 'Asia/Tbilisi' })}`);
          } else {
            console.log(`\n✅ Даты брони совпадают с указанными`);
          }
          
          if (nearest.branch && !nearest.branch.toLowerCase().includes('tbilisi') && !nearest.branch.toLowerCase().includes('тбилиси')) {
            console.log(`\n⚠️  ВНИМАНИЕ: Филиал в БД (${nearest.branch}) не совпадает с указанным (Тбилиси)`);
          }
        } else {
          console.log('\n❌ Ближайшая бронь: нет (в ближайшие 30 дней)');
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
          b.branch,
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
          console.log(`      С: ${b.start_time} (${new Date(b.start_time).toLocaleString('ru-RU', { timeZone: 'Asia/Tbilisi' })})`);
          console.log(`      До: ${b.end_time} (${new Date(b.end_time).toLocaleString('ru-RU', { timeZone: 'Asia/Tbilisi' })})`);
          console.log(`      Статус: ${b.status || b.state || 'N/A'}`);
          console.log(`      Филиал: ${b.branch || 'N/A'}`);
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

