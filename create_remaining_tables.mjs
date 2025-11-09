import postgres from 'postgres';

const CONNECTION_STRING = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

console.log('🔄 Создаю остальные таблицы...');

try {
  // Создаем таблицу messages
  console.log('\n1. Создаю таблицу messages...');
  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS messages (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      client_id UUID REFERENCES clients(id),
      conversation_id UUID REFERENCES conversations(id),
      direction TEXT NOT NULL,
      channel TEXT NOT NULL,
      text TEXT,
      attachments JSONB DEFAULT '[]',
      sent_at TIMESTAMPTZ NOT NULL,
      read_at TIMESTAMPTZ,
      umnico_message_id TEXT UNIQUE,
      amocrm_note_id TEXT UNIQUE,
      metadata JSONB,
      created_at TIMESTAMPTZ DEFAULT now()
    )
  `);
  console.log('   ✅ messages создана');

  // Индексы для messages
  await sql.unsafe('CREATE INDEX IF NOT EXISTS idx_messages_client ON messages(client_id)');
  await sql.unsafe('CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id)');
  await sql.unsafe('CREATE INDEX IF NOT EXISTS idx_messages_sent_at ON messages(sent_at DESC)');
  console.log('   ✅ Индексы созданы');

  // Создаем таблицу external_refs
  console.log('\n2. Создаю таблицу external_refs...');
  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS external_refs (
      id BIGSERIAL PRIMARY KEY,
      entity_type TEXT NOT NULL,
      entity_id UUID NOT NULL,
      system TEXT NOT NULL,
      external_id TEXT NOT NULL,
      metadata JSONB,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now(),
      UNIQUE(entity_type, system, external_id)
    )
  `);
  console.log('   ✅ external_refs создана');

  // Индексы для external_refs
  await sql.unsafe('CREATE INDEX IF NOT EXISTS idx_external_refs_entity_id ON external_refs(entity_id)');
  await sql.unsafe('CREATE INDEX IF NOT EXISTS idx_external_refs_system_external_id ON external_refs(system, external_id)');
  console.log('   ✅ Индексы созданы');

  // Создаем таблицу sync_state
  console.log('\n3. Создаю таблицу sync_state...');
  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS sync_state (
      id SERIAL PRIMARY KEY,
      system_name TEXT UNIQUE NOT NULL,
      last_sync_timestamp TIMESTAMPTZ,
      last_processed_id TEXT,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now()
    )
  `);
  console.log('   ✅ sync_state создана');

  // Показываем все таблицы
  console.log('\n📊 Все таблицы в БД:');
  const tables = await sql.unsafe(`
    SELECT tablename 
    FROM pg_tables 
    WHERE schemaname = 'public'
    ORDER BY tablename
  `);
  
  tables.forEach(t => {
    console.log(`   - ${t.tablename}`);
  });

  console.log('\n✅ Все таблицы созданы!');
  
} catch (error) {
  console.error('❌ Ошибка:', error);
  process.exit(1);
} finally {
  await sql.end();
}

