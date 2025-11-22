import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

async function debugAndTest() {
  const sql = postgres(CONNECTION_STRING, {
    max: 1,
    ssl: { rejectUnauthorized: false }
  });

  try {
    // 1. Проверка констрейнтов
    console.log('🔍 Inspecting constraints on rentprog_car_states_snapshot...\n');

    const constraints = await sql`
      SELECT 
        tc.constraint_name, 
        tc.constraint_type,
        tc.table_schema,
        tc.table_name,
        kcu.column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu 
        ON tc.constraint_name = kcu.constraint_name 
        AND tc.table_schema = kcu.table_schema
      WHERE tc.table_name = 'rentprog_car_states_snapshot'
      ORDER BY tc.constraint_name;
    `;

    console.log('📋 Found Constraints:');
    console.table(constraints);

    // 2. Тест вставки
    console.log('\n🧪 Testing INSERT ... ON CONFLICT ON CONSTRAINT ...');
    
    const testId = 'TEST_CONSTRAINT_CHECK';
    
    try {
      await sql`
        INSERT INTO rentprog_car_states_snapshot (rentprog_id, car_name)
        VALUES (${testId}, 'Test Car')
        ON CONFLICT ON CONSTRAINT rentprog_car_states_snapshot_pkey 
        DO UPDATE SET car_name = EXCLUDED.car_name
      `;
      console.log('✅ Direct INSERT works with ON CONSTRAINT!');
      
      // Clean up
      await sql`DELETE FROM rentprog_car_states_snapshot WHERE rentprog_id = ${testId}`;

    } catch (e) {
      console.log('❌ Direct INSERT failed:', e.message);
    }

    // 3. Тест вставки (simple)
    console.log('\n🧪 Testing INSERT ... ON CONFLICT (rentprog_id) ...');
    
    try {
      await sql`
        INSERT INTO rentprog_car_states_snapshot (rentprog_id, car_name)
        VALUES (${testId}, 'Test Car')
        ON CONFLICT (rentprog_id) 
        DO UPDATE SET car_name = EXCLUDED.car_name
      `;
      console.log('✅ Direct INSERT works with ON CONFLICT (id)!');
      
      // Clean up
      await sql`DELETE FROM rentprog_car_states_snapshot WHERE rentprog_id = ${testId}`;

    } catch (e) {
      console.log('❌ Direct INSERT (simple) failed:', e.message);
    }


  } catch (error) {
    console.error('❌ Global Error:', error);
  } finally {
    await sql.end();
  }
}

debugAndTest();

