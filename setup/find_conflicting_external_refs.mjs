#!/usr/bin/env node

/**
 * Find conflicting external_refs
 */

import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const missingIds = [
  '514378', '513772', '511419', '515201', '514480', '514303',
  '514030', '513985', '513928', '512915', '512491', '511974', '511520'
];

async function find() {
  const sql = postgres(CONNECTION_STRING, {
    max: 1,
    ssl: { rejectUnauthorized: false },
    connect_timeout: 10
  });

  try {
    console.log('🔍 Поиск конфликтующих external_refs...\n');

    // Ищем все external_refs с этими ID (любые entity_type)
    const allRefs = await sql`
      SELECT 
        external_id,
        entity_id,
        entity_type,
        system,
        created_at
      FROM external_refs
      WHERE system = 'rentprog'
        AND external_id = ANY(${missingIds})
      ORDER BY external_id, created_at DESC
    `;

    console.log(`Найдено external_refs с этими ID: ${allRefs.length}\n`);

    if (allRefs.length > 0) {
      const byExternalId = {};
      allRefs.forEach(ref => {
        if (!byExternalId[ref.external_id]) {
          byExternalId[ref.external_id] = [];
        }
        byExternalId[ref.external_id].push(ref);
      });

      Object.entries(byExternalId).forEach(([externalId, refs]) => {
        console.log(`📋 External ID "${externalId}": ${refs.length} записей`);
        refs.forEach((ref, idx) => {
          console.log(`   [${idx + 1}] entity_type: ${ref.entity_type}, entity_id: ${ref.entity_id}`);
          console.log(`      created_at: ${ref.created_at}`);
        });
        console.log('');
      });
    } else {
      console.log('❌ Записей не найдено');
    }

    // Проверить брони в bookings
    const bookings = await sql`
      SELECT 
        id,
        rentprog_id,
        branch
      FROM bookings
      WHERE rentprog_id::text = ANY(${missingIds})
      ORDER BY rentprog_id
    `;

    console.log(`\nБроней в bookings: ${bookings.length}`);
    bookings.forEach(b => {
      const refs = allRefs.filter(r => r.external_id === String(b.rentprog_id));
      if (refs.length === 0) {
        console.log(`   #${b.rentprog_id}: UUID=${b.id} - ❌ НЕТ external_refs`);
      } else {
        const bookingRef = refs.find(r => r.entity_type === 'booking' && r.entity_id === b.id);
        if (bookingRef) {
          console.log(`   #${b.rentprog_id}: UUID=${b.id} - ✅ external_refs есть`);
        } else {
          console.log(`   #${b.rentprog_id}: UUID=${b.id} - ❌ external_refs НЕ указывает на этот UUID`);
          refs.forEach(r => {
            console.log(`      Найдено: entity_type=${r.entity_type}, entity_id=${r.entity_id}`);
          });
        }
      }
    });

  } catch (error) {
    console.error('❌ Ошибка:', error);
    throw error;
  } finally {
    await sql.end();
  }
}

find().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

