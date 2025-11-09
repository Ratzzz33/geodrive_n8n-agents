import { initDatabase, getDatabase } from '../dist/db/index.js';
import { clients } from '../dist/db/schema.js';
import { eq, isNotNull } from 'drizzle-orm';
import { extractClientFields } from '../dist/db/carsAndClients.js';

await initDatabase();
const db = getDatabase();

console.log('📊 Извлечение данных из clients.data...\n');

try {
  // Получаем все записи с непустым data
  console.log('Получение записей с заполненным data...');
  const clientsWithData = await db
    .select()
    .from(clients)
    .where(isNotNull(clients.data));

  console.log(`Найдено записей: ${clientsWithData.length}\n`);

  if (clientsWithData.length === 0) {
    console.log('✅ Нет записей для обработки');
    process.exit(0);
  }

  let processed = 0;
  let errors = 0;

  // Обрабатываем пакетами по 50 (клиентов больше, чем машин)
  const batchSize = 50;
  for (let i = 0; i < clientsWithData.length; i += batchSize) {
    const batch = clientsWithData.slice(i, i + batchSize);
    
    console.log(`Обработка записей ${i + 1}-${Math.min(i + batchSize, clientsWithData.length)} из ${clientsWithData.length}...`);

    for (const client of batch) {
      try {
        const extractedFields = extractClientFields(client.data);
        
        await db
          .update(clients)
          .set({
            ...extractedFields,
            updated_at: new Date(),
          })
          .where(eq(clients.id, client.id));

        processed++;
      } catch (error) {
        console.error(`❌ Ошибка обработки client ${client.id}:`, error.message);
        errors++;
      }
    }

    // Показываем прогресс каждые 10%
    if ((i + batch.length) % 250 === 0 || i + batch.length === clientsWithData.length) {
      const progress = ((i + batch.length) / clientsWithData.length * 100).toFixed(1);
      console.log(`   Прогресс: ${progress}% (обработано: ${processed}, ошибок: ${errors})`);
    }
  }

  console.log('\n📊 Результаты:');
  console.log(`   Всего записей: ${clientsWithData.length}`);
  console.log(`   ✅ Обработано успешно: ${processed}`);
  console.log(`   ❌ Ошибок: ${errors}`);

  if (processed > 0) {
    console.log('\n✅ Извлечение завершено! Поле data очищено для визуального контроля.');
  }

} catch (error) {
  console.error('❌ Ошибка:', error);
  process.exit(1);
}


