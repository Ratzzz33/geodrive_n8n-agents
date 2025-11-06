/**
 * Применение миграции для создания таблицы payments
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
    console.log('Applying payments table migration...');
    
    // Читаем SQL файл
    const sqlFile = path.join(__dirname, 'create_payments_table.sql');
    const migrationSQL = fs.readFileSync(sqlFile, 'utf8');
    
    // Выполняем миграцию
    await sql.unsafe(migrationSQL);
    
    console.log('SUCCESS: payments table created');
    
    // Проверяем что таблица создана
    const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name = 'payments'
    `;
    
    if (tables.length > 0) {
      console.log('VERIFIED: payments table exists');
      
      // Получаем структуру таблицы
      const columns = await sql`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'payments'
        ORDER BY ordinal_position
      `;
      
      console.log('\nTable structure:');
      columns.forEach(col => {
        console.log(`  - ${col.column_name}: ${col.data_type} ${col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}`);
      });
    }
    
  } catch (error) {
    console.error('ERROR:', error.message);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

applyMigration();

