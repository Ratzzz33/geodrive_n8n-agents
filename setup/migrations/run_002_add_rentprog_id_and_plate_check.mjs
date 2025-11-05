import { Client } from 'pg';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

async function main() {
  console.log('🚀 Запуск миграции 002: rentprog_id + CHECK по plate');
  const client = new Client({ connectionString: CONNECTION_STRING, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    const sqlPath = path.join(__dirname, '002_add_rentprog_id_and_plate_check.sql');
    const sql = await fs.readFile(sqlPath, 'utf8');
    await client.query(sql);
    console.log('✅ Миграция выполнена');
  } catch (e) {
    console.error('❌ Ошибка миграции:', e.message);
    throw e;
  } finally {
    await client.end();
  }
}

main().catch(console.error);


