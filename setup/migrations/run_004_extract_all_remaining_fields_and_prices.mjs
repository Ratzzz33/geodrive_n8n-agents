import { Client } from 'pg';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

async function main() {
  console.log('🚀 Запуск миграции 004: недостающие поля и car_prices');
  const client = new Client({ connectionString: CONNECTION_STRING, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    const sqlPath = path.join(__dirname, '004_extract_all_remaining_fields_and_prices.sql');
    const sql = await fs.readFile(sqlPath, 'utf8');
    await client.query(sql);
    console.log('✅ Миграция 004 выполнена');
  } catch (e) {
    console.error('❌ Ошибка миграции 004:', e.message);
    throw e;
  } finally {
    await client.end();
  }
}

main().catch(console.error);


