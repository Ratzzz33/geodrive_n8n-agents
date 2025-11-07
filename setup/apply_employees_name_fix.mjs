import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

try {
  console.log('📋 Applying migration: allow NULL in employees.name...');
  
  await sql.unsafe('ALTER TABLE employees ALTER COLUMN name DROP NOT NULL');
  
  console.log('✅ Migration applied successfully!\n');
  
} catch (error) {
  console.error('❌ Migration error:', error.message);
} finally {
  await sql.end();
}

