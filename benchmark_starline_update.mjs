import fetch from 'node-fetch';

const API_URL = 'http://172.17.0.1:3000/starline/update-gps';
const TIMEOUT = 60000; // 60 секунд как в workflow

async function benchmarkStarlineUpdate() {
  console.log('⏱️  Бенчмарк выполнения Starline GPS Update\n');
  console.log(`📍 Endpoint: ${API_URL}`);
  console.log(`⏱️  Timeout: ${TIMEOUT}ms\n`);
  console.log('─'.repeat(80));
  console.log('');

  const startTime = process.hrtime.bigint();
  const startDate = Date.now();

  try {
    console.log('🚀 Отправка запроса...\n');

    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: TIMEOUT
    });

    const endTime = process.hrtime.bigint();
    const endDate = Date.now();
    const durationMs = Number(endTime - startTime) / 1_000_000;
    const durationSec = (durationMs / 1000).toFixed(2);

    console.log(`✅ Запрос выполнен за ${durationSec} секунд (${durationMs.toFixed(0)} мс)\n`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ HTTP ${response.status}: ${errorText}`);
      return;
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
      console.log('\n   ⚠️  Список ошибок:');
      result.errors.slice(0, 5).forEach((error, i) => {
        console.log(`      ${i + 1}. ${error}`);
      });
      if (result.errors.length > 5) {
        console.log(`      ... и еще ${result.errors.length - 5} ошибок`);
      }
    }

    if (result.timestamp) {
      console.log(`\n   Время выполнения: ${result.timestamp}`);
    }

    console.log('\n─'.repeat(80));
    console.log('\n📈 Метрики производительности:\n');
    console.log(`   ⏱️  Общее время: ${durationSec} сек`);
    console.log(`   📊 Обновлено машин: ${result.updated || 0}`);
    if (result.updated > 0) {
      const avgTimePerCar = (durationMs / result.updated).toFixed(0);
      console.log(`   ⚡ Среднее время на машину: ${avgTimePerCar} мс`);
    }
    console.log(`   🎯 Успешность: ${result.ok ? '100%' : '0%'}`);

    // Проверка на превышение timeout
    if (durationMs > TIMEOUT * 0.9) {
      console.log(`\n   ⚠️  ВНИМАНИЕ: Время выполнения близко к timeout (${TIMEOUT}ms)`);
    }

  } catch (error) {
    const endTime = process.hrtime.bigint();
    const durationMs = Number(endTime - startTime) / 1_000_000;
    const durationSec = (durationMs / 1000).toFixed(2);

    console.error(`\n❌ Ошибка выполнения:`);
    console.error(`   ${error.message}`);
    console.error(`\n⏱️  Время до ошибки: ${durationSec} сек`);
    
    if (error.name === 'AbortError' || error.message.includes('timeout')) {
      console.error(`\n   ⚠️  Превышен timeout (${TIMEOUT}ms)`);
    }
  }
}

// Запускаем
benchmarkStarlineUpdate();


