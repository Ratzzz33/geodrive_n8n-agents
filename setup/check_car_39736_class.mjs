#!/usr/bin/env node

/**
 * Check car_class value for car 39736 in cars table
 */

import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

async function checkCarClass() {
  const sql = postgres(CONNECTION_STRING, {
    max: 1,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('🚗 Checking car_class for car 39736...\n');

    // Find car by rentprog_id via external_refs
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
    console.log(`Internal UUID: ${carUuid}\n`);

    // Get car data
    const car = await sql`
      SELECT 
        id,
        rentprog_id,
        data->>'car_class' as car_class_from_data,
        data,
        updated_at
      FROM cars
      WHERE id = ${carUuid}
    `;

    if (car.length === 0) {
      console.log('❌ Car not found in cars table');
      return;
    }

    const carData = car[0];
    console.log('Car data:');
    console.log(`  RentProg ID: ${carData.rentprog_id}`);
    console.log(`  car_class (from data field): ${carData.car_class_from_data}`);
    console.log(`  Last updated: ${carData.updated_at}`);
    
    if (carData.data && typeof carData.data === 'object') {
      console.log('\nFull data field:');
      console.log(JSON.stringify(carData.data, null, 2));
    }

    // Check history log for this car
    const historyLog = await sql`
      SELECT 
        id,
        ts,
        operation_type,
        description,
        processed,
        raw_data
      FROM history
      WHERE description ILIKE '%39736%'
        AND description ILIKE '%car_class%'
      ORDER BY created_at DESC
      LIMIT 3
    `;

    console.log('\n📜 Related history records:');
    historyLog.forEach((record, idx) => {
      console.log(`\n  [${idx + 1}] ID: ${record.id}`);
      console.log(`      Time: ${record.ts}`);
      console.log(`      Type: ${record.operation_type}`);
      console.log(`      Processed: ${record.processed}`);
      console.log(`      Description: ${record.description.substring(0, 100)}...`);
      if (record.raw_data && typeof record.raw_data === 'object') {
        const rawData = record.raw_data;
        if (rawData.car_class) {
          console.log(`      Raw data car_class: ${rawData.car_class}`);
        }
      }
    });

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await sql.end();
  }
}

checkCarClass().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

