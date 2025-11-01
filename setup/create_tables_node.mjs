/**
 * Скрипт для создания таблиц n8n в Neon PostgreSQL
 */

import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const { Client } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CONNECTION_STRING = process.env.DATABASE_URL || 
  'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech:5432/neondb?sslmode=require';

async function createTables() {
  const client = new Client({
    connectionString: CONNECTION_STRING,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✅ Подключено к Neon PostgreSQL');

    // Читаем SQL файл
    const sqlFile = path.join(__dirname, 'create_n8n_tables.sql');
    const sql = fs.readFileSync(sqlFile, 'utf8');

    // Выполняем SQL
    console.log('📝 Выполняю SQL...');
    await client.query(sql);

    console.log('✅ Таблицы успешно созданы!');
    console.log('   - events');
    console.log('   - sync_runs');
    console.log('   - health');

    // Проверяем создание таблиц
    const result = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('events', 'sync_runs', 'health')
      ORDER BY table_name;
    `);

    console.log('\n📊 Созданные таблицы:');
    result.rows.forEach(row => {
      console.log(`   ✓ ${row.table_name}`);
    });

  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    if (error.code === '42P07') {
      console.log('⚠️  Таблицы уже существуют (это нормально)');
    } else {
      process.exit(1);
    }
  } finally {
    await client.end();
  }
}

createTables();

