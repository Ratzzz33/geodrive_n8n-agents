#!/usr/bin/env node

/**
 * Check format of external_id in external_refs
 */

import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

async function check() {
  const sql = postgres(CONNECTION_STRING, {
    max: 1,
    ssl: { rejectUnauthorized: false },
    connect_timeout: 10
  });

  try {
    console.log('🔍 Проверка формата external_id в external_refs...\n');

    // Получить несколько примеров
    const samples = await sql`
      SELECT 
        external_id,
        pg_typeof(external_id) as type,
        entity_type,
        system
      FROM external_refs
      WHERE system = 'rentprog'
        AND entity_type = 'booking'
      ORDER BY created_at DESC
      LIMIT 10
    `;

    console.log(`Найдено примеров: ${samples.length}\n`);
    samples.forEach(s => {
      console.log(`external_id: "${s.external_id}" (тип: ${s.type})`);
    });

    // Проверить конкретные ID
    const testIds = ['514378', '513772', '511419'];
    console.log(`\nПроверка конкретных ID: ${testIds.join(', ')}`);

    for (const id of testIds) {
      // Как строка
      const asString = await sql`
        SELECT COUNT(*) as count
        FROM external_refs
        WHERE system = 'rentprog'
          AND entity_type = 'booking'
          AND external_id = ${id}
      `;

      // Как число (если возможно)
      const asNumber = await sql`
        SELECT COUNT(*) as count
        FROM external_refs
        WHERE system = 'rentprog'
          AND entity_type = 'booking'
          AND external_id = ${Number(id)}
      `;

      console.log(`\nID "${id}":`);
      console.log(`  Как строка: ${asString[0].count}`);
      console.log(`  Как число: ${asNumber[0].count}`);

      // Попробовать найти через LIKE
      const likeSearch = await sql`
        SELECT external_id, entity_id
        FROM external_refs
        WHERE system = 'rentprog'
          AND entity_type = 'booking'
          AND external_id LIKE ${'%' + id + '%'}
      `;

      if (likeSearch.length > 0) {
        console.log(`  Через LIKE: найдено ${likeSearch.length}`);
        likeSearch.forEach(r => {
          console.log(`    "${r.external_id}" → ${r.entity_id}`);
        });
      }
    }

    // Проверить все external_refs для booking
    const allBookingRefs = await sql`
      SELECT 
        external_id,
        entity_id,
        created_at
      FROM external_refs
      WHERE system = 'rentprog'
        AND entity_type = 'booking'
      ORDER BY created_at DESC
      LIMIT 20
    `;

    console.log(`\nВсего external_refs для booking: ${allBookingRefs.length}`);
    console.log(`Последние 5:`);
    allBookingRefs.slice(0, 5).forEach(r => {
      console.log(`  "${r.external_id}" → ${r.entity_id}`);
    });

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

