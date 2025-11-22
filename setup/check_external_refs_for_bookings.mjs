#!/usr/bin/env node

/**
 * Check external_refs for missing bookings
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
    console.log('🔍 Проверка external_refs для отсутствующих броней...\n');

    // Проверяем наличие броней и их external_refs
    const bookings = await sql`
      SELECT 
        b.id as booking_uuid,
        b.rentprog_id,
        er.external_id as rentprog_id_from_ref,
        er.id as ref_id,
        er.entity_id as ref_entity_id,
        CASE 
          WHEN er.external_id IS NOT NULL THEN '✅'
          ELSE '❌'
        END as has_external_ref
      FROM bookings b
      LEFT JOIN external_refs er ON er.entity_type = 'booking' 
        AND er.entity_id = b.id 
        AND er.system = 'rentprog'
      WHERE er.external_id = ANY(${missingIds})
         OR b.rentprog_id::text = ANY(${missingIds})
      ORDER BY er.external_id, b.rentprog_id
    `;

    console.log(`Найдено броней: ${bookings.length}\n`);

    if (bookings.length === 0) {
      console.log('❌ Брони не найдены в таблице bookings');
      return;
    }

    // Группируем по rentprog_id
    const byRentprogId = {};
    bookings.forEach(b => {
      const rpId = b.rentprog_id_from_ref || String(b.rentprog_id);
      if (!byRentprogId[rpId]) {
        byRentprogId[rpId] = [];
      }
      byRentprogId[rpId].push(b);
    });

    // Проверяем каждую бронь
    const missingRefs = [];
    const hasRefs = [];

    missingIds.forEach(id => {
      const booking = byRentprogId[id];
      if (booking && booking.length > 0) {
        const b = booking[0];
        if (b.rentprog_id_from_ref) {
          hasRefs.push(id);
          console.log(`✅ Бронь #${id}:`);
          console.log(`   UUID: ${b.booking_uuid}`);
          console.log(`   external_refs: ✅ (external_id=${b.rentprog_id_from_ref})`);
          console.log(`   ref_entity_id: ${b.ref_entity_id}`);
          console.log(`   Совпадает с booking.id: ${b.ref_entity_id === b.booking_uuid ? '✅' : '❌'}`);
        } else {
          missingRefs.push(id);
          console.log(`❌ Бронь #${id}:`);
          console.log(`   UUID: ${b.booking_uuid}`);
          console.log(`   rentprog_id в bookings: ${b.rentprog_id || 'NULL'}`);
          console.log(`   external_refs: ❌ ОТСУТСТВУЕТ`);
        }
        console.log('');
      } else {
        console.log(`❌ Бронь #${id}: НЕ найдена в bookings\n`);
      }
    });

    console.log('═'.repeat(60));
    console.log('📊 ИТОГОВЫЙ ВЫВОД:\n');
    console.log(`Всего проверено: ${missingIds.length}`);
    console.log(`С external_refs: ${hasRefs.length}`);
    console.log(`БЕЗ external_refs: ${missingRefs.length}`);

    if (missingRefs.length > 0) {
      console.log('\n❌ Брони БЕЗ external_refs:');
      missingRefs.forEach(id => {
        console.log(`   - #${id}`);
      });
      console.log('\n💡 ПРОБЛЕМА:');
      console.log('   Функция apply_history_changes() ищет брони через external_refs.');
      console.log('   Если external_refs нет, функция возвращает FALSE и операция не обрабатывается.');
      console.log('\n🔧 РЕШЕНИЕ:');
      console.log('   Нужно создать external_refs для этих броней.');
      console.log('   Используйте скрипт fix_missing_external_refs.mjs');
    }

    // Проверяем, есть ли несоответствия между booking.id и ref.entity_id
    const mismatches = bookings.filter(b => 
      b.ref_entity_id && b.booking_uuid && b.ref_entity_id !== b.booking_uuid
    );

    if (mismatches.length > 0) {
      console.log('\n⚠️ НЕСООТВЕТСТВИЯ:');
      mismatches.forEach(b => {
        console.log(`   Бронь #${b.rentprog_id_from_ref || b.rentprog_id}:`);
        console.log(`     booking.id = ${b.booking_uuid}`);
        console.log(`     ref.entity_id = ${b.ref_entity_id}`);
        console.log(`     ❌ НЕ СОВПАДАЮТ!`);
      });
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

