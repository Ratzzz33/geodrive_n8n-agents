#!/usr/bin/env node

/**
 * Create external_refs for 13 specific bookings
 */

import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const bookingIds = [
  { rentprog_id: '514378', uuid: '7bdbbbb2-079f-4cd6-90f0-e0117a013809', branch: 'tbilisi' },
  { rentprog_id: '513772', uuid: 'fa2c4ba0-5e0b-4940-a1e3-9246432ea697', branch: 'tbilisi' },
  { rentprog_id: '511419', uuid: 'a455d71a-4333-4af8-b292-c7a500c29ebc', branch: 'tbilisi' },
  { rentprog_id: '515201', uuid: '3571fa6e-d637-421c-8e2f-3d70cec4c192', branch: 'tbilisi' },
  { rentprog_id: '514480', uuid: '7814b271-3be8-4863-811f-3cfcdcfec9d6', branch: 'tbilisi' },
  { rentprog_id: '514303', uuid: '9f3e27d1-87c2-4877-9d40-cf663a188d1a', branch: 'tbilisi' },
  { rentprog_id: '514030', uuid: '990d69f0-9649-4a1e-a67e-5fc4ea6e4cc2', branch: 'tbilisi' },
  { rentprog_id: '513985', uuid: '2fceda7d-3b60-493f-962a-d465b21e2278', branch: 'tbilisi' },
  { rentprog_id: '513928', uuid: '691f135b-d9b3-49be-a168-d1fb258f1f10', branch: 'tbilisi' },
  { rentprog_id: '512915', uuid: '26182ba6-ff8f-4d98-8bea-e03d412e0868', branch: 'tbilisi' },
  { rentprog_id: '512491', uuid: '5fd00dc2-a644-43d7-8875-255af86da503', branch: 'tbilisi' },
  { rentprog_id: '511974', uuid: '4ace7869-be0a-4ef7-8da1-43465ac0ed39', branch: 'tbilisi' },
  { rentprog_id: '511520', uuid: '342c8df4-d843-4bc4-99d0-5eca9d7267f3', branch: 'tbilisi' }
];

async function create() {
  const sql = postgres(CONNECTION_STRING, {
    max: 1,
    ssl: { rejectUnauthorized: false },
    connect_timeout: 10
  });

  try {
    console.log('🔧 Создание external_refs для 13 броней...\n');

    let created = 0;
    let updated = 0;
    let errors = 0;

    for (const booking of bookingIds) {
      try {
        // Проверить существование
        const existing = await sql`
          SELECT id, entity_id
          FROM external_refs
          WHERE system = 'rentprog'
            AND entity_type = 'booking'
            AND external_id = ${booking.rentprog_id}
          LIMIT 1
        `;

        if (existing.length > 0) {
          // Обновить если entity_id не совпадает
          if (existing[0].entity_id !== booking.uuid) {
            await sql`
              UPDATE external_refs
              SET entity_id = ${booking.uuid}::uuid,
                  branch_code = ${booking.branch},
                  updated_at = NOW()
              WHERE id = ${existing[0].id}
            `;
            updated++;
            console.log(`✅ Обновлен external_ref для брони #${booking.rentprog_id}`);
          } else {
            console.log(`✅ External_ref уже существует для брони #${booking.rentprog_id}`);
          }
        } else {
          // Создать новый
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
              ${booking.uuid}::uuid,
              'rentprog',
              ${booking.rentprog_id},
              ${booking.branch},
              NOW(),
              NOW()
            )
            ON CONFLICT (system, external_id) 
            DO UPDATE SET 
              entity_id = EXCLUDED.entity_id,
              branch_code = EXCLUDED.branch_code,
              updated_at = NOW()
          `;
          created++;
          console.log(`✅ Создан external_ref для брони #${booking.rentprog_id}`);
        }
      } catch (error) {
        errors++;
        console.error(`❌ Ошибка для брони #${booking.rentprog_id}:`, error.message);
      }
    }

    console.log('\n' + '═'.repeat(60));
    console.log('📊 РЕЗУЛЬТАТ:\n');
    console.log(`Создано: ${created}`);
    console.log(`Обновлено: ${updated}`);
    console.log(`Ошибок: ${errors}`);

    // Проверить результат
    const check = await sql`
      SELECT external_id, entity_id
      FROM external_refs
      WHERE system = 'rentprog'
        AND entity_type = 'booking'
        AND external_id = ANY(${bookingIds.map(b => b.rentprog_id)})
      ORDER BY external_id
    `;

    console.log(`\n✅ Проверка: найдено ${check.length} external_refs`);
    check.forEach(ref => {
      console.log(`   #${ref.external_id} → ${ref.entity_id}`);
    });

  } catch (error) {
    console.error('❌ Ошибка:', error);
    throw error;
  } finally {
    await sql.end();
  }
}

create().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

