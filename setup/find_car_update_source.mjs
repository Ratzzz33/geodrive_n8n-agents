import postgres from 'postgres';

const sql = postgres('postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require', {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

try {
  console.log('🔍 Ищем источник записей "car.update"\n');
  
  // Получаем несколько записей "car.update"
  const carUpdates = await sql`
    SELECT 
      id,
      ts,
      event_name,
      rentprog_id,
      company_id
    FROM events
    WHERE type = 'car.update'
    ORDER BY ts DESC
    LIMIT 10;
  `;
  
  console.log('📋 Последние 10 записей "car.update":');
  console.table(carUpdates);
  
  // Получаем несколько записей просто "update" для сравнения
  const normalUpdates = await sql`
    SELECT 
      id,
      ts,
      event_name,
      rentprog_id,
      company_id,
      execution_id
    FROM events
    WHERE type = 'update' AND event_name = 'car_update'
    ORDER BY ts DESC
    LIMIT 5;
  `;
  
  console.log('\n\n📋 Последние 5 записей type="update", event_name="car_update":');
  console.table(normalUpdates);
  
  console.log('\n\n💡 ВЫВОД:');
  console.log('1. Записи с type="car.update" — приходят из СТАРОГО источника');
  console.log('2. Записи с type="update" и event_name="car_update" — из НОВОГО обновлённого workflow');
  console.log('\n📌 РЕШЕНИЕ:');
  console.log('Найти и ДЕАКТИВИРОВАТЬ старый workflow, который создаёт записи с type="car.update"');
  console.log('Или проверить, не была ли это разовая миграция/импорт данных.');
  
} finally {
  await sql.end();
}

