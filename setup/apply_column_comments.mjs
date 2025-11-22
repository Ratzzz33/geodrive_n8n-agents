#!/usr/bin/env node
import postgres from 'postgres';
import { readFileSync } from 'fs';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

console.log('\n🚀 Применение миграции: Русские описания полей\n');
console.log('=' .repeat(80));

try {
  // Читаем SQL файл
  const script = readFileSync('setup/add_column_comments.sql', 'utf8');
  
  console.log('\n📝 Выполняем SQL скрипт...\n');
  
  // Выполняем весь скрипт
  await sql.unsafe(script);
  
  console.log('✅ Миграция успешно применена!\n');
  
  // Проверяем результат - выводим примеры описаний
  console.log('=' .repeat(80));
  console.log('\n📋 ПРОВЕРКА: Примеры описаний полей\n');
  
  const carsComments = await sql`
    SELECT 
      cols.column_name,
      pgd.description AS column_description
    FROM pg_catalog.pg_statio_all_tables st
    INNER JOIN pg_catalog.pg_description pgd ON (pgd.objoid = st.relid)
    INNER JOIN information_schema.columns cols ON (
      cols.table_name = st.relname
      AND pgd.objsubid = cols.ordinal_position
    )
    WHERE st.relname = 'cars'
    ORDER BY cols.ordinal_position
    LIMIT 10
  `;
  
  console.log('Таблица: cars (первые 10 полей)\n');
  carsComments.forEach(row => {
    console.log(`  ${row.column_name.padEnd(30)} → ${row.column_description}`);
  });
  
  const bookingsComments = await sql`
    SELECT 
      cols.column_name,
      pgd.description AS column_description
    FROM pg_catalog.pg_statio_all_tables st
    INNER JOIN pg_catalog.pg_description pgd ON (pgd.objoid = st.relid)
    INNER JOIN information_schema.columns cols ON (
      cols.table_name = st.relname
      AND pgd.objsubid = cols.ordinal_position
    )
    WHERE st.relname = 'bookings'
    ORDER BY cols.ordinal_position
    LIMIT 10
  `;
  
  console.log('\n\nТаблица: bookings (первые 10 полей)\n');
  bookingsComments.forEach(row => {
    console.log(`  ${row.column_name.padEnd(30)} → ${row.column_description}`);
  });
  
  // Подсчет общего количества описаний
  const totalComments = await sql`
    SELECT 
      st.relname as table_name,
      COUNT(*) as comments_count
    FROM pg_catalog.pg_statio_all_tables st
    INNER JOIN pg_catalog.pg_description pgd ON (pgd.objoid = st.relid)
    INNER JOIN information_schema.columns cols ON (
      cols.table_name = st.relname
      AND pgd.objsubid = cols.ordinal_position
    )
    WHERE st.relname IN ('cars', 'bookings', 'clients', 'branches', 'payments', 'events', 'external_refs')
    GROUP BY st.relname
    ORDER BY st.relname
  `;
  
  console.log('\n\n=' .repeat(80));
  console.log('\n📊 СТАТИСТИКА:\n');
  totalComments.forEach(row => {
    console.log(`  ${row.table_name.padEnd(20)} → ${row.comments_count} полей с описаниями`);
  });
  
  console.log('\n✅ Теперь AI агенты могут использовать русские описания полей!\n');
  console.log('=' .repeat(80));
  console.log('\n');
  
} catch (error) {
  console.error('\n❌ Ошибка при применении миграции:\n');
  console.error(error.message);
  console.error('\n');
  process.exit(1);
} finally {
  await sql.end();
}

