#!/usr/bin/env node
import { readFileSync } from 'fs';
import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

async function applyMigration() {
  console.log('📥 Читаю файл миграции 0042...');
  const migration = readFileSync('migrations/0042_fix_null_values_in_dynamic_upsert.sql', 'utf8');
  
  console.log('🔧 Применяю миграцию к БД...');
  await sql.unsafe(migration);
  
  console.log('✅ Миграция применена успешно!');
  
  // Проверяем функцию
  const check = await sql`
    SELECT proname, pg_get_functiondef(oid) as def
    FROM pg_proc
    WHERE proname = 'dynamic_upsert_entity'
      AND pronargs = 3
    ORDER BY oid DESC
    LIMIT 1
  `;
  
  if (check.length > 0) {
    const def = check[0].def;
    if (def.includes('v_value_text IS NULL') || def.includes('v_value_text = \'\'')) {
      console.log('✅ Функция содержит защиту от NULL значений');
    } else {
      console.log('⚠️  Функция не содержит защиту от NULL');
    }
  }
  
  await sql.end();
}

applyMigration()
  .then(() => {
    console.log('\n✅ Готово!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Ошибка:', error.message);
    process.exit(1);
  });

