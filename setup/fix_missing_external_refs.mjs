#!/usr/bin/env node

/**
 * Create missing external_refs for bookings that have rentprog_id but no external_refs
 */

import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

async function fix() {
  const sql = postgres(CONNECTION_STRING, {
    max: 1,
    ssl: { rejectUnauthorized: false },
    connect_timeout: 10
  });

  try {
    console.log('🔧 Создание отсутствующих external_refs для броней...\n');

    // Найти брони с rentprog_id, но без external_refs
    const bookingsWithoutRefs = await sql`
      SELECT 
        b.id,
        b.rentprog_id,
        b.branch,
        b.status,
        b.created_at
      FROM bookings b
      WHERE b.rentprog_id IS NOT NULL
        AND NOT EXISTS (
          SELECT 1
          FROM external_refs er
          WHERE er.entity_type = 'booking'
            AND er.entity_id = b.id
            AND er.system = 'rentprog'
        )
      ORDER BY b.rentprog_id::INTEGER DESC
      LIMIT 100
    `;

    console.log(`Найдено броней без external_refs: ${bookingsWithoutRefs.length}\n`);

    if (bookingsWithoutRefs.length === 0) {
      console.log('✅ Все брони имеют external_refs');
      return;
    }

    // Создать external_refs для каждой брони
    let created = 0;
    let errors = 0;

    for (const booking of bookingsWithoutRefs) {
      try {
        // Проверить, существует ли уже external_ref для этого rentprog_id
        const existing = await sql`
          SELECT id, entity_id
          FROM external_refs
          WHERE entity_type = 'booking'
            AND system = 'rentprog'
            AND external_id = ${booking.rentprog_id}
          LIMIT 1
        `;

        if (existing.length > 0) {
          // Проверить, указывает ли external_ref на правильный booking_id
          if (existing[0].entity_id !== booking.id) {
            // Обновить существующий external_ref на правильный booking_id
            await sql`
              UPDATE external_refs
              SET entity_id = ${booking.id},
                  branch_code = ${booking.branch || 'tbilisi'},
                  updated_at = NOW()
              WHERE id = ${existing[0].id}
            `;
            console.log(`✅ Обновлен external_ref для брони #${booking.rentprog_id} (ID: ${booking.id}, было: ${existing[0].entity_id})`);
          } else {
            console.log(`✅ External_ref уже существует для брони #${booking.rentprog_id} (ID: ${booking.id})`);
          }
        } else {
          // Создать новый external_ref с ON CONFLICT для обновления
          await sql`
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
              ${booking.id},
              'rentprog',
              ${booking.rentprog_id},
              ${booking.branch || 'tbilisi'},
              ${booking.created_at || new Date()},
              NOW()
            )
            ON CONFLICT (system, external_id) 
            DO UPDATE SET 
              entity_id = EXCLUDED.entity_id,
              branch_code = EXCLUDED.branch_code,
              updated_at = NOW()
          `;
          console.log(`✅ Создан/обновлен external_ref для брони #${booking.rentprog_id} (ID: ${booking.id})`);
        }
        created++;
      } catch (error) {
        errors++;
        console.error(`❌ Ошибка при создании external_ref для брони #${booking.rentprog_id}:`, error.message);
      }
    }

    console.log('\n' + '═'.repeat(60));
    console.log('📊 РЕЗУЛЬТАТ:\n');
    console.log(`Обработано: ${bookingsWithoutRefs.length}`);
    console.log(`Создано: ${created}`);
    console.log(`Ошибок: ${errors}`);

    // Проверить результат
    const check = await sql`
      SELECT COUNT(*) as total
      FROM bookings b
      WHERE b.rentprog_id IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM external_refs er
          WHERE er.entity_type = 'booking'
            AND er.entity_id = b.id
            AND er.system = 'rentprog'
        )
    `;

    console.log(`\n✅ Всего броней с external_refs: ${check[0].total}`);

  } catch (error) {
    console.error('❌ Ошибка:', error);
    throw error;
  } finally {
    await sql.end();
  }
}

fix().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

