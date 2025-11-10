#!/usr/bin/env node
/**
 * Деактивация записей цен с season_id = NULL
 */

import { Client } from 'pg';

async function main() {
  const client = new Client({
    connectionString: 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require',
  });

  try {
    await client.connect();
    console.log('🧹 Деактивация записей с season_id = NULL\n');

    const result = await client.query(`
      UPDATE car_prices
      SET active = FALSE,
          updated_at = NOW()
      WHERE season_id IS NULL
        AND active = TRUE
    `);

    console.log(`✅ Деактивировано записей: ${result.rowCount}\n`);

    // Проверяем, что больше нет активных записей с NULL
    const check = await client.query(`
      SELECT COUNT(*) as count
      FROM car_prices
      WHERE season_id IS NULL AND active = TRUE
    `);

    console.log(`📊 Осталось активных записей с NULL: ${check.rows[0].count}`);
    console.log('\n✅ Готово!');

  } catch (error) {
    console.error('❌ Ошибка:', error.message);
  } finally {
    await client.end();
  }
}

main().catch(console.error);

