#!/usr/bin/env node
/**
 * Применение миграции 0045: добавление колонки tbc_return_rate
 */

import postgres from 'postgres';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const CONNECTION_STRING = process.env.DATABASE_URL || 
  'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

async function applyMigration() {
  console.log('Reading migration file...');
  const migrationFile = join(__dirname, 'migrations', '0045_add_tbc_return_rate.sql');
  const migrationSQL = readFileSync(migrationFile, 'utf-8');
  
  console.log('Applying migration to database...\n');
  
  try {
    // Проверяем, существует ли колонка
    console.log('Checking if column already exists...');
    const checkResult = await sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'exchange_rates' 
        AND column_name = 'tbc_return_rate'
    `;
    
    if (checkResult.length > 0) {
      console.log('Column tbc_return_rate already exists. Skipping migration.');
      return;
    }
    
    // Применяем миграцию
    await sql.unsafe(migrationSQL);
    console.log('SUCCESS: Migration applied!\n');
    
    // Проверяем результат
    const verifyResult = await sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'exchange_rates' 
        AND column_name = 'tbc_return_rate'
    `;
    
    if (verifyResult.length > 0) {
      console.log('Verification: Column tbc_return_rate exists');
      console.log(`  Type: ${verifyResult[0].data_type}`);
    } else {
      console.log('WARNING: Column not found after migration!');
    }
    
  } catch (error) {
    console.error('ERROR applying migration:');
    console.error(error.message);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

applyMigration()
  .then(() => {
    console.log('\nDone!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\nFatal error:', error);
    process.exit(1);
  });

