#!/usr/bin/env node

/**
 * Test: Reprocess history record 624721 to apply car_class change
 */

import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

async function testReprocess() {
  const sql = postgres(CONNECTION_STRING, {
    max: 1,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('🔄 Resetting processed flag for record 624721...\n');

    // Reset processed flag - this will trigger auto_process_history_trigger
    await sql`
      UPDATE history
      SET processed = FALSE, notes = NULL
      WHERE id = 624721
    `;

    console.log('✅ Reset done. Waiting 2 seconds for trigger to fire...\n');
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Check the record after processing
    const history = await sql`
      SELECT id, processed, notes, entity_type, entity_id
      FROM history
      WHERE id = 624721
    `;

    console.log('📜 History record after trigger:');
    console.log(`  ID: ${history[0].id}`);
    console.log(`  Entity Type: ${history[0].entity_type}`);
    console.log(`  Entity ID: ${history[0].entity_id}`);
    console.log(`  Processed: ${history[0].processed}`);
    console.log(`  Notes: ${history[0].notes || 'NULL'}`);

    // Check car_class in cars table
    console.log('\n🚗 Checking car 39736 in cars table...');
    
    const externalRef = await sql`
      SELECT entity_id
      FROM external_refs
      WHERE system = 'rentprog'
        AND entity_type = 'car'
        AND external_id = '39736'
      LIMIT 1
    `;

    if (externalRef.length === 0) {
      console.log('❌ Car 39736 not found in external_refs');
      return;
    }

    const carUuid = externalRef[0].entity_id;
    
    const car = await sql`
      SELECT 
        rentprog_id,
        data->>'car_class' as car_class,
        updated_at
      FROM cars
      WHERE id = ${carUuid}
    `;

    if (car.length === 0) {
      console.log('❌ Car not found in cars table');
      return;
    }

    console.log(`\n  RentProg ID: ${car[0].rentprog_id}`);
    console.log(`  car_class: ${car[0].car_class}`);
    console.log(`  Last updated: ${car[0].updated_at}`);

    if (car[0].car_class === 'Эконом') {
      console.log('\n✅ SUCCESS! car_class был успешно изменён с "Средний" на "Эконом"');
    } else if (car[0].car_class === 'Средний') {
      console.log('\n❌ FAILED! car_class всё ещё "Средний" (должен быть "Эконом")');
      console.log('   Проверьте notes в history record для деталей.');
    } else {
      console.log(`\n⚠️ UNEXPECTED! car_class = "${car[0].car_class}" (ожидалось "Эконом")`);
    }

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await sql.end();
  }
}

testReprocess().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

