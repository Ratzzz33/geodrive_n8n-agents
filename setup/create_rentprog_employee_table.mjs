import postgres from 'postgres';
import { readFileSync } from 'fs';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

try {
  console.log('Creating rentprog_employee table...');
  
  const migrationSQL = readFileSync('setup/create_rentprog_employee_table.sql', 'utf-8');
  
  await sql.unsafe(migrationSQL);
  
  console.log('✅ Table created successfully');
  
  // Проверяем
  const result = await sql`SELECT COUNT(*) as count FROM rentprog_employee`;
  console.log(`Records count: ${result[0].count}`);
  
} catch (error) {
  console.error('❌ Error:', error.message);
} finally {
  await sql.end();
}

