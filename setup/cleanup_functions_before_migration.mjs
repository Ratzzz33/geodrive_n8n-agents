#!/usr/bin/env node
/**
 * Очистка старых версий функций перед применением миграции 0041
 */

import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

async function cleanupFunctions() {
  console.log('🧹 Очистка старых версий функций...\n');
  
  try {
    // Получаем все версии функции apply_history_changes
    const functions = await sql`
      SELECT 
        proname,
        pg_get_function_identity_arguments(oid) as args
      FROM pg_proc
      WHERE proname = 'apply_history_changes'
    `;
    
    console.log(`Найдено версий функции apply_history_changes: ${functions.length}`);
    
    for (const func of functions) {
      console.log(`  Удаляю: ${func.proname}(${func.args})`);
      try {
        await sql.unsafe(`DROP FUNCTION IF EXISTS ${func.proname}(${func.args}) CASCADE`);
        console.log(`    ✅ Удалено`);
      } catch (error) {
        console.log(`    ⚠️  Ошибка: ${error.message}`);
      }
    }
    
    console.log('\n✅ Очистка завершена!');
    
  } catch (error) {
    console.error('❌ Ошибка при очистке:', error.message);
    throw error;
  } finally {
    await sql.end();
  }
}

cleanupFunctions()
  .then(() => {
    console.log('\n✅ Готово!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Критическая ошибка:', error.message);
    process.exit(1);
  });

