import postgres from 'postgres';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

async function recreateTable() {
  try {
    console.log('1. Dropping old payments table...');
    await sql`DROP TABLE IF EXISTS payments CASCADE`;
    console.log('OK');
    
    console.log('2. Creating new payments table...');
    const sqlFile = path.join(__dirname, 'create_payments_table.sql');
    const migrationSQL = fs.readFileSync(sqlFile, 'utf8');
    await sql.unsafe(migrationSQL);
    console.log('OK');
    
    console.log('3. Verifying...');
    const columns = await sql`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'payments'
      ORDER BY ordinal_position
    `;
    
    console.log('\nNew table structure:');
    columns.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type}`);
    });
    
    console.log('\nSUCCESS: payments table recreated');
    
  } catch (error) {
    console.error('ERROR:', error.message);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

recreateTable();

