import postgres from 'postgres';

const CONNECTION_STRING = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

console.log('🔍 Проверяю наличие таблицы conversations...');

try {
  // Проверяем существует ли таблица
  const exists = await sql.unsafe(`
    SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'conversations'
    )
  `);

  if (exists[0].exists) {
    console.log('✅ Таблица conversations уже существует');
    
    // Проверяем есть ли поле last_message_preview
    const hasPreview = await sql.unsafe(`
      SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'conversations' 
        AND column_name = 'last_message_preview'
      )
    `);
    
    if (!hasPreview[0].exists) {
      console.log('\n🔄 Добавляю поле last_message_preview...');
      await sql.unsafe('ALTER TABLE conversations ADD COLUMN last_message_preview TEXT');
      console.log('✅ Поле добавлено');
    } else {
      console.log('✅ Поле last_message_preview уже существует');
    }
    
  } else {
    console.log('\n🔨 Создаю таблицу conversations...');
    
    await sql.unsafe(`
      CREATE TABLE conversations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        
        -- Внешние ссылки
        client_id UUID REFERENCES clients(id),
        umnico_conversation_id TEXT UNIQUE,
        amocrm_scope_id TEXT,
        amocrm_lead_id TEXT,
        
        -- Метаданные
        channel TEXT,
        channel_account TEXT,
        status TEXT DEFAULT 'active',
        assigned_to_user_id INTEGER,
        
        -- Временные метки
        last_message_at TIMESTAMPTZ,
        last_message_preview TEXT,
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now(),
        
        -- Метаданные (JSON)
        metadata JSONB DEFAULT '{}'::jsonb
      )
    `);
    
    console.log('✅ Таблица создана');
    
    // Создаем индексы
    console.log('\n🔨 Создаю индексы...');
    await sql.unsafe('CREATE INDEX idx_conversations_client ON conversations(client_id)');
    await sql.unsafe('CREATE INDEX idx_conversations_umnico ON conversations(umnico_conversation_id) WHERE umnico_conversation_id IS NOT NULL');
    await sql.unsafe('CREATE INDEX idx_conversations_amocrm ON conversations(amocrm_scope_id) WHERE amocrm_scope_id IS NOT NULL');
    await sql.unsafe('CREATE INDEX idx_conversations_status ON conversations(status)');
    await sql.unsafe('CREATE INDEX idx_conversations_updated ON conversations(updated_at DESC)');
    await sql.unsafe('CREATE INDEX idx_conversations_last_msg ON conversations(last_message_at DESC)');
    console.log('✅ Индексы созданы');
  }

  // Показываем все колонки
  console.log('\n📊 Колонки таблицы conversations:');
  const columns = await sql.unsafe(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'conversations'
    ORDER BY ordinal_position
  `);
  
  columns.forEach(col => {
    console.log(`   - ${col.column_name} (${col.data_type})`);
  });

  console.log('\n✅ Готово!');
  
} catch (error) {
  console.error('❌ Ошибка:', error);
  process.exit(1);
} finally {
  await sql.end();
}

