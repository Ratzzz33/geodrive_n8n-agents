#!/usr/bin/env node
import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 10,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  console.log('🔍 Проверка структуры таблицы employees\n');

  try {
    // Проверяем какие колонки есть
    const columns = await sql`
      SELECT 
        column_name,
        data_type,
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_name = 'employees'
      ORDER BY ordinal_position
    `;

    console.log('📊 Текущие колонки:');
    columns.forEach(col => {
      console.log(`   - ${col.column_name} (${col.data_type})`);
    });

    // Проверяем constraints
    const constraints = await sql`
      SELECT
        constraint_name,
        constraint_type
      FROM information_schema.table_constraints
      WHERE table_name = 'employees'
    `;

    console.log('\n🔒 Constraints:');
    constraints.forEach(c => {
      console.log(`   - ${c.constraint_name} (${c.constraint_type})`);
    });

  } catch (error) {
    console.error('❌ Ошибка:', error.message);
  } finally {
    await sql.end();
  }
}

main().catch(console.error);

