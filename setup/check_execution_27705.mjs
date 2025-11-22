import fs from 'fs';

const executionFile = 'c:/Users/33pok/.cursor/projects/c-Users-33pok-geodrive-n8n-agents/agent-tools/7ed08701-f12d-408a-ac63-0ab7b385a82c.txt';

console.log('📥 Читаю execution файл...\n');

try {
  const data = JSON.parse(fs.readFileSync(executionFile, 'utf8'));
  const nodes = data.data.nodes;

  // Проверяем ноду "Merge & Process"
  console.log('=== 1. НОДА "Merge & Process" ===\n');
  const mergeProcess = nodes['Merge & Process'];
  if (mergeProcess && mergeProcess.data && mergeProcess.data.output && mergeProcess.data.output[0]) {
    const items = mergeProcess.data.output[0];
    console.log(`Всего элементов: ${items.length}`);
    
    // Разделяем машины и цены
    const cars = items.filter(item => !item.json.price_id);
    const prices = items.filter(item => item.json.price_id);
    
    console.log(`  Машины: ${cars.length}`);
    console.log(`  Цены: ${prices.length}`);
    
    if (prices.length > 0) {
      console.log('\n  ✅ Цены извлекаются!');
      console.log('\n  Примеры цен:');
      prices.slice(0, 3).forEach((price, idx) => {
        console.log(`\n  ${idx + 1}. Price ID: ${price.json.price_id}`);
        console.log(`     RentProg ID: ${price.json.rentprog_id}`);
        console.log(`     Season ID: ${price.json.season_id}`);
        console.log(`     Values: ${price.json.values ? price.json.values.length + ' значений' : 'нет'}`);
      });
    } else {
      console.log('\n  ❌ Цены НЕ извлекаются!');
    }
  } else {
    console.log('❌ Нет данных в ноде "Merge & Process"');
  }

  // Проверяем ноду "Split Cars and Prices"
  console.log('\n\n=== 2. НОДА "Split Cars and Prices" ===\n');
  const splitCars = nodes['Split Cars and Prices'];
  if (splitCars && splitCars.data) {
    console.log(`Статус: ${splitCars.status}`);
    if (splitCars.data.output) {
      const trueBranch = splitCars.data.output[0] || []; // True branch (цены)
      const falseBranch = splitCars.data.output[1] || []; // False branch (машины)
      console.log(`True branch (цены): ${trueBranch.length} элементов`);
      console.log(`False branch (машины): ${falseBranch.length} элементов`);
      
      if (trueBranch.length > 0) {
        console.log('\n  ✅ Цены проходят через Split Cars and Prices!');
        console.log('\n  Примеры цен из True branch:');
        trueBranch.slice(0, 3).forEach((price, idx) => {
          console.log(`  ${idx + 1}. Price ID: ${price.json.price_id || 'нет'}`);
          console.log(`     RentProg ID: ${price.json.rentprog_id || 'нет'}`);
        });
      } else {
        console.log('\n  ❌ True branch пустой - цены не проходят!');
      }
    }
  }

  // Проверяем ноду "Save Prices"
  console.log('\n\n=== 3. НОДА "Save Prices" ===\n');
  const savePrices = nodes['Save Prices'];
  if (savePrices && savePrices.data) {
    console.log(`Статус: ${savePrices.status}`);
    if (savePrices.data.output && savePrices.data.output[0]) {
      const items = savePrices.data.output[0];
      console.log(`Всего сохранено цен: ${items.length}`);
      
      if (items.length > 0) {
        console.log('\n  ✅ Цены сохраняются!');
        console.log('\n  Примеры сохраненных цен:');
        items.slice(0, 3).forEach((item, idx) => {
          console.log(`  ${idx + 1}. Car ID: ${item.json.car_id || 'нет'}`);
          console.log(`     RentProg Price ID: ${item.json.rentprog_price_id || 'нет'}`);
          console.log(`     Season ID: ${item.json.season_id || 'нет'}`);
          if (item.error) {
            console.log(`     ❌ Ошибка: ${item.error.message || item.error}`);
          } else {
            console.log(`     ✅ Успешно`);
          }
        });
      } else {
        console.log('\n  ❌ Цены не сохраняются!');
      }
    } else {
      console.log('⚠️  Нет данных в ноде "Save Prices" (возможно, нет цен для сохранения)');
    }
  }

  // Итоговая проверка
  console.log('\n\n=== 4. ИТОГОВАЯ ПРОВЕРКА ===\n');
  
  const mergeProcessItems = mergeProcess?.data?.output?.[0] || [];
  const pricesInMerge = mergeProcessItems.filter(item => item.json.price_id);
  const pricesInSplit = splitCars?.data?.output?.[0] || [];
  const pricesSaved = savePrices?.data?.output?.[0] || [];
  
  console.log(`Цен в Merge & Process: ${pricesInMerge.length}`);
  console.log(`Цен в Split Cars and Prices (True branch): ${pricesInSplit.length}`);
  console.log(`Цен сохранено в Save Prices: ${pricesSaved.length}`);
  
  if (pricesInMerge.length > 0 && pricesInSplit.length > 0 && pricesSaved.length > 0) {
    console.log('\n✅ ВСЕ РАБОТАЕТ! Цены извлекаются, проходят через workflow и сохраняются!');
  } else if (pricesInMerge.length > 0 && pricesInSplit.length === 0) {
    console.log('\n⚠️  Цены извлекаются, но не проходят через Split Cars and Prices');
  } else if (pricesInMerge.length === 0) {
    console.log('\n❌ Цены НЕ извлекаются из API ответа');
  } else if (pricesInSplit.length > 0 && pricesSaved.length === 0) {
    console.log('\n⚠️  Цены проходят через Split, но не сохраняются');
  }

} catch (error) {
  console.error('❌ Ошибка:', error.message);
  if (error.stack) {
    console.error(error.stack);
  }
}

console.log('\n✅ Проверка завершена');

