/**
 * Быстрый запуск синхронизации цен для Кутаиси
 */

import { syncPricesForBranch } from './sync_prices_module.mjs';

console.log('🚀 Запуск синхронизации цен для Кутаиси...\n');

try {
  const result = await syncPricesForBranch('kutaisi');
  
  console.log('\n✅ Результат синхронизации:');
  console.log(`   Филиал: ${result.branch}`);
  console.log(`   Добавлено: ${result.inserted}`);
  console.log(`   Обновлено: ${result.updated}`);
  console.log(`   Пропущено: ${result.skipped}`);
  console.log(`   Ошибок: ${result.errors}`);
  
  if (result.ok) {
    console.log('\n✅ Синхронизация завершена успешно!');
    process.exit(0);
  } else {
    console.log(`\n❌ Ошибка: ${result.error}`);
    process.exit(1);
  }
} catch (error) {
  console.error('\n❌ Критическая ошибка:', error.message);
  console.error(error.stack);
  process.exit(1);
}


