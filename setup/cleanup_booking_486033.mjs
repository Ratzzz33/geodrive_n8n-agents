import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';
const BOOKING_ID = '486033';
const COMPANY_ID = 11163;

async function cleanupBooking() {
  const sql = postgres(CONNECTION_STRING, {
    max: 1,
    ssl: { rejectUnauthorized: false },
  });

  console.log(`\n🧹 Удаление booking ID ${BOOKING_ID}...\n`);

  try {
    // 1. Найти entity_id в external_refs
    const externalRef = await sql`
      SELECT entity_id FROM external_refs
      WHERE system = 'rentprog' AND external_id = ${BOOKING_ID};
    `;

    let entityId = null;
    if (externalRef.length > 0) {
      entityId = externalRef[0].entity_id;
      console.log(`✓ Найден entity_id: ${entityId}`);

      // 2. Удалить из bookings
      await sql`
        DELETE FROM bookings WHERE id = ${entityId};
      `;
      console.log(`✓ Удалено из bookings: ${entityId}`);

      // 3. Удалить из external_refs
      await sql`
        DELETE FROM external_refs WHERE entity_id = ${entityId};
      `;
      console.log(`✓ Удалено из external_refs: ${entityId}`);
    } else {
      console.log(`ℹ️  Booking ${BOOKING_ID} не найден в БД`);
    }

    // 4. Удалить события
    const { count: eventsDeleted } = await sql`
      DELETE FROM events WHERE company_id = ${COMPANY_ID} AND rentprog_id = ${BOOKING_ID};
    `;
    console.log(`✓ Удалено событий: ${eventsDeleted}`);

    console.log('\n✅ Очистка завершена! Можно тестировать.\n');
  } catch (error) {
    console.error('❌ Ошибка при очистке БД:', error.message);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

cleanupBooking();

