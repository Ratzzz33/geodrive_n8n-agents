#!/usr/bin/env node

/**
 * Find all events by author in history_audit table
 * Usage: node setup/find_events_by_author.mjs "Данияр Байбаков"
 */

import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

async function findEventsByAuthor(authorName) {
  const sql = postgres(CONNECTION_STRING, {
    max: 1,
    ssl: { rejectUnauthorized: false },
    connect_timeout: 10
  });

  try {
    console.log(`🔍 Поиск событий по автору: "${authorName}"\n`);

    const events = await sql`
      SELECT 
        id,
        ts,
        branch,
        operation_type,
        operation_id,
        description,
        entity_type,
        entity_id,
        user_name,
        created_at,
        processed,
        error_code
      FROM history_audit
      WHERE user_name ILIKE ${'%' + authorName + '%'}
      ORDER BY created_at DESC, ts DESC
      LIMIT 50
    `;

    if (events.length === 0) {
      console.log('❌ События не найдены');
      console.log('\n💡 Попробуйте поискать в таблице history:');
      const historyEvents = await sql`
        SELECT 
          id,
          created_at,
          description,
          entity_type,
          entity_id,
          user_name
        FROM history
        WHERE user_name ILIKE ${'%' + authorName + '%'}
        ORDER BY created_at DESC
        LIMIT 10
      `;
      
      if (historyEvents.length > 0) {
        console.log(`\nНайдено в history: ${historyEvents.length} записей`);
        historyEvents.forEach((event, idx) => {
          console.log(`\n  [${idx + 1}] ID: ${event.id}`);
          console.log(`      Время: ${event.created_at.toISOString()}`);
          console.log(`      Автор: ${event.user_name || 'NULL'}`);
          console.log(`      Entity: ${event.entity_type || 'NULL'} / ${event.entity_id || 'NULL'}`);
          console.log(`      Описание: ${(event.description || '').substring(0, 80)}...`);
        });
      }
      return;
    }

    console.log(`✅ Найдено событий: ${events.length}\n`);

    events.forEach((event, idx) => {
      const status = event.processed && !event.error_code ? '✅' 
                   : event.error_code ? `❌ ${event.error_code}` 
                   : '⏳';
      console.log(`\n${'─'.repeat(60)}`);
      console.log(`[${idx + 1}] ${status} ID: ${event.id}`);
      console.log(`    Время: ${event.created_at ? event.created_at.toISOString() : event.ts.toISOString()}`);
      console.log(`    Филиал: ${event.branch || 'NULL'}`);
      console.log(`    Автор: ${event.user_name || 'NULL'}`);
      console.log(`    Entity: ${event.entity_type || 'NULL'} / ${event.entity_id || 'NULL'}`);
      console.log(`    operation_id: ${event.operation_id || 'NULL'}`);
      console.log(`    Описание: ${(event.description || '').substring(0, 100)}...`);
    });

    // Статистика
    console.log('\n' + '═'.repeat(60));
    console.log('📊 Статистика:\n');
    
    const stats = await sql`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE processed = TRUE) as processed,
        COUNT(*) FILTER (WHERE error_code IS NOT NULL) as errors,
        COUNT(DISTINCT entity_type) as entity_types,
        COUNT(DISTINCT branch) as branches
      FROM history_audit
      WHERE user_name ILIKE ${'%' + authorName + '%'}
    `;

    const s = stats[0];
    console.log(`Всего событий: ${s.total}`);
    console.log(`Обработано: ${s.processed}`);
    console.log(`С ошибками: ${s.errors}`);
    console.log(`Типов сущностей: ${s.entity_types}`);
    console.log(`Филиалов: ${s.branches}`);

  } catch (error) {
    console.error('❌ Ошибка:', error);
    throw error;
  } finally {
    await sql.end();
  }
}

const authorName = process.argv[2] || 'Данияр Байбаков';
findEventsByAuthor(authorName).catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

