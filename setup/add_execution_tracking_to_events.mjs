/**
 * Добавление колонок для отслеживания N8N executions в таблицу events
 */

import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

async function addExecutionTracking() {
  const sql = postgres(CONNECTION_STRING, {
    max: 1,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('🔧 Добавление отслеживания N8N executions в таблицу events\n');

    // 1. Добавляем execution_id
    console.log('1️⃣ Добавление колонки execution_id...');
    await sql`
      ALTER TABLE events 
      ADD COLUMN IF NOT EXISTS execution_id TEXT
    `;
    console.log('   ✓ execution_id добавлен\n');

    // 2. Добавляем execution_url
    console.log('2️⃣ Добавление колонки execution_url...');
    await sql`
      ALTER TABLE events 
      ADD COLUMN IF NOT EXISTS execution_url TEXT
    `;
    console.log('   ✓ execution_url добавлен\n');

    // 3. Добавляем индекс для execution_id
    console.log('3️⃣ Добавление индекса для execution_id...');
    await sql`
      CREATE INDEX IF NOT EXISTS idx_events_execution_id 
      ON events(execution_id)
    `;
    console.log('   ✓ Индекс создан\n');

    // 4. Проверяем структуру
    console.log('4️⃣ Проверка новых колонок:');
    const columns = await sql`
      SELECT 
        column_name,
        data_type,
        is_nullable
      FROM information_schema.columns
      WHERE table_name = 'events'
      AND column_name IN ('execution_id', 'execution_url')
    `;

    columns.forEach(col => {
      console.log(`   ✅ ${col.column_name} (${col.data_type})`);
    });
    console.log('');

    // 5. Пример использования
    console.log('5️⃣ Тестовая вставка:');
    const testResult = await sql`
      INSERT INTO events (
        type,
        ext_id,
        execution_id,
        execution_url,
        ok
      ) VALUES (
        'test.execution.tracking',
        'test_123',
        '3902',
        'https://n8n.rentflow.rentals/workflow/PbDKuU06H7s2Oem8/executions/3902',
        true
      )
      RETURNING id, execution_id, execution_url
    `;

    console.log('   ✅ Тестовое событие создано:');
    console.log('      ID:', testResult[0].id);
    console.log('      execution_id:', testResult[0].execution_id);
    console.log('      execution_url:', testResult[0].execution_url);
    console.log('');

    // Удаляем тестовое событие
    await sql`DELETE FROM events WHERE id = ${testResult[0].id}`;
    console.log('   🧹 Тестовое событие удалено\n');

    console.log('✅ МИГРАЦИЯ ЗАВЕРШЕНА!\n');
    
    console.log('📋 Что добавлено:');
    console.log('   • execution_id TEXT - ID выполнения workflow в N8N');
    console.log('   • execution_url TEXT - Прямая ссылка на execution в N8N UI');
    console.log('   • Индекс idx_events_execution_id для быстрого поиска\n');

    console.log('💡 Использование в N8N workflow:');
    console.log('   В ноде "Insert Event" добавить:');
    console.log('   execution_id: {{ $execution.id }}');
    console.log('   execution_url: {{ $env.N8N_HOST }}/workflow/{{ $workflow.id }}/executions/{{ $execution.id }}\n');

    console.log('🔍 Пример запроса для отладки:');
    console.log(`   SELECT 
     id,
     type,
     ext_id,
     execution_id,
     execution_url,
     ok,
     processed
   FROM events
   WHERE execution_id IS NOT NULL
   ORDER BY id DESC
   LIMIT 10;`);

  } finally {
    await sql.end();
  }
}

addExecutionTracking().catch(console.error);


