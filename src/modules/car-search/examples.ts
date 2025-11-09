/**
 * Примеры использования модуля поиска автомобилей
 */

import { searchCars, formatForChat } from './index';

/**
 * Пример 1: Простой поиск по филиалу и датам
 */
export async function example1() {
  console.log('=== Пример 1: Поиск в Батуми на 9-10 ноября ===\n');
  
  const response = await searchCars({
    branch: 'batumi',
    startDate: '2025-11-09',
    endDate: '2025-11-10',
  });
  
  console.log('Найдено:', response.count);
  console.log('Доступно:', response.summary.availableCars);
  console.log('\nДля чата:');
  console.log(formatForChat(response));
}

/**
 * Пример 2: Поиск с ценовым лимитом
 */
export async function example2() {
  console.log('=== Пример 2: Машины до $50/день ===\n');
  
  const response = await searchCars({
    branch: 'batumi',
    startDate: '2025-11-09',
    endDate: '2025-11-10',
    maxPriceUSD: 50,
  });
  
  console.log(formatForChat(response));
}

/**
 * Пример 3: Поиск с фильтрами по характеристикам
 */
export async function example3() {
  console.log('=== Пример 3: Автомат, не старше 2015 года ===\n');
  
  const response = await searchCars({
    branch: 'batumi',
    transmission: 'Автомат',
    yearFrom: 2015,
    sortBy: 'price',
    sortOrder: 'asc',
  });
  
  console.log(formatForChat(response));
}

/**
 * Пример 4: Поиск по нескольким филиалам
 */
export async function example4() {
  console.log('=== Пример 4: Поиск в Батуми и Тбилиси ===\n');
  
  const response = await searchCars({
    branch: ['batumi', 'tbilisi'],
    maxPriceUSD: 100,
    transmission: 'Автомат',
    limit: 5,
  });
  
  console.log(formatForChat(response));
}

/**
 * Пример 5: Поиск кроссоверов/внедорожников
 */
export async function example5() {
  console.log('=== Пример 5: Кроссоверы с полным приводом ===\n');
  
  const response = await searchCars({
    branch: 'batumi',
    carType: 'Кроссовер',
    driveUnit: 'Полный',
  });
  
  response.results.forEach(car => {
    console.log(`${car.model} (${car.year})`);
    console.log(`  Привод: ${car.characteristics.driveUnit}`);
    console.log(`  Цена: ${car.price?.gel} GEL/день`);
    console.log('');
  });
}

/**
 * Пример 6: Программный доступ к данным
 */
export async function example6() {
  console.log('=== Пример 6: Программный анализ результатов ===\n');
  
  const response = await searchCars({
    branch: 'batumi',
    maxPriceUSD: 60,
  });
  
  // Группировка по годам
  const byYear = response.results.reduce((acc, car) => {
    const year = car.year;
    if (!acc[year]) acc[year] = [];
    acc[year].push(car);
    return acc;
  }, {} as Record<number, typeof response.results>);
  
  console.log('Распределение по годам:');
  Object.entries(byYear)
    .sort(([a], [b]) => parseInt(b) - parseInt(a))
    .forEach(([year, cars]) => {
      console.log(`  ${year}: ${cars.length} машин`);
    });
  
  // Средняя цена
  const prices = response.results
    .filter(c => c.price)
    .map(c => c.price!.gel);
  
  if (prices.length > 0) {
    const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
    console.log(`\nСредняя цена: ${avgPrice.toFixed(2)} GEL/день`);
  }
  
  // Самая дешевая машина
  const cheapest = response.results
    .filter(c => c.price)
    .sort((a, b) => a.price!.gel - b.price!.gel)[0];
  
  if (cheapest) {
    console.log(`\nСамая доступная:`);
    console.log(`  ${cheapest.model} - ${cheapest.price!.gel} GEL/день`);
  }
}

/**
 * Запуск всех примеров
 */
export async function runAllExamples() {
  try {
    await example1();
    console.log('\n' + '='.repeat(60) + '\n');
    
    await example2();
    console.log('\n' + '='.repeat(60) + '\n');
    
    await example3();
    console.log('\n' + '='.repeat(60) + '\n');
    
    await example4();
    console.log('\n' + '='.repeat(60) + '\n');
    
    await example5();
    console.log('\n' + '='.repeat(60) + '\n');
    
    await example6();
    
  } catch (error) {
    console.error('Error running examples:', error);
  }
}

// Для запуска: ts-node src/modules/car-search/examples.ts
if (require.main === module) {
  runAllExamples();
}

