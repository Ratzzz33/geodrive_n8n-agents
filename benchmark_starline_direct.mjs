import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Устанавливаем переменные окружения перед импортом
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

async function benchmarkDirect() {
  console.log('⏱️  Бенчмарк выполнения Starline GPS Update (прямой вызов)\n');
  console.log('─'.repeat(80));
  console.log('');

  const startTime = process.hrtime.bigint();
  const startDate = Date.now();

  try {
    console.log('🚀 Импорт сервиса...\n');
    
    // Импортируем сервис напрямую
    const { StarlineMonitorService } = await import('./src/services/starline-monitor.js');
    
    const importTime = process.hrtime.bigint();
    const importDuration = Number(importTime - startTime) / 1_000_000;
    console.log(`✅ Сервис импортирован за ${importDuration.toFixed(0)} мс\n`);

    console.log('📍 Запуск updateGPSData()...\n');
    
    const service = new StarlineMonitorService();
    const result = await service.updateGPSData();

    const endTime = process.hrtime.bigint();
    const endDate = Date.now();
    const totalDurationMs = Number(endTime - startTime) / 1_000_000;
    const executionDurationMs = Number(endTime - importTime) / 1_000_000;
    const totalDurationSec = (totalDurationMs / 1000).toFixed(2);
    const executionDurationSec = (executionDurationMs / 1000).toFixed(2);

    console.log('─'.repeat(80));
    console.log('\n✅ Выполнение завершено!\n');
    console.log('📊 Результаты:\n');
    console.log(`   ✅ Обновлено машин: ${result.updated || 0}`);
    console.log(`   ❌ Ошибок: ${result.errors?.length || 0}`);
    console.log(`   📋 Детали: ${result.details?.length || 0} записей`);

    if (result.errors && result.errors.length > 0) {
      console.log('\n   ⚠️  Список ошибок:');
      result.errors.slice(0, 5).forEach((error, i) => {
        console.log(`      ${i + 1}. ${error}`);
      });
      if (result.errors.length > 5) {
        console.log(`      ... и еще ${result.errors.length - 5} ошибок`);
      }
    }

    console.log('\n─'.repeat(80));
    console.log('\n📈 Метрики производительности:\n');
    console.log(`   ⏱️  Общее время (с импортом): ${totalDurationSec} сек (${totalDurationMs.toFixed(0)} мс)`);
    console.log(`   ⚡ Время выполнения (без импорта): ${executionDurationSec} сек (${executionDurationMs.toFixed(0)} мс)`);
    console.log(`   📊 Обновлено машин: ${result.updated || 0}`);
    
    if (result.updated > 0) {
      const avgTimePerCar = (executionDurationMs / result.updated).toFixed(0);
      console.log(`   ⚡ Среднее время на машину: ${avgTimePerCar} мс`);
    }
    
    console.log(`   🎯 Успешность: ${result.errors?.length === 0 ? '100%' : `${((result.updated / (result.updated + result.errors.length)) * 100).toFixed(1)}%`}`);

    // Проверка на превышение timeout
    const timeout = 60000; // 60 секунд как в workflow
    if (executionDurationMs > timeout * 0.9) {
      console.log(`\n   ⚠️  ВНИМАНИЕ: Время выполнения близко к timeout (${timeout}ms)`);
    }

    if (executionDurationMs < timeout * 0.5) {
      console.log(`\n   ✅ Отлично: Время выполнения в пределах нормы (< ${timeout * 0.5}ms)`);
    }

    // Детальная статистика
    if (result.details && result.details.length > 0) {
      console.log('\n─'.repeat(80));
      console.log('\n📋 Детали обновления (первые 5):\n');
      result.details.slice(0, 5).forEach((detail, i) => {
        console.log(`   ${i + 1}. ${detail.alias || 'Unknown'}: ${detail.status || 'OK'}`);
      });
      if (result.details.length > 5) {
        console.log(`   ... и еще ${result.details.length - 5} машин`);
      }
    }

  } catch (error) {
    const endTime = process.hrtime.bigint();
    const durationMs = Number(endTime - startTime) / 1_000_000;
    const durationSec = (durationMs / 1000).toFixed(2);

    console.error(`\n❌ Ошибка выполнения:`);
    console.error(`   ${error.message}`);
    console.error(`\n⏱️  Время до ошибки: ${durationSec} сек`);
    console.error(`\n📋 Stack trace:`);
    console.error(error.stack);
  }
}

// Запускаем
benchmarkDirect();


