import { initDatabase, getDatabase } from '../dist/db/index.js';
import { cars } from '../dist/db/schema.js';
import { eq, isNotNull } from 'drizzle-orm';
import { extractCarFields } from '../dist/db/carsAndClients.js';

await initDatabase();
const db = getDatabase();

console.log('📊 Извлечение данных из cars.data...\n');

try {
  // Получаем все записи с непустым data
  console.log('Получение записей с заполненным data...');
  const carsWithData = await db
    .select()
    .from(cars)
    .where(isNotNull(cars.data));

  console.log(`Найдено записей: ${carsWithData.length}\n`);

  if (carsWithData.length === 0) {
    console.log('✅ Нет записей для обработки');
    process.exit(0);
  }

  let processed = 0;
  let errors = 0;

  // Обрабатываем пакетами по 10
  const batchSize = 10;
  for (let i = 0; i < carsWithData.length; i += batchSize) {
    const batch = carsWithData.slice(i, i + batchSize);
    
    console.log(`Обработка записей ${i + 1}-${Math.min(i + batchSize, carsWithData.length)} из ${carsWithData.length}...`);

    for (const car of batch) {
      try {
        const extractedFields = extractCarFields(car.data);
        
        await db
          .update(cars)
          .set({
            ...extractedFields,
            updated_at: new Date(),
          })
          .where(eq(cars.id, car.id));

        processed++;
      } catch (error) {
        console.error(`❌ Ошибка обработки car ${car.id}:`, error.message);
        errors++;
      }
    }

    // Показываем прогресс
    const progress = ((i + batch.length) / carsWithData.length * 100).toFixed(1);
    console.log(`   Прогресс: ${progress}% (обработано: ${processed}, ошибок: ${errors})`);
  }

  console.log('\n📊 Результаты:');
  console.log(`   Всего записей: ${carsWithData.length}`);
  console.log(`   ✅ Обработано успешно: ${processed}`);
  console.log(`   ❌ Ошибок: ${errors}`);

  if (processed > 0) {
    console.log('\n✅ Извлечение завершено! Поле data очищено для визуального контроля.');
  }

} catch (error) {
  console.error('❌ Ошибка:', error);
  process.exit(1);
}


