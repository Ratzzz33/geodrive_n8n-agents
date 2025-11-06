/**
 * Применение миграции для расширения таблицы payments
 */

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

async function applyMigration() {
  try {
    console.log('Applying payment fields migration...');
    
    // Читаем SQL файл
    const sqlFile = path.join(__dirname, 'add_payment_fields_migration.sql');
    const migrationSQL = fs.readFileSync(sqlFile, 'utf8');
    
    // Выполняем миграцию
    await sql.unsafe(migrationSQL);
    
    console.log('SUCCESS: Payment fields migration applied');
    
    // Проверяем что новые поля добавлены
    const columns = await sql`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'payments'
        AND column_name IN (
          'rp_payment_id', 'rp_car_id', 'car_code', 
          'has_check', 'exchange_rate', 'rated_amount'
        )
      ORDER BY column_name
    `;
    
    console.log('\nNew fields added:');
    columns.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type} ${col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}`);
    });
    
    // Проверяем индексы
    const indexes = await sql`
      SELECT indexname
      FROM pg_indexes
      WHERE tablename = 'payments'
        AND indexname LIKE 'idx_payments_rp%'
      ORDER BY indexname
    `;
    
    console.log('\nNew indexes:');
    indexes.forEach(idx => {
      console.log(`  - ${idx.indexname}`);
    });
    
  } catch (error) {
    console.error('ERROR:', error.message);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

applyMigration();

