#!/usr/bin/env node

/**
 * Проверка структуры таблицы cars и constraints
 */

import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

async function checkCarsTable() {
  console.log('🔍 Проверка структуры таблицы cars...\n');

  try {
    // Получаем список колонок
    const columns = await sql`
      SELECT 
        column_name,
        data_type,
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_name = 'cars'
      ORDER BY ordinal_position
    `;

    console.log('📋 Колонки таблицы cars:');
    columns.forEach(col => {
      console.log(`   ${col.column_name}: ${col.data_type} ${col.is_nullable === 'NO' ? 'NOT NULL' : 'NULL'} ${col.column_default ? `DEFAULT ${col.column_default}` : ''}`);
    });

    // Получаем constraints
    console.log('\n📌 Constraints:');
    const constraints = await sql`
      SELECT
        con.conname as constraint_name,
        con.contype as constraint_type,
        CASE con.contype
          WHEN 'p' THEN 'PRIMARY KEY'
          WHEN 'u' THEN 'UNIQUE'
          WHEN 'f' THEN 'FOREIGN KEY'
          WHEN 'c' THEN 'CHECK'
          ELSE con.contype::text
        END as type_description,
        pg_get_constraintdef(con.oid) as definition
      FROM pg_constraint con
      JOIN pg_class rel ON rel.oid = con.conrelid
      WHERE rel.relname = 'cars'
      ORDER BY con.contype
    `;

    constraints.forEach(c => {
      console.log(`   ${c.constraint_name} (${c.type_description}):`);
      console.log(`      ${c.definition}`);
    });

    // Получаем индексы
    console.log('\n📊 Индексы:');
    const indexes = await sql`
      SELECT
        indexname,
        indexdef
      FROM pg_indexes
      WHERE tablename = 'cars'
      ORDER BY indexname
    `;

    indexes.forEach(idx => {
      console.log(`   ${idx.indexname}:`);
      console.log(`      ${idx.indexdef}`);
    });

  } catch (error) {
    console.error('\n❌ Ошибка:', error.message);
    throw error;
  } finally {
    await sql.end();
  }
}

checkCarsTable().catch(console.error);

