#!/usr/bin/env node

import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

async function checkTimezoneUsage() {
  try {
    console.log('🔍 Проверка использования часовых поясов в БД\n');
    console.log('='.repeat(80));
    
    // 1. Проверить текущую функцию триггера
    console.log('\n📋 1. Текущая функция sync_booking_fields:');
    console.log('-'.repeat(80));
    
    const triggerFunc = await sql`
      SELECT 
        prosrc as function_body
      FROM pg_proc
      WHERE proname = 'sync_booking_fields'
    `;
    
    if (triggerFunc.length === 0) {
      console.log('❌ Функция sync_booking_fields не найдена');
    } else {
      const body = triggerFunc[0].function_body;
      
      if (body.includes("AT TIME ZONE 'UTC'")) {
        console.log('❌ ПРОБЛЕМА: Функция использует UTC вместо Asia/Tbilisi!');
        console.log('   Нужно исправить миграцию 017');
      } else if (body.includes("AT TIME ZONE 'Asia/Tbilisi'")) {
        console.log('✅ Функция использует Asia/Tbilisi');
      } else {
        console.log('⚠️  Не удалось определить часовой пояс в функции');
      }
      
      // Показать строки с AT TIME ZONE
      const timezoneLines = body.split('\n').filter(line => line.includes('AT TIME ZONE'));
      if (timezoneLines.length > 0) {
        console.log('\n   Строки с AT TIME ZONE:');
        timezoneLines.forEach((line, idx) => {
          console.log(`   ${idx + 1}. ${line.trim()}`);
        });
      }
    }
    
    // 2. Проверить примеры дат в БД
    console.log('\n📅 2. Примеры дат в таблице bookings:');
    console.log('-'.repeat(80));
    
    const sampleBookings = await sql`
      SELECT 
        b.id,
        b.start_at,
        b.end_at,
        b.start_date,
        b.end_date,
        er.external_id as rentprog_id
      FROM bookings b
      LEFT JOIN external_refs er ON er.entity_id = b.id 
        AND er.entity_type = 'booking' 
        AND er.system = 'rentprog'
      WHERE b.start_at IS NOT NULL 
        AND b.end_at IS NOT NULL
        AND b.start_date IS NOT NULL
        AND b.end_date IS NOT NULL
      ORDER BY b.updated_at DESC
      LIMIT 5
    `;
    
    if (sampleBookings.length === 0) {
      console.log('❌ Брони не найдены');
    } else {
      console.log(`Найдено броней: ${sampleBookings.length}\n`);
      sampleBookings.forEach((b, idx) => {
        console.log(`${idx + 1}. RentProg ID: ${b.rentprog_id || 'N/A'}`);
        console.log(`   start_at: ${b.start_at}`);
        console.log(`   start_date: ${b.start_date}`);
        
        // Проверить формат start_date
        if (b.start_date && b.start_date.includes('+00')) {
          console.log('   ⚠️  start_date в UTC формате (+00) - должно быть +04');
        } else if (b.start_date && b.start_date.includes('+04')) {
          console.log('   ✅ start_date в Asia/Tbilisi формате (+04)');
        }
        
        // Проверить соответствие start_at и start_date
        if (b.start_at && b.start_date) {
          const startAtTbilisi = new Date(b.start_at).toLocaleString('ru-RU', { 
            timeZone: 'Asia/Tbilisi',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
          });
          
          const expectedDateStr = startAtTbilisi.replace(/(\d{2})\.(\d{2})\.(\d{4}), (\d{2}):(\d{2}):(\d{2})/, '$3-$2-$1 $4:$5:$6+04');
          
          if (b.start_date.includes('+00')) {
            console.log(`   ❌ Несоответствие: start_date в UTC, а должно быть: ${expectedDateStr}`);
          } else if (b.start_date.includes('+04')) {
            console.log(`   ✅ Формат правильный`);
          }
        }
        
        console.log('');
      });
    }
    
    // 3. Статистика по форматам дат
    console.log('\n📊 3. Статистика по форматам start_date:');
    console.log('-'.repeat(80));
    
    const dateStats = await sql`
      SELECT 
        COUNT(*) FILTER (WHERE start_date LIKE '%+00') as utc_count,
        COUNT(*) FILTER (WHERE start_date LIKE '%+04') as tbilisi_count,
        COUNT(*) FILTER (WHERE start_date IS NOT NULL AND start_date NOT LIKE '%+00' AND start_date NOT LIKE '%+04') as other_format,
        COUNT(*) FILTER (WHERE start_date IS NULL) as null_count
      FROM bookings
      WHERE start_at IS NOT NULL
    `;
    
    if (dateStats.length > 0) {
      const stats = dateStats[0];
      console.log(`   UTC формат (+00): ${stats.utc_count}`);
      console.log(`   Asia/Tbilisi формат (+04): ${stats.tbilisi_count}`);
      console.log(`   Другие форматы: ${stats.other_format}`);
      console.log(`   NULL: ${stats.null_count}`);
      
      if (stats.utc_count > 0) {
        console.log(`\n   ⚠️  Найдено ${stats.utc_count} записей с UTC форматом - нужно исправить!`);
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

checkTimezoneUsage();

