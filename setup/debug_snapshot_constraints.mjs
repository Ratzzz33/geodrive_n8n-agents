import { createPostgresClient } from '../src/utils/db.mjs';

async function debugConstraints() {
  const sql = await createPostgresClient();
  try {
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

    // Также проверим индексы
    const indexes = await sql`
      SELECT
        indexname,
        indexdef
      FROM pg_indexes
      WHERE tablename = 'rentprog_car_states_snapshot';
    `;

    console.log('\n📋 Found Indexes:');
    indexes.forEach(idx => {
      console.log(`- ${idx.indexname}: ${idx.indexdef}`);
    });

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await sql.end();
  }
}

debugConstraints();

