#!/usr/bin/env node

/**
 * Fix entity_type from 'bookings' to 'booking' in external_refs
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
    console.log('🔧 Исправление entity_type: bookings → booking...\n');

    // Найти все записи с entity_type = 'bookings'
    const wrongType = await sql`
      SELECT 
        id,
        external_id,
        entity_id,
        entity_type
      FROM external_refs
      WHERE system = 'rentprog'
        AND entity_type = 'bookings'
      ORDER BY external_id
      LIMIT 100
    `;

    console.log(`Найдено записей с entity_type='bookings': ${wrongType.length}\n`);

    if (wrongType.length === 0) {
      console.log('✅ Все записи уже имеют правильный entity_type');
      return;
    }

    // Обновить entity_type на 'booking'
    const updated = await sql`
      UPDATE external_refs
      SET entity_type = 'booking',
          updated_at = NOW()
      WHERE system = 'rentprog'
        AND entity_type = 'bookings'
      RETURNING id, external_id, entity_id
    `;

    console.log(`✅ Обновлено записей: ${updated.length}\n`);

    // Проверить результат
    const check = await sql`
      SELECT COUNT(*) as count
      FROM external_refs
      WHERE system = 'rentprog'
        AND entity_type = 'booking'
    `;

    console.log(`Всего external_refs с entity_type='booking': ${check[0].count}`);

    // Проверить конкретные 13 броней
    const missingIds = [
      '514378', '513772', '511419', '515201', '514480', '514303',
      '514030', '513985', '513928', '512915', '512491', '511974', '511520'
    ];

    const specificCheck = await sql`
      SELECT 
        external_id,
        entity_id,
        entity_type
      FROM external_refs
      WHERE system = 'rentprog'
        AND entity_type = 'booking'
        AND external_id = ANY(${missingIds})
      ORDER BY external_id
    `;

    console.log(`\nПроверка 13 броней: найдено ${specificCheck.length} external_refs`);
    specificCheck.forEach(ref => {
      console.log(`   ✅ #${ref.external_id} → ${ref.entity_id}`);
    });

    if (specificCheck.length === 13) {
      console.log('\n✅ Все 13 броней теперь имеют правильные external_refs!');
    } else {
      console.log(`\n⚠️ Не все брони имеют external_refs (найдено ${specificCheck.length} из 13)`);
    }

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

