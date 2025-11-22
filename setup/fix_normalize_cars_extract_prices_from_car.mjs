import https from 'https';

const N8N_API_KEY = process.env.N8N_API_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI";
const N8N_HOST = 'https://n8n.rentflow.rentals';
const WORKFLOW_ID = 'ihRLR0QCJySx319b';

function apiRequest(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, N8N_HOST);
    const options = {
      method,
      headers: {
        'X-N8N-API-KEY': N8N_API_KEY,
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(url, options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(body));
          } catch (e) {
            resolve(body);
          }
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${body}`));
        }
      });
    });

    req.on('error', reject);
    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

async function fixNormalizeCarsExtractPricesFromCar() {
  console.log('📥 Получаю текущий workflow...\n');
  
  const workflowData = await apiRequest('GET', `/api/v1/workflows/${WORKFLOW_ID}`);
  const workflow = workflowData.data || workflowData;
  
  if (!workflow || !workflow.nodes) {
    throw new Error('Неверная структура ответа от API');
  }
  
  console.log(`✅ Workflow получен: ${workflow.name}\n`);
  
  // Исправляем ноду "Normalize Cars" - извлекаем цены из массива prices внутри каждого автомобиля
  console.log('🔧 Исправляю ноду "Normalize Cars" (извлечение цен из prices массива)...');
  const normalizeNode = workflow.nodes.find(n => n.id === 'b28f2471-e845-47dc-aa9c-95da0f075a06');
  if (!normalizeNode) {
    throw new Error('Нода "Normalize Cars" не найдена');
  }
  
  // API all_cars_full возвращает массив машин, где каждая машина имеет массив prices
  // Структура: car.prices = [{ id, values: [...], car_id, season_id, ... }]
  const updatedCode = `const results = [];
const priceResults = [];
const stats = { branches: {}, cars: 0 };

// Обрабатываем данные от "Merge All Branches"
// Каждый элемент - это данные одного филиала: { branch_code, branch_id, cars: [...] }
for (const item of $input.all()) {
  const branchCode = item.json.branch_code || item.json.branch;
  const branchId = item.json.branch_id;
  
  // Получаем массив машин из ответа
  let cars = [];
  const responseData = item.json;
  
  // API может вернуть массив напрямую или в поле cars/data
  if (Array.isArray(responseData)) {
    cars = responseData;
  } else if (Array.isArray(responseData.cars)) {
    cars = responseData.cars;
  } else if (Array.isArray(responseData.data)) {
    cars = responseData.data;
  } else if (responseData.cars && Array.isArray(responseData.cars.data)) {
    cars = responseData.cars.data;
  } else if (responseData.data && Array.isArray(responseData.data.cars)) {
    cars = responseData.data.cars;
  }
  
  // Также пробуем извлечь included (на случай если API вернет в этом формате)
  let included = [];
  if (responseData.included && Array.isArray(responseData.included)) {
    included = responseData.included;
  } else if (responseData.cars && responseData.cars.included && Array.isArray(responseData.cars.included)) {
    included = responseData.cars.included;
  } else if (responseData.data && responseData.data.included && Array.isArray(responseData.data.included)) {
    included = responseData.data.included;
  }
  
  const pricesFromIncluded = included.filter(item => item.type === 'price');
  const seasonsFromIncluded = included.filter(item => item.type === 'season');
  
  // Создаем маппинг сезонов по ID (из included)
  const seasonsMap = {};
  for (const season of seasonsFromIncluded) {
    const seasonId = season.id || season.attributes?.id;
    if (seasonId) {
      seasonsMap[seasonId] = {
        id: seasonId,
        name: season.attributes?.name || season.name,
        start_date: season.attributes?.start_date || season.start_date,
        end_date: season.attributes?.end_date || season.end_date
      };
    }
  }
  
  // Создаем маппинг цен по car_id из included (на случай если есть)
  const pricesByCarIdFromIncluded = {};
  for (const price of pricesFromIncluded) {
    const carId = price.attributes?.car_id || price.car_id;
    const seasonId = price.attributes?.season_id || price.season_id;
    if (carId) {
      const carIdKey = typeof carId === 'string' ? parseInt(carId, 10) : carId;
      if (!isNaN(carIdKey)) {
        if (!pricesByCarIdFromIncluded[carIdKey]) {
          pricesByCarIdFromIncluded[carIdKey] = [];
        }
        pricesByCarIdFromIncluded[carIdKey].push({
          id: price.id,
          season_id: seasonId,
          values: price.attributes?.values || price.values || []
        });
      }
    }
  }
  
  if (!stats.branches[branchCode]) {
    stats.branches[branchCode] = { cars: 0 };
  }
  
  stats.cars += cars.length;
  stats.branches[branchCode].cars += cars.length;
  
  // Обрабатываем каждую машину
  for (const car of cars) {
    const attrs = car.attributes || car;
    const rentprogId = String(attrs.id || car.id || '');
    
    results.push({ json: {
      branch_code: branchCode,
      branch_id: branchId,
      rentprog_id: rentprogId,
      car_name: attrs.car_name || attrs.name || null,
      code: attrs.code || null,
      number: attrs.number || null,
      vin: attrs.vin || null,
      color: attrs.color || null,
      year: attrs.year ?? null,
      transmission: attrs.transmission || null,
      fuel: attrs.fuel || null,
      car_type: attrs.car_type || null,
      car_class: attrs.car_class || null,
      active: attrs.active,
      state: attrs.state,
      tank_state: attrs.tank_state,
      clean_state: attrs.clean_state,
      mileage: attrs.mileage,
      tire_type: attrs.tire_type,
      tire_size: attrs.tire_size || null,
      last_inspection: attrs.last_inspection || null,
      deposit: attrs.deposit,
      price_hour: attrs.price_hour,
      hourly_deposit: attrs.hourly_deposit,
      monthly_deposit: attrs.monthly_deposit,
      investor_id: attrs.investor_id,
      purchase_price: attrs.purchase_price,
      purchase_date: attrs.purchase_date,
      age_limit: attrs.age_limit,
      driver_year_limit: attrs.driver_year_limit,
      franchise: attrs.franchise,
      max_fine: attrs.max_fine,
      repair_cost: attrs.repair_cost,
      is_air: attrs.is_air,
      climate_control: attrs.climate_control,
      parktronic: attrs.parktronic,
      parktronic_camera: attrs.parktronic_camera,
      heated_seats: attrs.heated_seats,
      audio_system: attrs.audio_system,
      usb_system: attrs.usb_system,
      rain_sensor: attrs.rain_sensor,
      engine_capacity: attrs.engine_capacity,
      number_doors: attrs.number_doors,
      tank_value: attrs.tank_value,
      pts: attrs.pts,
      registration_certificate: attrs.registration_certificate,
      body_number: attrs.body_number,
      data: attrs
    } });
    
    // ИЗВЛЕКАЕМ ЦЕНЫ ИЗ МАССИВА prices ВНУТРИ КАЖДОГО АВТОМОБИЛЯ
    // API all_cars_full возвращает цены в car.prices, а не в included
    const carPrices = attrs.prices || car.prices || [];
    
    // Также пробуем получить цены из included (если есть)
    const carIdNum = rentprogId ? (typeof rentprogId === 'string' ? parseInt(rentprogId, 10) : rentprogId) : null;
    const pricesFromIncludedForCar = (carIdNum && !isNaN(carIdNum) ? pricesByCarIdFromIncluded[carIdNum] : null) || pricesByCarIdFromIncluded[rentprogId] || [];
    
    // Объединяем цены из prices массива и из included
    const allCarPrices = [...carPrices, ...pricesFromIncludedForCar];
    
    // Добавляем цены для сохранения
    for (const price of allCarPrices) {
      // Проверяем структуру цены
      const priceId = price.id;
      const seasonId = price.season_id;
      const values = price.values || [];
      
      // Проверяем, что есть values и они не пустые
      if (Array.isArray(values) && values.length > 0 && !values.every(v => v === null || v === undefined || v === '' || v === 0)) {
        priceResults.push({
          json: {
            branch_code: branchCode,
            branch_id: branchId,
            rentprog_id: rentprogId,
            price_id: String(priceId), // Преобразуем в строку для совместимости с IF нодой
            season_id: seasonId,
            season_name: seasonsMap[seasonId]?.name || null,
            season_start_date: seasonsMap[seasonId]?.start_date || null,
            season_end_date: seasonsMap[seasonId]?.end_date || null,
            values: values,
            values_json: JSON.stringify(values)
          }
        });
      }
    }
  }
}

const staticData = $getWorkflowStaticData('global');
staticData.carStats = stats;
staticData.priceStats = { prices: priceResults.length };

if (!results.length) {
  results.push({ json: { __statsOnly: true } });
}

// Возвращаем и машины, и цены
return [...results, ...priceResults];`;
  
  normalizeNode.parameters.jsCode = updatedCode;
  console.log('✅ Нода "Normalize Cars" обновлена с извлечением цен из prices массива\n');
  
  // Очищаем системные поля перед обновлением
  const cleanWorkflow = {
    name: workflow.name,
    nodes: workflow.nodes,
    connections: workflow.connections,
    settings: workflow.settings
  };
  
  console.log('📤 Обновляю workflow в n8n...\n');
  
  const updateResult = await apiRequest('PUT', `/api/v1/workflows/${WORKFLOW_ID}`, cleanWorkflow);
  
  console.log('✅ Workflow успешно обновлен!\n');
  console.log('📋 Изменения:');
  console.log('  ✅ Исправлено извлечение цен из массива prices внутри каждого автомобиля');
  console.log('  ✅ Добавлена поддержка цен из included (если есть)');
  console.log('  ✅ Добавлена проверка на пустые значения цен');
  console.log('\n✅ Готово!');
}

fixNormalizeCarsExtractPricesFromCar()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Ошибка:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  });

