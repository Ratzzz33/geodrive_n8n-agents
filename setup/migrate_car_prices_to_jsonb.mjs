import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

try {
  console.log('Изменяю структуру таблицы car_prices...\n');
  
  // Проверить есть ли данные в таблице
  const count = await sql`SELECT COUNT(*) as count FROM car_prices`;
  console.log(`Текущих записей в car_prices: ${count[0].count}`);
  
  if (count[0].count > 0) {
    console.log('⚠️ Таблица содержит данные. Они будут потеряны при изменении типа колонки.');
    console.log('Продолжаем...');
  }
  
  // Изменить тип price_values на JSONB
  console.log('\n1. Удаляю старую колонку price_values...');
  await sql`ALTER TABLE car_prices DROP COLUMN IF EXISTS price_values`;
  
  console.log('2. Добавляю новую колонку price_values типа JSONB...');
  await sql`ALTER TABLE car_prices ADD COLUMN price_values JSONB`;
  
  console.log('3. Добавляю индекс для быстрого поиска...');
  await sql`CREATE INDEX IF NOT EXISTS idx_car_prices_car_id ON car_prices(car_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_car_prices_season_id ON car_prices(season_id)`;
  
  console.log('\n✅ Миграция завершена!');
  console.log('\nНовая структура:');
  
  const columns = await sql`
    SELECT column_name, data_type, udt_name
    FROM information_schema.columns
    WHERE table_name = 'car_prices'
    ORDER BY ordinal_position
  `;
  
  columns.forEach(c => {
    console.log(`  ${c.column_name}: ${c.data_type} (${c.udt_name})`);
  });
  
} catch (error) {
  console.error('❌ Ошибка:', error.message);
  console.error(error);
} finally {
  await sql.end();
}

