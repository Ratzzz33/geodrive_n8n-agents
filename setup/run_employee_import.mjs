import postgres from 'postgres';
import { readFileSync } from 'fs';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

try {
  console.log('📋 Applying database migration...');
  
  const migrationSQL = readFileSync('setup/fix_rentprog_employees_unique.sql', 'utf-8');
  
  await sql.unsafe(migrationSQL);
  
  console.log('✅ Migration applied\n');
  
} catch (error) {
  console.error('❌ Migration error:', error.message);
} finally {
  await sql.end();
}

console.log('🚀 Starting employee import...\n');
console.log('Run: npm run build && node dist/services/importEmployees.js');

