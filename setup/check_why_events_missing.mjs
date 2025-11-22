#!/usr/bin/env node

/**
 * Check why booking events might not be visible
 * Check if they exist but with different timestamps or in different format
 */

import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

async function checkWhyMissing() {
  const sql = postgres(CONNECTION_STRING, {
    max: 1,
    ssl: { rejectUnauthorized: false },
    connect_timeout: 10
  });

  try {
    console.log('🔍 Анализ: почему события могут не сохраняться...\n');

    // Check constraint mismatch
    console.log('1️⃣ Проверка constraint в БД vs workflow:\n');
    const constraints = await sql`
      SELECT 
        conname as constraint_name,
        pg_get_constraintdef(oid) as constraint_def
      FROM pg_constraint
      WHERE conrelid = 'history'::regclass
        AND contype = 'u'
    `;

    console.log('Уникальные ограничения в БД:');
    constraints.forEach(con => {
      console.log(`  ${con.constraint_name}: ${con.constraint_def}`);
    });

    // Check workflow SQL
    console.log('\n2️⃣ SQL в workflow использует:\n');
    console.log('  ON CONFLICT (branch, operation_type, created_at, entity_id)');
    console.log('\n⚠️ ПРОБЛЕМА: Несоответствие!');
    console.log('   БД имеет: UNIQUE (branch, operation_id)');
    console.log('   Workflow использует: (branch, operation_type, created_at, entity_id)');
    console.log('   Это может приводить к ошибкам при сохранении!\n');

    // Check recent booking events
    console.log('3️⃣ Проверка последних событий о бронях:\n');
    const recentBookings = await sql`
      SELECT 
        id,
        created_at,
        operation_id,
        description,
        user_name,
        entity_id
      FROM history
      WHERE entity_type = 'booking'
        AND created_at >= NOW() - INTERVAL '24 hours'
      ORDER BY created_at DESC
      LIMIT 20
    `;

    console.log(`Найдено событий о бронях за последние 24 часа: ${recentBookings.length}\n`);

    if (recentBookings.length > 0) {
      console.log('Последние события:');
      recentBookings.forEach((record, idx) => {
        console.log(`\n  [${idx + 1}] ID: ${record.id}`);
        console.log(`      Время: ${record.created_at.toISOString()}`);
        console.log(`      operation_id: ${record.operation_id || 'NULL'}`);
        console.log(`      user_name: ${record.user_name || 'NULL'}`);
        console.log(`      entity_id: ${record.entity_id || 'NULL'}`);
        console.log(`      Описание: ${(record.description || '').substring(0, 80)}...`);
      });
    }

    // Check for duplicates
    console.log('\n4️⃣ Проверка дубликатов (по operation_id):\n');
    const duplicates = await sql`
      SELECT 
        branch,
        operation_id,
        COUNT(*) as count
      FROM history
      WHERE operation_id IS NOT NULL
        AND created_at >= NOW() - INTERVAL '24 hours'
      GROUP BY branch, operation_id
      HAVING COUNT(*) > 1
      ORDER BY count DESC
      LIMIT 10
    `;

    if (duplicates.length > 0) {
      console.log('Найдено дубликатов:');
      duplicates.forEach(dup => {
        console.log(`  ${dup.branch} / operation_id ${dup.operation_id}: ${dup.count} записей`);
      });
    } else {
      console.log('✅ Дубликатов не найдено (constraint работает)');
    }

    // Check events without operation_id
    console.log('\n5️⃣ События БЕЗ operation_id (могут не сохраняться из-за constraint):\n');
    const withoutOpId = await sql`
      SELECT COUNT(*) as count
      FROM history
      WHERE operation_id IS NULL
        AND created_at >= NOW() - INTERVAL '24 hours'
    `;

    console.log(`Событий без operation_id за 24 часа: ${withoutOpId[0].count}`);

    if (parseInt(withoutOpId[0].count) > 0) {
      const samples = await sql`
        SELECT 
          id,
          description,
          entity_type,
          entity_id
        FROM history
        WHERE operation_id IS NULL
          AND created_at >= NOW() - INTERVAL '24 hours'
        ORDER BY created_at DESC
        LIMIT 5
      `;

      console.log('\nПримеры:');
      samples.forEach(sample => {
        console.log(`  ID: ${sample.id} | ${sample.entity_type} / ${sample.entity_id}`);
        console.log(`    ${(sample.description || '').substring(0, 70)}...`);
      });
    }

  } catch (error) {
    console.error('❌ Ошибка:', error);
    throw error;
  } finally {
    await sql.end();
  }
}

checkWhyMissing().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

