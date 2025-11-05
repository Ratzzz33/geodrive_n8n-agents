#!/usr/bin/env node
import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';
const BOOKING_ID = '486033';

async function checkExists() {
  const sql = postgres(CONNECTION_STRING, {
    max: 1,
    ssl: { rejectUnauthorized: false },
  });

  console.log(`\n🔍 Проверка booking ${BOOKING_ID}...\n`);

  try {
    const ref = await sql`
      SELECT entity_id FROM external_refs
      WHERE system = 'rentprog' AND external_id = ${BOOKING_ID};
    `;

    if (ref.length > 0) {
      console.log(`❌ Booking СУЩЕСТВУЕТ в external_refs:`);
      console.log(`   entity_id: ${ref[0].entity_id}`);
    } else {
      console.log(`✅ Booking НЕ найден в external_refs (готов для теста)`);
    }

    console.log();
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

checkExists();


