/**
 * Проверка схемы event_links
 */

import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  console.log('🔍 Проверка схемы event_links и entity_timeline\n');

  try {
    // 1. Проверить существование таблицы event_links
    const [eventLinksTable] = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'event_links'
      ) as exists
    `;

    console.log(`✓ Таблица event_links: ${eventLinksTable.exists ? '✅ Существует' : '❌ Не найдена'}`);

    // 2. Проверить view unlinked_records
    const [unlinkedView] = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.views
        WHERE table_schema = 'public' 
        AND table_name = 'unlinked_records'
      ) as exists
    `;

    console.log(`✓ View unlinked_records: ${unlinkedView.exists ? '✅ Существует' : '❌ Не найдена'}`);

    // 3. Проверить таблицу entity_timeline
    const [timelineTable] = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'entity_timeline'
      ) as exists
    `;

    console.log(`✓ Таблица entity_timeline: ${timelineTable.exists ? '✅ Существует' : '❌ Не найдена'}`);

    // 4. Если event_links существует, показать структуру
    if (eventLinksTable.exists) {
      console.log('\n📋 Структура таблицы event_links:');
      const columns = await sql`
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'event_links'
        ORDER BY ordinal_position
      `;
      columns.forEach(col => {
        console.log(`  - ${col.column_name}: ${col.data_type}`);
      });

      const [count] = await sql`SELECT COUNT(*) as count FROM event_links`;
      console.log(`\n  Записей в таблице: ${count.count}`);
    }

    // 5. Если entity_timeline существует, показать структуру
    if (timelineTable.exists) {
      console.log('\n📋 Структура таблицы entity_timeline:');
      const columns = await sql`
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'entity_timeline'
        ORDER BY ordinal_position
      `;
      columns.forEach(col => {
        console.log(`  - ${col.column_name}: ${col.data_type}`);
      });

      const [count] = await sql`SELECT COUNT(*) as count FROM entity_timeline`;
      console.log(`\n  Записей в таблице: ${count.count}`);
    }

    // 6. Если view не существует, предложить применить миграцию
    if (!eventLinksTable.exists || !unlinkedView.exists) {
      console.log('\n⚠️  ТРЕБУЕТСЯ ДЕЙСТВИЕ:');
      console.log('Необходимо применить миграцию:');
      console.log('  node setup/apply_event_links_migration.mjs');
    }

    if (!timelineTable.exists) {
      console.log('\n⚠️  ТРЕБУЕТСЯ ДЕЙСТВИЕ:');
      console.log('Необходимо применить миграцию:');
      console.log('  node setup/apply_entity_timeline_migration.mjs');
    }

  } catch (error) {
    console.error('❌ Ошибка:', error);
  } finally {
    await sql.end();
  }
}

main().catch(console.error);

