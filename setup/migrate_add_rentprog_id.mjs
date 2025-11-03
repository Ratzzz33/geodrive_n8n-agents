// Миграция: добавить поле rentprog_id в таблицу events
import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

async function migrate() {
  try {
    console.log('🔄 Миграция: добавление rentprog_id в events...\n');
    
    // 1. Добавить поле rentprog_id
    await sql.unsafe(`
      ALTER TABLE events 
      ADD COLUMN IF NOT EXISTS rentprog_id TEXT;
    `);
    console.log('✅ Поле rentprog_id добавлено');
    
    // 2. Создать индекс
    await sql.unsafe(`
      CREATE INDEX IF NOT EXISTS idx_events_rentprog_id 
      ON events(rentprog_id);
    `);
    console.log('✅ Индекс создан');
    
    // 3. Удалить старый constraint
    await sql.unsafe(`
      ALTER TABLE events 
      DROP CONSTRAINT IF EXISTS events_branch_type_ext_id_unique;
    `);
    console.log('✅ Старый constraint удален');
    
    // 4. Создать новый constraint на rentprog_id
    await sql.unsafe(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint 
          WHERE conname = 'events_branch_type_rentprog_id_unique'
        ) THEN
          ALTER TABLE events 
          ADD CONSTRAINT events_branch_type_rentprog_id_unique 
          UNIQUE (branch, type, rentprog_id);
        END IF;
      END $$;
    `);
    console.log('✅ Новый constraint создан');
    
    // 5. Миграция данных: скопировать ext_id в rentprog_id для существующих записей
    await sql.unsafe(`
      UPDATE events 
      SET rentprog_id = ext_id 
      WHERE rentprog_id IS NULL AND ext_id IS NOT NULL AND ext_id != 'unknown';
    `);
    console.log('✅ Данные мигрированы (ext_id → rentprog_id)');
    
    console.log('\n✅ Миграция завершена успешно!');
    
  } catch (error) {
    console.error('❌ Ошибка миграции:', error.message);
    throw error;
  } finally {
    await sql.end();
  }
}

migrate().catch(console.error);

