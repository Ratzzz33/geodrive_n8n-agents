import fs from 'fs';

const executionFile = 'c:/Users/33pok/.cursor/projects/c-Users-33pok-geodrive-n8n-agents/agent-tools/3c585342-d541-4df3-8ba5-d78e675c35f3.txt';

console.log('📥 Читаю execution файл...\n');

const data = JSON.parse(fs.readFileSync(executionFile, 'utf8'));
const nodes = data.data.nodes;

// Проверяем ноду "Merge & Process"
console.log('=== 1. НОДА "Merge & Process" ===\n');
const mergeProcess = nodes['Merge & Process'];
if (mergeProcess && mergeProcess.data && mergeProcess.data.output && mergeProcess.data.output[0]) {
  const items = mergeProcess.data.output[0];
  console.log(`Всего элементов: ${items.length}`);
  
  // Берем несколько примеров
  const samples = items.slice(0, 3);
  samples.forEach((item, idx) => {
    console.log(`\n--- Пример ${idx + 1} ---`);
    const json = item.json;
    
    // Проверяем на пустые значения
    const emptyFields = [];
    Object.keys(json).forEach(key => {
      const value = json[key];
      if (value === null || value === undefined || value === '') {
        emptyFields.push(key);
      }
    });
    
    console.log(`rentprog_id: ${json.rentprog_id}`);
    console.log(`car_name: ${json.car_name || '(пусто)'}`);
    console.log(`vin: ${json.vin || '(пусто)'}`);
    console.log(`code: ${json.code || '(пусто)'}`);
    console.log(`number: ${json.number || '(пусто)'}`);
    console.log(`data: ${json.data ? 'есть (JSONB)' : 'отсутствует'}`);
    
    if (emptyFields.length > 0) {
      console.log(`⚠️  Пустые поля: ${emptyFields.join(', ')}`);
    } else {
      console.log('✅ Нет пустых полей в основных данных');
    }
  });
} else {
  console.log('❌ Нет данных в ноде "Merge & Process"');
}

// Проверяем ноду "Save to Cars"
console.log('\n\n=== 2. НОДА "Save to Cars" ===\n');
const saveToCars = nodes['Save to Cars'];
if (saveToCars && saveToCars.data && saveToCars.data.output && saveToCars.data.output[0]) {
  const items = saveToCars.data.output[0];
  console.log(`Всего элементов: ${items.length}`);
  
  // Берем несколько примеров
  const samples = items.slice(0, 3);
  samples.forEach((item, idx) => {
    console.log(`\n--- Результат ${idx + 1} ---`);
    const json = item.json;
    console.log(`entity_id: ${json.entity_id || '(нет)'}`);
    console.log(`created: ${json.created}`);
    console.log(`added_columns: ${json.added_columns ? json.added_columns.join(', ') : 'нет'}`);
    
    if (json.error) {
      console.log(`❌ Ошибка: ${json.error}`);
    } else {
      console.log('✅ Успешно сохранено');
    }
  });
} else {
  console.log('❌ Нет данных в ноде "Save to Cars"');
}

// Проверяем ноду "Split Cars and Prices"
console.log('\n\n=== 3. НОДА "Split Cars and Prices" ===\n');
const splitCars = nodes['Split Cars and Prices'];
if (splitCars && splitCars.data) {
  console.log(`Статус: ${splitCars.status}`);
  if (splitCars.data.output) {
    const trueBranch = splitCars.data.output[0] || []; // True branch (цены)
    const falseBranch = splitCars.data.output[1] || []; // False branch (машины)
    console.log(`True branch (цены): ${trueBranch.length} элементов`);
    console.log(`False branch (машины): ${falseBranch.length} элементов`);
  }
}

// Проверяем ноду "Save Prices"
console.log('\n\n=== 4. НОДА "Save Prices" ===\n');
const savePrices = nodes['Save Prices'];
if (savePrices && savePrices.data && savePrices.data.output && savePrices.data.output[0]) {
  const items = savePrices.data.output[0];
  console.log(`Всего сохранено цен: ${items.length}`);
  
  if (items.length > 0) {
    const sample = items[0];
    console.log(`Пример цены:`);
    console.log(`  car_id: ${sample.json.car_id || '(нет)'}`);
    console.log(`  rentprog_price_id: ${sample.json.rentprog_price_id || '(нет)'}`);
    console.log(`  season_id: ${sample.json.season_id || '(нет)'}`);
    console.log(`  price_values: ${sample.json.price_values ? 'есть' : 'нет'}`);
  }
} else {
  console.log('⚠️  Нет данных в ноде "Save Prices" (возможно, нет цен для сохранения)');
}

// Итоговая проверка
console.log('\n\n=== 5. ИТОГОВАЯ ПРОВЕРКА ===\n');

// Проверяем, что все данные из Merge & Process дошли до Save to Cars
if (mergeProcess && saveToCars) {
  const mergeCount = mergeProcess.data?.output?.[0]?.length || 0;
  const saveCount = saveToCars.data?.output?.[0]?.length || 0;
  
  // Фильтруем только машины (не цены)
  const carsOnly = mergeProcess.data?.output?.[0]?.filter(item => !item.json.price_id) || [];
  const carsCount = carsOnly.length;
  
  console.log(`Машин в Merge & Process: ${carsCount}`);
  console.log(`Результатов в Save to Cars: ${saveCount}`);
  
  if (carsCount === saveCount) {
    console.log('✅ Все машины сохранены');
  } else {
    console.log(`⚠️  Несоответствие: ${carsCount} машин, но ${saveCount} результатов`);
  }
}

console.log('\n✅ Проверка завершена');

