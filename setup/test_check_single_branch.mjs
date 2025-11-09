/**
 * Тест проверки одного филиала
 */

import { checkBranchCarsWithoutPrices } from './check_cars_without_prices.mjs';

console.log('🧪 Тестирую проверку филиала tbilisi...\n');

checkBranchCarsWithoutPrices('tbilisi')
  .then(result => {
    console.log('\n✅ Тест завершен успешно!');
    console.log(`\nРезультат:`);
    console.log(`  Филиал: ${result.branch}`);
    console.log(`  Всего авто: ${result.total}`);
    console.log(`  Проверено: ${result.checked}`);
    console.log(`  Без цен: ${result.withoutPrices}`);
    console.log(`  С ценами: ${result.withPrices}`);
    console.log(`  Ошибок: ${result.errors}`);
    
    if (result.withoutPrices > 0) {
      console.log(`\n📋 Первые 5 авто без цен:`);
      result.cars.slice(0, 5).forEach((car, i) => {
        console.log(`  ${i + 1}. ${car.number || car.code} (${car.model || 'N/A'})`);
        console.log(`     Сезонов: ${car.priceCheck.seasons}, Цен: ${car.priceCheck.pricesCount}`);
      });
    }
    
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Ошибка:', error.message);
    console.error(error.stack);
    process.exit(1);
  });

