#!/usr/bin/env node

/**
 * Check why booking events are not being saved
 */

import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

async function checkBookingEvents() {
  const sql = postgres(CONNECTION_STRING, {
    max: 1,
    ssl: { rejectUnauthorized: false },
    connect_timeout: 10
  });

  try {
    console.log('🔍 Проверка событий о бронях...\n');

    const events = [
      { booking: '514142', desc: 'Данияр Байбаков принял авто, бронь № 514142', time: '11:01' },
      { booking: '514142', desc: 'Данияр Байбаков изменил бронь № 514142', time: '11:00' },
      { booking: '514499', desc: 'Eliseev Aleksei Jr изменил бронь № 514499', time: '10:57' },
      { booking: '514378', desc: 'Eliseev Aleksei Jr выдал авто, бронь № 514378', time: '10:57' }
    ];

    for (const event of events) {
      console.log(`\n${'─'.repeat(60)}`);
      console.log(`📅 Бронь №${event.booking} (${event.time})`);
      console.log(`📝 ${event.desc}\n`);

      // Search in history
      const records = await sql`
        SELECT 
          id,
          created_at,
          branch,
          operation_type,
          entity_type,
          entity_id,
          description,
          processed,
          error_code
        FROM history
        WHERE description ILIKE ${'%' + event.booking + '%'}
          AND description ILIKE ${'%' + event.desc.split(' ')[0] + '%'}
        ORDER BY created_at DESC
        LIMIT 5
      `;

      if (records.length === 0) {
        console.log('❌ НЕ НАЙДЕНО в history');
      } else {
        console.log(`✅ Найдено записей: ${records.length}`);
        records.forEach((record, idx) => {
          const status = record.processed && !record.error_code ? '✅' 
                       : record.error_code ? `❌ ${record.error_code}` 
                       : '⏳';
          console.log(`\n  [${idx + 1}] ${status} ID: ${record.id}`);
          console.log(`      Время: ${record.created_at.toISOString()}`);
          console.log(`      Entity: ${record.entity_type || 'NULL'} / ${record.entity_id || 'NULL'}`);
          console.log(`      Описание: ${(record.description || '').substring(0, 100)}...`);
        });
      }
    }

    // Check unique constraint
    console.log('\n' + '═'.repeat(60));
    console.log('🔍 Проверка уникального ключа в таблице history...\n');
    
    const uniqueConstraint = await sql`
      SELECT 
        conname as constraint_name,
        pg_get_constraintdef(oid) as constraint_def
      FROM pg_constraint
      WHERE conrelid = 'history'::regclass
        AND contype = 'u'
    `;

    if (uniqueConstraint.length > 0) {
      console.log('Уникальные ограничения:');
      uniqueConstraint.forEach(con => {
        console.log(`  ${con.constraint_name}: ${con.constraint_def}`);
      });
    } else {
      console.log('Уникальных ограничений не найдено');
    }

    // Check table structure
    console.log('\n📋 Структура таблицы history:\n');
    const columns = await sql`
      SELECT 
        column_name,
        data_type,
        is_nullable
      FROM information_schema.columns
      WHERE table_name = 'history'
      ORDER BY ordinal_position
    `;

    columns.forEach(col => {
      console.log(`  ${col.column_name}: ${col.data_type} (${col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'})`);
    });

  } catch (error) {
    console.error('❌ Ошибка:', error);
    throw error;
  } finally {
    await sql.end();
  }
}

checkBookingEvents().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

