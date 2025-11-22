#!/usr/bin/env node
/**
 * Выполняет SQL запрос для анализа бронирований по номеру машины
 */

import postgres from 'postgres';

const CONNECTION_STRING = process.env.DATABASE_URL || 
  'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const PLATE = process.argv[2] || 'QQ325EQ';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

async function queryBookings() {
  try {
    console.log(`\n🔍 Поиск бронирований для машины: ${PLATE}\n`);
    
    // Сначала пробуем через JOIN с cars
    console.log('📋 Запрос 1: Через JOIN с таблицей cars');
    const result1 = await sql`
      SELECT  
        b.id,  
        b.car_id,  
        b.state,  
        b.status,  
        b.start_at,  
        b.end_at,  
        b.start_date,  
        b.end_date,  
        b.is_technical,  
        b.data
      FROM bookings b
      LEFT JOIN cars c ON c.id = b.car_id
      WHERE c.plate = ${PLATE}
      ORDER BY COALESCE(b.start_at, b.start_date::timestamptz) DESC
      LIMIT 5;
    `;
    
    if (result1.length > 0) {
      console.log(`✅ Найдено ${result1.length} бронирований через JOIN:\n`);
      result1.forEach((row, idx) => {
        console.log(`--- Бронирование ${idx + 1} ---`);
        console.log(`ID: ${row.id}`);
        console.log(`Car ID: ${row.car_id || 'NULL'}`);
        console.log(`State: ${row.state || 'NULL'}`);
        console.log(`Status: ${row.status || 'NULL'}`);
        console.log(`Start At: ${row.start_at || 'NULL'}`);
        console.log(`End At: ${row.end_at || 'NULL'}`);
        console.log(`Start Date: ${row.start_date || 'NULL'}`);
        console.log(`End Date: ${row.end_date || 'NULL'}`);
        console.log(`Is Technical: ${row.is_technical || false}`);
        if (row.data) {
          const plate = row.data?.plate || 'не указан';
          console.log(`Plate в data: ${plate}`);
        }
        console.log('');
      });
    } else {
      console.log('⚠️  Не найдено через JOIN, пробуем поиск по data->>\'plate\'\n');
      
      // Альтернативный запрос через data->>'plate'
      console.log('📋 Запрос 2: Через data->>\'plate\'');
      const result2 = await sql`
        SELECT  
          b.id,  
          b.car_id,  
          b.state,  
          b.status,  
          b.start_at,  
          b.end_at,  
          b.start_date,  
          b.end_date,  
          b.is_technical,  
          b.data
        FROM bookings b
        WHERE b.data->>'plate' = ${PLATE}
        ORDER BY COALESCE(b.start_at, b.start_date::timestamptz) DESC
        LIMIT 5;
      `;
      
      if (result2.length > 0) {
        console.log(`✅ Найдено ${result2.length} бронирований через data->>'plate':\n`);
        result2.forEach((row, idx) => {
          console.log(`--- Бронирование ${idx + 1} ---`);
          console.log(`ID: ${row.id}`);
          console.log(`Car ID: ${row.car_id || 'NULL'}`);
          console.log(`State: ${row.state || 'NULL'}`);
          console.log(`Status: ${row.status || 'NULL'}`);
          console.log(`Start At: ${row.start_at || 'NULL'}`);
          console.log(`End At: ${row.end_at || 'NULL'}`);
          console.log(`Start Date: ${row.start_date || 'NULL'}`);
          console.log(`End Date: ${row.end_date || 'NULL'}`);
          console.log(`Is Technical: ${row.is_technical || false}`);
          if (row.data) {
            const plate = row.data?.plate || 'не указан';
            console.log(`Plate в data: ${plate}`);
          }
          console.log('');
        });
      } else {
        console.log('❌ Бронирования не найдены ни одним способом');
      }
    }
    
    // Дополнительная статистика
    console.log('\n📊 Статистика по статусам и состояниям:');
    const stats = await sql`
      SELECT  
        b.state,
        b.status,
        COUNT(*) as count
      FROM bookings b
      LEFT JOIN cars c ON c.id = b.car_id
      WHERE c.plate = ${PLATE} OR b.data->>'plate' = ${PLATE}
      GROUP BY b.state, b.status
      ORDER BY count DESC;
    `;
    
    if (stats.length > 0) {
      stats.forEach(stat => {
        console.log(`  State: ${stat.state || 'NULL'}, Status: ${stat.status || 'NULL'} → ${stat.count} шт.`);
      });
    }
    
  } catch (error) {
    console.error('❌ Ошибка выполнения запроса:', error.message);
    console.error(error);
  } finally {
    await sql.end();
  }
}

queryBookings();

