#!/usr/bin/env node

/**
 * Test direct insert into external_refs
 */

import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

async function test() {
  const sql = postgres(CONNECTION_STRING, {
    max: 1,
    ssl: { rejectUnauthorized: false },
    connect_timeout: 10
  });

  try {
    console.log('🔍 Тест создания external_refs...\n');

    // Проверить структуру таблицы
    const tableInfo = await sql`
      SELECT 
        column_name,
        data_type,
        is_nullable
      FROM information_schema.columns
      WHERE table_name = 'external_refs'
        AND column_name IN ('external_id', 'entity_id', 'system', 'entity_type')
      ORDER BY ordinal_position
    `;

    console.log('Структура таблицы external_refs:');
    tableInfo.forEach(col => {
      console.log(`  ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
    });

    // Проверить constraints
    const constraints = await sql`
      SELECT 
        constraint_name,
        constraint_type
      FROM information_schema.table_constraints
      WHERE table_name = 'external_refs'
    `;

    console.log('\nConstraints:');
    constraints.forEach(c => {
      console.log(`  ${c.constraint_name}: ${c.constraint_type}`);
    });

    // Попробовать создать одну запись
    const testBooking = {
      rentprog_id: '514378',
      uuid: '7bdbbbb2-079f-4cd6-90f0-e0117a013809',
      branch: 'tbilisi'
    };

    console.log(`\nПопытка создать external_ref для брони #${testBooking.rentprog_id}...`);

    try {
      const result = await sql`
        INSERT INTO external_refs (
          entity_type,
          entity_id,
          system,
          external_id,
          branch_code,
          created_at,
          updated_at
        )
        VALUES (
          'booking',
          ${testBooking.uuid}::uuid,
          'rentprog',
          ${testBooking.rentprog_id},
          ${testBooking.branch},
          NOW(),
          NOW()
        )
        ON CONFLICT (system, external_id) 
        DO UPDATE SET 
          entity_id = EXCLUDED.entity_id,
          branch_code = EXCLUDED.branch_code,
          updated_at = NOW()
        RETURNING id, external_id, entity_id
      `;

      console.log(`✅ Создано:`, result[0]);
    } catch (error) {
      console.error(`❌ Ошибка:`, error.message);
      console.error(`   Детали:`, error);
    }

    // Проверить, что запись создана
    const check = await sql`
      SELECT 
        id,
        external_id,
        entity_id,
        system,
        entity_type
      FROM external_refs
      WHERE system = 'rentprog'
        AND entity_type = 'booking'
        AND external_id = ${testBooking.rentprog_id}
    `;

    console.log(`\nПроверка: найдено ${check.length} записей`);
    if (check.length > 0) {
      console.log(`  ID: ${check[0].id}`);
      console.log(`  external_id: ${check[0].external_id} (тип: ${typeof check[0].external_id})`);
      console.log(`  entity_id: ${check[0].entity_id}`);
    }

  } catch (error) {
    console.error('❌ Ошибка:', error);
    throw error;
  } finally {
    await sql.end();
  }
}

test().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

