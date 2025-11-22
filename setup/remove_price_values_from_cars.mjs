/**
 * Удаление колонки price_values из таблицы cars
 * Цены хранятся в отдельной таблице car_prices
 */

import postgres from 'postgres';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CONNECTION_STRING = process.env.DATABASE_URL || 
  'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

async function removePriceValuesColumn() {
  console.log('🔍 Проверяю наличие колонки price_values в таблице cars...\n');

  try {
    // Проверяем наличие колонки
    const checkResult = await sql`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'public' 
        AND table_name = 'cars' 
        AND column_name = 'price_values'
    `;

    if (checkResult.length === 0) {
      console.log('✅ Колонка price_values не найдена в таблице cars');
      console.log('   Миграция не требуется.\n');
      return;
    }

    console.log(`📋 Найдена колонка: ${checkResult[0].column_name} (${checkResult[0].data_type})`);
    console.log('🗑️  Удаляю колонку price_values...\n');

    // Удаляем колонку
    await sql.unsafe('ALTER TABLE cars DROP COLUMN IF EXISTS price_values');

    // Проверяем результат
    const verifyResult = await sql`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public' 
        AND table_name = 'cars' 
        AND column_name = 'price_values'
    `;

    if (verifyResult.length === 0) {
      console.log('✅ Колонка price_values успешно удалена из таблицы cars');
      console.log('   Цены хранятся в отдельной таблице car_prices\n');
    } else {
      console.log('⚠️  Колонка все еще существует (возможно, ошибка)');
    }

  } catch (error) {
    console.error('❌ Ошибка при удалении колонки:', error.message);
    throw error;
  } finally {
    await sql.end();
  }
}

removePriceValuesColumn()
  .then(() => {
    console.log('✅ Миграция завершена');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Миграция не удалась:', error);
    process.exit(1);
  });

