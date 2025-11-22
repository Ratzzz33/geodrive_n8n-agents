
import { upsertBookingFromRentProg, resolveByExternalRef } from '../src/db/upsert';
import { getDatabase, initDatabase } from '../src/db';
import { bookings, externalRefs } from '../src/db/schema';
import { eq, and } from 'drizzle-orm';
import { logger } from '../src/utils/logger';

// Отключаем лишние логи для чистоты вывода
logger.info = () => {};
logger.debug = () => {};
logger.warn = console.warn;
logger.error = console.error;

async function runTest() {
  // Инициализация БД
  initDatabase();

  const db = getDatabase();
  const testId = Math.floor(Math.random() * 1000000).toString();
  const fakeRentprogId = `test-${testId}`;
  const fakeBranch = 'tbilisi';
  
  console.log(`🚀 Запуск теста upsert flow для ID: ${fakeRentprogId}`);

  try {
    // 1. Payload брони
    const payload = {
      id: fakeRentprogId,
      start_date: '25-11-2025 12:00',
      end_date: '27-11-2025 12:00',
      state: 'planned',
      // car_id, client_id можно опустить или использовать существующие (но для теста лучше без них, чтобы не засорять)
    };

    // 2. Параметры отслеживания
    const tracking = {
      source: 'jarvis_api' as const,
      workflow: 'test-workflow',
      function: 'check_upsert_flow',
      user: 'tester',
      metadata: { test_run: true }
    };

    console.log('📦 Вызываем upsertBookingFromRentProg...');
    const result = await upsertBookingFromRentProg(payload, fakeBranch, tracking);
    
    console.log(`✅ Бронь создана/обновлена. Internal ID: ${result.entityId}, Created: ${result.created}`);

    // 3. Проверяем bookings
    const bookingRecord = await db.select().from(bookings).where(eq(bookings.id, result.entityId));
    if (bookingRecord.length === 0) throw new Error('Бронь не найдена в таблице bookings');
    
    const b = bookingRecord[0];
    console.log(`✅ Запись в bookings найдена.`);
    
    // Проверяем поля отслеживания
    if (b.updated_by_source !== 'jarvis_api') console.error('❌ updated_by_source неверный:', b.updated_by_source);
    else console.log('✅ updated_by_source корректный');
    
    if (b.updated_by_workflow !== 'test-workflow') console.error('❌ updated_by_workflow неверный:', b.updated_by_workflow);
    else console.log('✅ updated_by_workflow корректный');

    // 4. Проверяем external_refs
    const ref = await db.select().from(externalRefs).where(and(
      eq(externalRefs.system, 'rentprog'),
      eq(externalRefs.external_id, fakeRentprogId)
    ));

    if (ref.length === 0) {
      console.error('❌ Ссылка в external_refs НЕ найдена!');
    } else {
      console.log('✅ Ссылка в external_refs найдена.');
      if (ref[0].entity_id === result.entityId) console.log('✅ Ссылка указывает на правильный UUID.');
      else console.error('❌ Ссылка указывает на неверный UUID.');
    }

    // 5. Очистка
    console.log('🧹 Очистка тестовых данных...');
    await db.delete(externalRefs).where(eq(externalRefs.external_id, fakeRentprogId));
    await db.delete(bookings).where(eq(bookings.id, result.entityId));
    console.log('✅ Тестовые данные удалены.');

  } catch (error) {
    console.error('❌ Тест провален:', error);
  } finally {
    process.exit(0);
  }
}

runTest();
