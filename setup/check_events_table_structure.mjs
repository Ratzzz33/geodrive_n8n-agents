/**
 * Проверка структуры таблицы events
 */

import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

async function checkEventsTable() {
  const sql = postgres(CONNECTION_STRING, {
    max: 1,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('🔍 Проверка структуры таблицы events\n');

    // 1. Структура таблицы
    console.log('1️⃣ Текущие колонки:');
    const columns = await sql`
      SELECT 
        column_name,
        data_type,
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_name = 'events'
      ORDER BY ordinal_position
    `;

    columns.forEach(col => {
      console.log(`   ${col.column_name.padEnd(20)} ${col.data_type.padEnd(30)} ${col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}`);
    });
    console.log('');

    // 2. Индексы
    console.log('2️⃣ Индексы:');
    const indexes = await sql`
      SELECT 
        indexname,
        indexdef
      FROM pg_indexes
      WHERE tablename = 'events'
    `;

    indexes.forEach(idx => {
      console.log(`   ${idx.indexname}`);
    });
    console.log('');

    // 3. Проверка наличия новых колонок
    console.log('3️⃣ Проверка execution_id и execution_url:');
    const hasExecutionId = columns.find(c => c.column_name === 'execution_id');
    const hasExecutionUrl = columns.find(c => c.column_name === 'execution_url');

    if (hasExecutionId) {
      console.log('   ✅ execution_id уже существует');
    } else {
      console.log('   ❌ execution_id НЕ существует (нужно добавить)');
    }

    if (hasExecutionUrl) {
      console.log('   ✅ execution_url уже существует');
    } else {
      console.log('   ❌ execution_url НЕ существует (нужно добавить)');
    }
    console.log('');

    // 4. Пример последних событий
    console.log('4️⃣ Последние 5 событий:');
    const recentEvents = await sql`
      SELECT 
        id,
        ts,
        branch,
        type,
        ext_id,
        processed,
        ok
      FROM events
      ORDER BY id DESC
      LIMIT 5
    `;

    recentEvents.forEach(evt => {
      console.log(`   ID: ${evt.id}, Branch: ${evt.branch}, Type: ${evt.type}, ExtID: ${evt.ext_id}`);
      console.log(`      Processed: ${evt.processed}, OK: ${evt.ok}`);
    });

  } finally {
    await sql.end();
  }
}

checkEventsTable().catch(console.error);


