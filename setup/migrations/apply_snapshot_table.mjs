import postgres from 'postgres';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

async function applyMigration() {
  try {
    console.log('🔄 Applying migration: create_rentprog_car_states_snapshot...');
    
    const migrationSQL = readFileSync(
      join(__dirname, 'create_rentprog_car_states_snapshot.sql'),
      'utf-8'
    );
    
    await sql.unsafe(migrationSQL);
    
    console.log('✅ Table rentprog_car_states_snapshot created successfully');
    
    // Проверяем что таблица создалась
    const result = await sql`
      SELECT COUNT(*) as count 
      FROM information_schema.tables 
      WHERE table_name = 'rentprog_car_states_snapshot'
    `;
    
    console.log(`✅ Table exists: ${result[0].count > 0}`);
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    throw error;
  } finally {
    await sql.end();
  }
}

applyMigration();

