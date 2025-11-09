import fetch from 'node-fetch';

// Пробуем разные адреса
const API_URLS = [
  'http://46.224.17.15:3000/starline/update-gps',  // Внешний адрес сервера
  'http://localhost:3000/starline/update-gps',      // Локальный
  'http://172.17.0.1:3000/starline/update-gps'      // Docker internal
];

const TIMEOUT = 60000; // 60 секунд как в workflow

async function benchmarkAPI(url) {
  console.log(`\n🔗 Пробую: ${url}\n`);

  const startTime = process.hrtime.bigint();
  const startDate = Date.now();

  try {
    console.log('🚀 Отправка POST запроса...\n');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    const endTime = process.hrtime.bigint();
    const endDate = Date.now();
    const durationMs = Number(endTime - startTime) / 1_000_000;
    const durationSec = (durationMs / 1000).toFixed(2);

    console.log(`✅ Запрос выполнен за ${durationSec} секунд (${durationMs.toFixed(0)} мс)\n`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ HTTP ${response.status}: ${errorText.substring(0, 200)}`);
      return null;
    }

    const result = await response.json();

    console.log('📊 Результаты:\n');
    console.log(`   Статус: ${result.ok ? '✅ OK' : '❌ Error'}`);
    console.log(`   Обновлено машин: ${result.updated || 0}`);
    console.log(`   Ошибок: ${result.error_count || result.errors?.length || 0}`);
    
    if (result.details && Array.isArray(result.details)) {
      console.log(`   Детали: ${result.details.length} записей`);
    }

    if (result.errors && result.errors.length > 0) {
      console.log('\n   ⚠️  Первые ошибки:');
      result.errors.slice(0, 3).forEach((error, i) => {
        console.log(`      ${i + 1}. ${error.substring(0, 100)}`);
      });
      if (result.errors.length > 3) {
        console.log(`      ... и еще ${result.errors.length - 3} ошибок`);
      }
    }

    console.log('\n─'.repeat(80));
    console.log('\n📈 Метрики производительности:\n');
    console.log(`   ⏱️  Общее время: ${durationSec} сек (${durationMs.toFixed(0)} мс)`);
    console.log(`   📊 Обновлено машин: ${result.updated || 0}`);
    if (result.updated > 0) {
      const avgTimePerCar = (durationMs / result.updated).toFixed(0);
      console.log(`   ⚡ Среднее время на машину: ${avgTimePerCar} мс`);
    }
    console.log(`   🎯 Успешность: ${result.ok ? '100%' : '0%'}`);

    // Проверка на превышение timeout
    if (durationMs > TIMEOUT * 0.9) {
      console.log(`\n   ⚠️  ВНИМАНИЕ: Время выполнения близко к timeout (${TIMEOUT}ms)`);
    } else if (durationMs < TIMEOUT * 0.3) {
      console.log(`\n   ✅ Отлично: Время выполнения в пределах нормы`);
    }

    return { url, durationMs, result };

  } catch (error) {
    const endTime = process.hrtime.bigint();
    const durationMs = Number(endTime - startTime) / 1_000_000;
    const durationSec = (durationMs / 1000).toFixed(2);

    if (error.name === 'AbortError' || error.message.includes('timeout')) {
      console.error(`\n   ⏱️  Превышен timeout (${TIMEOUT}ms) после ${durationSec} сек`);
    } else {
      console.error(`\n   ❌ Ошибка: ${error.message}`);
    }
    return null;
  }
}

async function main() {
  console.log('⏱️  Бенчмарк выполнения Starline GPS Update\n');
  console.log(`⏱️  Timeout: ${TIMEOUT}ms`);
  console.log('─'.repeat(80));

  let success = false;

  for (const url of API_URLS) {
    const result = await benchmarkAPI(url);
    if (result) {
      success = true;
      console.log(`\n✅ Успешно выполнено через: ${url}`);
      break;
    }
  }

  if (!success) {
    console.log('\n❌ Не удалось выполнить запрос ни через один адрес');
    console.log('\n💡 Возможные причины:');
    console.log('   1. Jarvis API не запущен на сервере');
    console.log('   2. Сервер недоступен');
    console.log('   3. Проблемы с сетью');
    console.log('\n📋 Проверьте:');
    console.log('   - Статус сервиса: docker ps | grep jarvis');
    console.log('   - Логи: docker logs jarvis-api');
  }
}

// Запускаем
main();


