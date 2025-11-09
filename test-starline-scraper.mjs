/**
 * Локальный тест Starline Scraper
 */
import { getStarlineScraper } from './dist/services/starline-scraper.js';

async function testStarlineScraper() {
  console.log('🚀 Запуск теста Starline Scraper...\n');

  try {
    // Получаем singleton instance
    const scraper = getStarlineScraper();

    // Инициализируем (открываем браузер и логинимся)
    console.log('1️⃣  Инициализация persistent browser session...');
    await scraper.initialize();
    console.log('✅ Браузер инициализирован и залогинен\n');

    // Проверяем health
    const isHealthy = await scraper.isHealthy();
    console.log(`2️⃣  Health check: ${isHealthy ? '✅ OK' : '❌ FAIL'}\n`);

    if (!isHealthy) {
      throw new Error('Браузер не здоров');
    }

    // Получаем список устройств (первый запрос)
    console.log('3️⃣  Получение списка устройств (первый запрос)...');
    const start1 = Date.now();
    const devices1 = await scraper.getDevices();
    const time1 = Date.now() - start1;
    console.log(`✅ Получено ${devices1.length} устройств за ${time1}ms\n`);

    // Получаем список устройств (второй запрос - должен быть быстрее)
    console.log('4️⃣  Получение списка устройств (второй запрос)...');
    const start2 = Date.now();
    const devices2 = await scraper.getDevices();
    const time2 = Date.now() - start2;
    console.log(`✅ Получено ${devices2.length} устройств за ${time2}ms (${Math.round((time2/time1)*100)}% от первого запроса)\n`);

    // Получаем детали для первого устройства
    if (devices1.length > 0) {
      const firstDevice = devices1[0];
      console.log(`5️⃣  Получение деталей для устройства: ${firstDevice.alias} (ID: ${firstDevice.device_id})...`);
      const start3 = Date.now();
      const details = await scraper.getDeviceDetails(firstDevice.device_id);
      const time3 = Date.now() - start3;
      console.log(`✅ Детали получены за ${time3}ms`);
      console.log(`   Статус: ${details.status === 1 ? 'Online' : 'Offline'}`);
      console.log(`   GPS: ${details.gps_lvl > 0 ? `OK (${details.gps_lvl} спутников)` : 'Offline'}`);
      console.log(`   Зажигание: ${details.car_state?.ign ? 'Вкл' : 'Выкл'}`);
      console.log(`   Двигатель: ${details.car_state?.run ? 'Работает' : 'Выключен'}`);
      const coords = details.pos || details.position;
      if (coords) {
        console.log(`   Координаты: ${coords.y}, ${coords.x}\n`);
      }
    }

    // Graceful shutdown
    console.log('6️⃣  Graceful shutdown...');
    await scraper.shutdown();
    console.log('✅ Браузер закрыт\n');

    console.log('🎉 ВСЕ ТЕСТЫ ПРОЙДЕНЫ УСПЕШНО!');
    process.exit(0);

  } catch (error) {
    console.error('❌ ОШИБКА:', error);
    process.exit(1);
  }
}

testStarlineScraper();

