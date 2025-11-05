import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

async function migrate() {
  console.log('🔄 Создание таблицы entity_branch_cache...\n');

  try {
    // Создаем таблицу для кэширования филиалов
    await sql`
      CREATE TABLE IF NOT EXISTS entity_branch_cache (
        id BIGSERIAL PRIMARY KEY,
        entity_type TEXT NOT NULL,
        rentprog_id TEXT NOT NULL,
        branch TEXT NOT NULL,
        company_id INTEGER,
        last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (entity_type, rentprog_id)
      )
    `;
    console.log('✅ Таблица entity_branch_cache создана');

    // Индекс для быстрого поиска по entity_type + rentprog_id
    await sql`
      CREATE INDEX IF NOT EXISTS idx_entity_branch_cache_lookup 
      ON entity_branch_cache(entity_type, rentprog_id)
    `;
    console.log('✅ Индекс idx_entity_branch_cache_lookup создан');

    // Индекс для очистки старых записей
    await sql`
      CREATE INDEX IF NOT EXISTS idx_entity_branch_cache_last_seen 
      ON entity_branch_cache(last_seen_at)
    `;
    console.log('✅ Индекс idx_entity_branch_cache_last_seen создан');

    // Индекс для поиска по филиалу
    await sql`
      CREATE INDEX IF NOT EXISTS idx_entity_branch_cache_branch 
      ON entity_branch_cache(branch)
    `;
    console.log('✅ Индекс idx_entity_branch_cache_branch создан');

    console.log('\n📋 Описание таблицы:');
    console.log('   • entity_type: тип сущности (car/client/booking)');
    console.log('   • rentprog_id: ID в RentProg');
    console.log('   • branch: филиал (tbilisi/batumi/kutaisi/service-center)');
    console.log('   • company_id: ID компании в RentProg (9247/9506/9248/11163)');
    console.log('   • last_seen_at: последнее обновление');
    console.log('   • created_at: дата создания записи');

    console.log('\n📝 Политика очистки:');
    console.log('   • Записи старше 30 дней автоматически удаляются');
    console.log('   • При каждом успешном поиске обновляется last_seen_at');
    console.log('   • При перемещении сущности между филиалами обновляется branch');

    console.log('\n✅ Миграция завершена успешно!');

  } catch (error) {
    console.error('❌ Ошибка при выполнении миграции:', error.message);
    throw error;
  } finally {
    await sql.end();
  }
}

migrate().catch((err) => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});

