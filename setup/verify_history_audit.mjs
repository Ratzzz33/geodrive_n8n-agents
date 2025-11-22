#!/usr/bin/env node

/**
 * Verify history_audit table and workflow functionality
 */

import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

async function verify() {
  const sql = postgres(CONNECTION_STRING, {
    max: 1,
    ssl: { rejectUnauthorized: false },
    connect_timeout: 10
  });

  try {
    console.log('🔍 Проверка работы history_audit...\n');

    // 1. Проверка структуры таблицы
    console.log('1️⃣ Проверка структуры таблицы history_audit:\n');
    const columns = await sql`
      SELECT 
        column_name,
        data_type,
        is_nullable
      FROM information_schema.columns
      WHERE table_name = 'history_audit'
      ORDER BY ordinal_position
    `;

    if (columns.length === 0) {
      console.log('❌ Таблица history_audit не найдена!');
      return;
    }

    console.log('✅ Таблица history_audit существует');
    console.log(`   Колонок: ${columns.length}`);
    columns.forEach(col => {
      console.log(`   - ${col.column_name}: ${col.data_type} (${col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'})`);
    });

    // 2. Проверка триггера
    console.log('\n2️⃣ Проверка триггера:\n');
    const triggers = await sql`
      SELECT 
        trigger_name,
        event_manipulation,
        action_timing
      FROM information_schema.triggers
      WHERE event_object_table = 'history'
        AND trigger_name = 'history_to_audit_trigger'
    `;

    if (triggers.length > 0) {
      console.log('✅ Триггер history_to_audit_trigger существует');
      triggers.forEach(trg => {
        console.log(`   - ${trg.trigger_name}: ${trg.action_timing} ${trg.event_manipulation}`);
      });
    } else {
      console.log('⚠️ Триггер не найден');
    }

    // 3. Проверка индексов
    console.log('\n3️⃣ Проверка индексов:\n');
    const indexes = await sql`
      SELECT 
        indexname,
        indexdef
      FROM pg_indexes
      WHERE tablename = 'history_audit'
      ORDER BY indexname
    `;

    console.log(`Найдено индексов: ${indexes.length}`);
    indexes.forEach(idx => {
      console.log(`   - ${idx.indexname}`);
    });

    // 4. Статистика записей
    console.log('\n4️⃣ Статистика записей:\n');
    const stats = await sql`
      SELECT 
        (SELECT COUNT(*) FROM history) as history_count,
        (SELECT COUNT(*) FROM history_audit) as audit_count,
        (SELECT COUNT(*) FROM history WHERE created_at >= NOW() - INTERVAL '24 hours') as history_last_24h,
        (SELECT COUNT(*) FROM history_audit WHERE created_at >= NOW() - INTERVAL '24 hours') as audit_last_24h
    `;

    const s = stats[0];
    console.log(`history: ${s.history_count} всего / ${s.history_last_24h} за 24ч`);
    console.log(`history_audit: ${s.audit_count} всего / ${s.audit_last_24h} за 24ч`);

    if (s.audit_count === 0 && s.history_count > 0) {
      console.log('\n⚠️ ВНИМАНИЕ: history_audit пуста, но history содержит записи!');
      console.log('   Это означает, что триггер не сработал или записи были созданы до создания триггера.');
    }

    // 5. Проверка последних событий
    console.log('\n5️⃣ Последние события в history_audit:\n');
    const recentAudit = await sql`
      SELECT 
        id,
        ts,
        branch,
        user_name,
        entity_type,
        entity_id,
        description,
        operation_id
      FROM history_audit
      ORDER BY ts DESC
      LIMIT 5
    `;

    if (recentAudit.length > 0) {
      console.log(`Найдено записей: ${recentAudit.length}`);
      recentAudit.forEach((event, idx) => {
        console.log(`\n  [${idx + 1}] ID: ${event.id}`);
        console.log(`      Время: ${event.ts.toISOString()}`);
        console.log(`      Филиал: ${event.branch || 'NULL'}`);
        console.log(`      Автор: ${event.user_name || 'NULL'}`);
        console.log(`      Entity: ${event.entity_type || 'NULL'} / ${event.entity_id || 'NULL'}`);
        console.log(`      operation_id: ${event.operation_id || 'NULL'}`);
        console.log(`      Описание: ${(event.description || '').substring(0, 70)}...`);
      });
    } else {
      console.log('❌ Записей в history_audit нет');
    }

    // 6. Проверка событий о бронях
    console.log('\n6️⃣ Проверка событий о бронях (последние 24 часа):\n');
    const bookingEvents = await sql`
      SELECT 
        COUNT(*) as total,
        COUNT(DISTINCT user_name) as unique_authors,
        COUNT(DISTINCT entity_id) as unique_bookings
      FROM history_audit
      WHERE entity_type = 'booking'
        AND created_at >= NOW() - INTERVAL '24 hours'
    `;

    const be = bookingEvents[0];
    console.log(`Всего событий о бронях: ${be.total}`);
    console.log(`Уникальных авторов: ${be.unique_authors}`);
    console.log(`Уникальных броней: ${be.unique_bookings}`);

    if (parseInt(be.total) > 0) {
      const sampleBookings = await sql`
        SELECT 
          id,
          created_at,
          user_name,
          entity_id,
          description
        FROM history_audit
        WHERE entity_type = 'booking'
          AND created_at >= NOW() - INTERVAL '24 hours'
        ORDER BY created_at DESC
        LIMIT 5
      `;

      console.log('\nПримеры событий:');
      sampleBookings.forEach((event, idx) => {
        console.log(`\n  [${idx + 1}] ${event.user_name || 'NULL'} | Бронь ${event.entity_id}`);
        console.log(`      ${event.created_at.toISOString()}`);
        console.log(`      ${(event.description || '').substring(0, 80)}...`);
      });
    }

    // 7. Сравнение history vs history_audit
    console.log('\n7️⃣ Сравнение history vs history_audit (последние 10 записей):\n');
    const comparison = await sql`
      SELECT 
        h.id as history_id,
        h.operation_id,
        h.user_name,
        h.entity_id,
        COUNT(ha.id) as audit_count
      FROM history h
      LEFT JOIN history_audit ha ON h.operation_id = ha.operation_id AND h.branch = ha.branch
      WHERE h.created_at >= NOW() - INTERVAL '24 hours'
      GROUP BY h.id, h.operation_id, h.user_name, h.entity_id
      ORDER BY h.created_at DESC
      LIMIT 10
    `;

    console.log('Сравнение:');
    comparison.forEach((comp, idx) => {
      const status = parseInt(comp.audit_count) > 0 ? '✅' : '❌';
      console.log(`  [${idx + 1}] ${status} operation_id ${comp.operation_id || 'NULL'}: ${comp.audit_count} в audit`);
    });

    console.log('\n' + '═'.repeat(60));
    console.log('✅ Проверка завершена!');

  } catch (error) {
    console.error('❌ Ошибка:', error);
    throw error;
  } finally {
    await sql.end();
  }
}

verify().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

