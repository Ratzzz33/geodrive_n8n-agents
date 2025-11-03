import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

(async () => {
  try {
    console.log('🔄 Применение миграций для улучшения вебхуков...\n');

    // 1. Добавить event_hash в таблицу events
    console.log('1. Добавление поля event_hash в таблицу events...');
    await sql.unsafe(`
      ALTER TABLE events ADD COLUMN IF NOT EXISTS event_hash TEXT;
      CREATE INDEX IF NOT EXISTS idx_events_hash ON events(event_hash) WHERE event_hash IS NOT NULL;
    `);
    console.log('   ✅ event_hash добавлено\n');

    // 2. Обновить unique constraint для включения event_hash (альтернативный способ дедупликации)
    // Оставляем существующий constraint, но event_hash будет использоваться для дополнительной проверки
    console.log('2. Проверка существующих constraints...');
    const constraints = await sql`
      SELECT conname FROM pg_constraint 
      WHERE conrelid = 'events'::regclass 
      AND conname = 'events_company_id_type_rentprog_id_unique'
    `;
    if (constraints.length === 0) {
      console.log('   ⚠️  Уникальный constraint не найден, создаем...');
      await sql.unsafe(`
        ALTER TABLE events 
        ADD CONSTRAINT events_company_id_type_rentprog_id_unique 
        UNIQUE (company_id, type, rentprog_id);
      `);
      console.log('   ✅ constraint создан\n');
    } else {
      console.log('   ✅ constraint уже существует\n');
    }

    // 3. Создать таблицу webhook_error_log для подробного логирования ошибок
    console.log('3. Создание таблицы webhook_error_log...');
    await sql.unsafe(`
      CREATE TABLE IF NOT EXISTS webhook_error_log (
        id BIGSERIAL PRIMARY KEY,
        ts TIMESTAMPTZ NOT NULL DEFAULT now(),
        phase TEXT NOT NULL,  -- 'sync', 'parse', 'worker', 'save', 'upsert'
        kind TEXT NOT NULL,   -- 'error', 'warn', 'info'
        error TEXT,
        payload JSONB,
        meta JSONB,
        request_id TEXT,
        event_hash TEXT,
        company_id INTEGER,
        event_type TEXT,
        rentprog_id TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_webhook_error_log_ts ON webhook_error_log(ts);
      CREATE INDEX IF NOT EXISTS idx_webhook_error_log_phase ON webhook_error_log(phase);
      CREATE INDEX IF NOT EXISTS idx_webhook_error_log_kind ON webhook_error_log(kind);
      CREATE INDEX IF NOT EXISTS idx_webhook_error_log_event_hash ON webhook_error_log(event_hash) WHERE event_hash IS NOT NULL;
      CREATE INDEX IF NOT EXISTS idx_webhook_error_log_created_at ON webhook_error_log(ts DESC);
    `);
    console.log('   ✅ webhook_error_log создана\n');

    // 4. Комментарии для документации
    await sql.unsafe(`
      COMMENT ON COLUMN events.event_hash IS 'SHA256 hash от headers + payload для дополнительной дедупликации';
      COMMENT ON TABLE webhook_error_log IS 'Подробное логирование всех ошибок обработки вебхуков на всех этапах';
      COMMENT ON COLUMN webhook_error_log.phase IS 'Этап обработки: sync (синхронный), parse (парсинг), worker (асинхронная обработка), save (сохранение в БД), upsert (upsert процессор)';
      COMMENT ON COLUMN webhook_error_log.kind IS 'Тип ошибки: error (критическая), warn (предупреждение), info (информация)';
    `);

    console.log('✅ Все миграции применены успешно!\n');
    console.log('📋 Изменения:');
    console.log('   • Добавлено поле event_hash в events');
    console.log('   • Создана таблица webhook_error_log для подробного логирования');
    console.log('   • Добавлены индексы для быстрого поиска');

  } catch (error) {
    console.error('❌ Ошибка миграции:', error.message);
    if (error.stack) {
      console.error('Stack:', error.stack);
    }
    process.exit(1);
  } finally {
    await sql.end();
  }
})();

