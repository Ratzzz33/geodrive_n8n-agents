#!/usr/bin/env node

/**
 * Direct check of external_refs for booking IDs
 */

import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const missingIds = [
  '514378', '513772', '511419', '515201', '514480', '514303',
  '514030', '513985', '513928', '512915', '512491', '511974', '511520'
];

async function check() {
  const sql = postgres(CONNECTION_STRING, {
    max: 1,
    ssl: { rejectUnauthorized: false },
    connect_timeout: 10
  });

  try {
    console.log('🔍 Прямая проверка external_refs...\n');

    // Проверяем напрямую в external_refs
    const refs = await sql`
      SELECT 
        external_id,
        entity_id,
        entity_type,
        system,
        branch_code
      FROM external_refs
      WHERE system = 'rentprog'
        AND entity_type = 'booking'
        AND external_id = ANY(${missingIds})
      ORDER BY external_id
    `;

    console.log(`Найдено external_refs: ${refs.length}\n`);

    if (refs.length > 0) {
      refs.forEach(ref => {
        console.log(`✅ Бронь #${ref.external_id}:`);
        console.log(`   entity_id: ${ref.entity_id}`);
        console.log(`   branch: ${ref.branch_code || 'NULL'}`);
        console.log('');
      });
    } else {
      console.log('❌ External_refs не найдены');
    }

    // Проверяем, есть ли брони в bookings с этими rentprog_id
    const bookings = await sql`
      SELECT 
        id,
        rentprog_id,
        branch
      FROM bookings
      WHERE rentprog_id::text = ANY(${missingIds})
      ORDER BY rentprog_id
    `;

    console.log(`\nНайдено броней в bookings: ${bookings.length}\n`);

    if (bookings.length > 0) {
      bookings.forEach(b => {
        console.log(`📋 Бронь #${b.rentprog_id}:`);
        console.log(`   UUID: ${b.id}`);
        console.log(`   branch: ${b.branch || 'NULL'}`);
        
        // Проверяем, есть ли external_ref для этого UUID
        const refForBooking = refs.find(r => r.entity_id === b.id);
        if (refForBooking) {
          console.log(`   external_refs: ✅ (external_id=${refForBooking.external_id})`);
        } else {
          console.log(`   external_refs: ❌ ОТСУТСТВУЕТ`);
        }
        console.log('');
      });
    }

    // Итоговый вывод
    console.log('═'.repeat(60));
    console.log('📊 ИТОГОВЫЙ ВЫВОД:\n');
    console.log(`External_refs найдено: ${refs.length} из ${missingIds.length}`);
    console.log(`Броней в bookings: ${bookings.length} из ${missingIds.length}`);

    const foundRefs = new Set(refs.map(r => r.external_id));
    const notFoundRefs = missingIds.filter(id => !foundRefs.has(id));

    if (notFoundRefs.length > 0) {
      console.log(`\n❌ Брони БЕЗ external_refs: ${notFoundRefs.length}`);
      notFoundRefs.forEach(id => {
        console.log(`   - #${id}`);
      });
    } else {
      console.log('\n✅ Все брони имеют external_refs!');
    }

  } catch (error) {
    console.error('❌ Ошибка:', error);
    throw error;
  } finally {
    await sql.end();
  }
}

check().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

