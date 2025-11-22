import https from 'https';
import fs from 'fs';

const N8N_API_KEY = process.env.N8N_API_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI";
const N8N_HOST = 'https://n8n.rentflow.rentals';
const WORKFLOW_ID = 'u3cOUuoaH5RSw7hm';

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

async function fixWorkflow() {
  console.log('📥 Получаю текущий workflow...\n');
  
  const workflowData = await apiRequest('GET', `/api/v1/workflows/${WORKFLOW_ID}`);
  const workflow = workflowData.data || workflowData;
  
  if (!workflow || !workflow.nodes) {
    throw new Error('Неверная структура ответа от API');
  }
  
  console.log(`✅ Workflow получен: ${workflow.name}\n`);
  
  // 1. Исправляем ноду "Save Snapshot" - добавляем COALESCE в DO UPDATE SET
  console.log('🔧 1. Исправляю ноду "Save Snapshot" (добавляю COALESCE)...');
  const saveSnapshotNode = workflow.nodes.find(n => n.name === 'Save Snapshot');
  if (!saveSnapshotNode) {
    throw new Error('Нода "Save Snapshot" не найдена');
  }
  
  // Обновляем SQL запрос с COALESCE в DO UPDATE SET
  const newSnapshotSQL = `INSERT INTO rentprog_car_states_snapshot (
          branch_id, rentprog_id, car_name, code, number, vin, color, year,
          transmission, fuel, car_type, car_class, active, state, tank_state,
          clean_state, mileage, tire_type, tire_size, last_inspection, deposit,
          price_hour, hourly_deposit, monthly_deposit, investor_id, purchase_price,
          purchase_date, age_limit, driver_year_limit, franchise, max_fine,
          repair_cost, is_air, climate_control, parktronic, parktronic_camera,
          heated_seats, audio_system, usb_system, rain_sensor, engine_capacity,
          number_doors, tank_value, pts, registration_certificate, body_number,
          company_id, data, fetched_at
        )
        VALUES (
          $1::uuid, 
          $2::text, 
          NULLIF($3, 'null')::text, 
          NULLIF($4, 'null')::text, 
          NULLIF($5, 'null')::text, 
          NULLIF($6, 'null')::text, 
          NULLIF($7, 'null')::text, 
          NULLIF($8, 'null')::text,
          NULLIF($9, 'null')::text, 
          NULLIF($10, 'null')::text, 
          NULLIF($11, 'null')::text, 
          NULLIF($12, 'null')::text, 
          NULLIF($13, 'null')::boolean, 
          NULLIF($14, 'null')::text, 
          NULLIF($15, 'null')::boolean,
          NULLIF($16, 'null')::boolean, 
          NULLIF($17, 'null')::numeric, 
          NULLIF($18, 'null')::numeric, 
          NULLIF($19, 'null')::text, 
          NULLIF($20, 'null')::text, 
          NULLIF($21, 'null')::numeric,
          NULLIF($22, 'null')::numeric, 
          NULLIF($23, 'null')::numeric, 
          NULLIF($24, 'null')::numeric, 
          NULLIF($25, 'null')::numeric, 
          NULLIF($26, 'null')::text,
          NULLIF($27, 'null')::numeric, 
          NULLIF($28, 'null')::numeric, 
          NULLIF($29, 'null')::numeric, 
          NULLIF($30, 'null')::numeric,
          NULLIF($31, 'null')::numeric, 
          NULLIF($32, 'null')::boolean, 
          NULLIF($33, 'null')::boolean, 
          NULLIF($34, 'null')::boolean, 
          NULLIF($35, 'null')::boolean,
          NULLIF($36, 'null')::boolean, 
          NULLIF($37, 'null')::boolean, 
          NULLIF($38, 'null')::boolean, 
          NULLIF($39, 'null')::boolean, 
          NULLIF($40, 'null')::text,
          NULLIF($41, 'null')::numeric, 
          NULLIF($42, 'null')::numeric, 
          NULLIF($43, 'null')::text, 
          NULLIF($44, 'null')::text, 
          NULLIF($45, 'null')::text,
          NULLIF($46, 'null')::text, 
          $47::jsonb, 
          NOW()
        )
        ON CONFLICT ON CONSTRAINT rentprog_car_states_snapshot_pkey
        DO UPDATE SET
          branch_id = EXCLUDED.branch_id,
          car_name = COALESCE(NULLIF(EXCLUDED.car_name, ''), tgt.car_name),
          code = COALESCE(NULLIF(EXCLUDED.code, ''), tgt.code),
          number = COALESCE(NULLIF(EXCLUDED.number, ''), tgt.number),
          vin = COALESCE(NULLIF(EXCLUDED.vin, ''), tgt.vin),
          color = COALESCE(NULLIF(EXCLUDED.color, ''), tgt.color),
          year = COALESCE(EXCLUDED.year, tgt.year),
          transmission = COALESCE(NULLIF(EXCLUDED.transmission, ''), tgt.transmission),
          fuel = COALESCE(NULLIF(EXCLUDED.fuel, ''), tgt.fuel),
          car_type = COALESCE(NULLIF(EXCLUDED.car_type, ''), tgt.car_type),
          car_class = COALESCE(NULLIF(EXCLUDED.car_class, ''), tgt.car_class),
          active = COALESCE(EXCLUDED.active, tgt.active),
          state = COALESCE(NULLIF(EXCLUDED.state, ''), tgt.state),
          tank_state = COALESCE(EXCLUDED.tank_state, tgt.tank_state),
          clean_state = COALESCE(EXCLUDED.clean_state, tgt.clean_state),
          mileage = COALESCE(EXCLUDED.mileage, tgt.mileage),
          tire_type = COALESCE(EXCLUDED.tire_type, tgt.tire_type),
          tire_size = COALESCE(NULLIF(EXCLUDED.tire_size, ''), tgt.tire_size),
          last_inspection = COALESCE(NULLIF(EXCLUDED.last_inspection, ''), tgt.last_inspection),
          deposit = COALESCE(EXCLUDED.deposit, tgt.deposit),
          price_hour = COALESCE(EXCLUDED.price_hour, tgt.price_hour),
          hourly_deposit = COALESCE(EXCLUDED.hourly_deposit, tgt.hourly_deposit),
          monthly_deposit = COALESCE(EXCLUDED.monthly_deposit, tgt.monthly_deposit),
          investor_id = COALESCE(EXCLUDED.investor_id, tgt.investor_id),
          purchase_price = COALESCE(EXCLUDED.purchase_price, tgt.purchase_price),
          purchase_date = COALESCE(NULLIF(EXCLUDED.purchase_date, ''), tgt.purchase_date),
          age_limit = COALESCE(EXCLUDED.age_limit, tgt.age_limit),
          driver_year_limit = COALESCE(EXCLUDED.driver_year_limit, tgt.driver_year_limit),
          franchise = COALESCE(EXCLUDED.franchise, tgt.franchise),
          max_fine = COALESCE(EXCLUDED.max_fine, tgt.max_fine),
          repair_cost = COALESCE(EXCLUDED.repair_cost, tgt.repair_cost),
          is_air = COALESCE(EXCLUDED.is_air, tgt.is_air),
          climate_control = COALESCE(EXCLUDED.climate_control, tgt.climate_control),
          parktronic = COALESCE(EXCLUDED.parktronic, tgt.parktronic),
          parktronic_camera = COALESCE(EXCLUDED.parktronic_camera, tgt.parktronic_camera),
          heated_seats = COALESCE(EXCLUDED.heated_seats, tgt.heated_seats),
          audio_system = COALESCE(EXCLUDED.audio_system, tgt.audio_system),
          usb_system = COALESCE(EXCLUDED.usb_system, tgt.usb_system),
          rain_sensor = COALESCE(EXCLUDED.rain_sensor, tgt.rain_sensor),
          engine_capacity = COALESCE(NULLIF(EXCLUDED.engine_capacity, ''), tgt.engine_capacity),
          number_doors = COALESCE(EXCLUDED.number_doors, tgt.number_doors),
          tank_value = COALESCE(EXCLUDED.tank_value, tgt.tank_value),
          pts = COALESCE(NULLIF(EXCLUDED.pts, ''), tgt.pts),
          registration_certificate = COALESCE(NULLIF(EXCLUDED.registration_certificate, ''), tgt.registration_certificate),
          body_number = COALESCE(NULLIF(EXCLUDED.body_number, ''), tgt.body_number),
          company_id = COALESCE(NULLIF(EXCLUDED.company_id, ''), tgt.company_id),
          data = COALESCE(EXCLUDED.data, tgt.data),
          fetched_at = NOW()
        RETURNING rentprog_id;`;
  
  saveSnapshotNode.parameters.query = newSnapshotSQL;
  console.log('✅ Нода "Save Snapshot" обновлена с COALESCE\n');
  
  // 2. Исправляем ноду "Merge & Process" - добавляем фильтрацию undefined
  console.log('🔧 2. Исправляю ноду "Merge & Process" (добавляю фильтрацию undefined)...');
  const mergeProcessNode = workflow.nodes.find(n => n.id === '37a107c9-4431-44ac-88c6-3dd1e51951b3');
  if (!mergeProcessNode) {
    throw new Error('Нода "Merge & Process" не найдена');
  }
  
  // Обновляем код - добавляем функцию safeValue и используем её для строковых полей
  const updatedCode = `const results = [];
const priceResults = [];

// Функция для безопасного извлечения значений (фильтрует undefined, null, пустые строки)
const safeValue = (value) => {
  if (value === undefined || value === null || value === '') {
    return undefined;  // Не передаем в SQL, чтобы не затереть существующие данные
  }
  return value;
};

// Маппинг branch code → UUID
const BRANCH_MAP = {
  'tbilisi': '277eaada-1428-4c04-9cd7-5e614e43bedc',
  'batumi': '627c4c88-d8a1-47bf-b9a6-2e9ad33112a4',
  'kutaisi': '5e551b32-934c-498f-a4a1-a90079985c0a',
  'service-center': '6026cff7-eee8-4fb9-be26-604f308911f0'
};

for (const item of $input.all()) {
  const branchCode = item.json.branch;
  const branchId = BRANCH_MAP[branchCode];
  const responseData = item.json;
  
  // Извлекаем included (цены и сезоны)
  const included = responseData.included || [];
  const prices = included.filter(item => item.type === 'price');
  const seasons = included.filter(item => item.type === 'season');
  
  // Создаем маппинг цен по car_id
  const pricesByCarId = {};
  for (const price of prices) {
    const carId = price.attributes?.car_id;
    const seasonId = price.attributes?.season_id;
    if (carId) {
      if (!pricesByCarId[carId]) {
        pricesByCarId[carId] = [];
      }
      pricesByCarId[carId].push({
        id: price.id,
        season_id: seasonId,
        values: price.attributes?.values || []
      });
    }
  }
  
  // API возвращает массив cars или объект с data.cars
  let carsData = [];
  
  if (Array.isArray(responseData)) {
    carsData = responseData;
  } else if (responseData.data && Array.isArray(responseData.data)) {
    carsData = responseData.data;
  } else if (responseData.cars && Array.isArray(responseData.cars)) {
    carsData = responseData.cars;
  } else if (responseData.cars && Array.isArray(responseData.cars.data)) {
    carsData = responseData.cars.data;
  } else if (responseData.data && responseData.data.cars && Array.isArray(responseData.data.cars)) {
    carsData = responseData.data.cars;
  } else if (responseData.data && responseData.data.cars && Array.isArray(responseData.data.cars.data)) {
    carsData = responseData.data.cars.data;
  }
  
  if (carsData.length === 0) {
    results.push({
      json: {
        branch_code: branchCode,
        branch_id: branchId,
        error: true,
        error_message: 'No cars data in response'
      }
    });
    continue;
  }
  
  // Обрабатываем каждый автомобиль
  for (const car of carsData) {
    // Извлекаем attributes если это JSON:API формат
    const attrs = car.attributes || car;
    const carId = attrs.id || car.id;
    
    // Получаем цены для этой машины
    const carPrices = pricesByCarId[carId] || [];
    
    results.push({
      json: {
        branch_code: branchCode,
        branch_id: branchId,
        rentprog_id: carId,
        car_name: safeValue(attrs.car_name || attrs.name),
        code: safeValue(attrs.code),
        number: safeValue(attrs.number),
        
        // Основные характеристики
        vin: safeValue(attrs.vin),
        color: safeValue(attrs.color),
        year: attrs.year,
        transmission: safeValue(attrs.transmission),
        fuel: safeValue(attrs.fuel),
        car_type: safeValue(attrs.car_type),
        car_class: safeValue(attrs.car_class),
        
        // Состояния и статусы
        active: attrs.active,
        state: safeValue(attrs.state),
        tank_state: attrs.tank_state,
        clean_state: attrs.clean_state,
        
        // Пробег и ТО
        mileage: attrs.mileage,
        tire_type: attrs.tire_type,
        tire_size: safeValue(attrs.tire_size),
        last_inspection: safeValue(attrs.last_inspection),
        
        // Цены и финансы
        deposit: attrs.deposit,
        price_hour: attrs.price_hour,
        hourly_deposit: attrs.hourly_deposit,
        monthly_deposit: attrs.monthly_deposit,
        investor_id: attrs.investor_id,
        purchase_price: attrs.purchase_price,
        purchase_date: safeValue(attrs.purchase_date),
        
        // Ограничения
        age_limit: attrs.age_limit,
        driver_year_limit: attrs.driver_year_limit,
        franchise: attrs.franchise,
        max_fine: attrs.max_fine,
        repair_cost: attrs.repair_cost,
        
        // Опции и оборудование
        is_air: attrs.is_air,
        climate_control: attrs.climate_control,
        parktronic: attrs.parktronic,
        parktronic_camera: attrs.parktronic_camera,
        heated_seats: attrs.heated_seats,
        audio_system: attrs.audio_system,
        usb_system: attrs.usb_system,
        rain_sensor: attrs.rain_sensor,
        
        // Технические детали
        engine_capacity: safeValue(attrs.engine_capacity),
        number_doors: attrs.number_doors,
        tank_value: attrs.tank_value,
        
        // Документы
        pts: safeValue(attrs.pts),
        registration_certificate: safeValue(attrs.registration_certificate),
        body_number: safeValue(attrs.body_number),
        
        // Полный JSON
        data: attrs,
        error: false
      }
    });
    
    // Добавляем цены для сохранения
    for (const price of carPrices) {
      priceResults.push({
        json: {
          branch_code: branchCode,
          branch_id: branchId,
          rentprog_id: carId,
          price_id: price.id,
          season_id: price.season_id,
          values: price.values,
          values_json: JSON.stringify(price.values)
        }
      });
    }
  }
}

// Возвращаем и машины, и цены
return [...results, ...priceResults];`;
  
  mergeProcessNode.parameters.jsCode = updatedCode;
  console.log('✅ Нода "Merge & Process" обновлена с фильтрацией undefined\n');
  
  // 3. Добавляем ноду для сохранения в основную таблицу cars
  console.log('🔧 3. Добавляю ноду для сохранения в основную таблицу cars...');
  
  // Находим ноду "Save Snapshot" для определения позиции
  const saveSnapshotPosition = saveSnapshotNode.position;
  
  // Создаем новую ноду "Save to Cars"
  const saveCarsNode = {
    parameters: {
      operation: 'executeQuery',
      query: `SELECT * FROM dynamic_upsert_entity(
  'cars'::TEXT,
  $1::TEXT,
  $2::JSONB
);`,
      options: {
        queryReplacement: "={{ $json.rentprog_id }},={{ $json.data ? JSON.stringify($json.data) : '{}' }}"
      }
    },
    name: 'Save to Cars',
    type: 'n8n-nodes-base.postgres',
    typeVersion: 2.4,
    position: [saveSnapshotPosition[0] + 400, saveSnapshotPosition[1]],
    id: 'save-to-cars-fix',
    credentials: {
      postgres: {
        id: '3I9fyXVlGg4Vl4LZ',
        name: 'Postgres account'
      }
    }
  };
  
  workflow.nodes.push(saveCarsNode);
  
  // Обновляем connections - добавляем связь от "Save Snapshot" к "Save to Cars"
  // Находим текущую связь от "Save Snapshot" к "Pass Through Data"
  const saveSnapshotConn = workflow.connections['Save Snapshot'];
  if (saveSnapshotConn && saveSnapshotConn.main && saveSnapshotConn.main[0]) {
    // Сохраняем старую связь для проверки
    const oldConn = saveSnapshotConn.main[0][0];
    
    // Обновляем связь: Save Snapshot -> Save to Cars
    saveSnapshotConn.main[0] = [{
      node: 'Save to Cars',
      type: 'main',
      index: 0
    }];
    
    // Добавляем связь: Save to Cars -> Pass Through Data
    workflow.connections['Save to Cars'] = {
      main: [[{
        node: oldConn ? oldConn.node : 'Pass Through Data',
        type: 'main',
        index: 0
      }]]
    };
  } else {
    // Если связи нет, создаем новую
    workflow.connections['Save Snapshot'] = {
      main: [[{
        node: 'Save to Cars',
        type: 'main',
        index: 0
      }]]
    };
    workflow.connections['Save to Cars'] = {
      main: [[{
        node: 'Pass Through Data',
        type: 'main',
        index: 0
      }]]
    };
  }
  
  console.log('✅ Нода "Save to Cars" добавлена\n');
  
  // Очищаем системные поля перед обновлением
  const cleanWorkflow = {
    name: workflow.name,
    nodes: workflow.nodes,
    connections: workflow.connections,
    settings: workflow.settings
  };
  
  // Удаляем id из нод (кроме тех, что нужны для connections)
  cleanWorkflow.nodes.forEach(node => {
    // Сохраняем id только для существующих нод, которые используются в connections
    if (node.id && node.id !== 'save-to-cars-fix') {
      // Оставляем id для существующих нод
    }
  });
  
  console.log('📤 Обновляю workflow в n8n...\n');
  
  const updateResult = await apiRequest('PUT', `/api/v1/workflows/${WORKFLOW_ID}`, cleanWorkflow);
  
  console.log('✅ Workflow успешно обновлен!\n');
  console.log('📋 Сводка изменений:');
  console.log('  1. ✅ Нода "Save Snapshot" - добавлен COALESCE в DO UPDATE SET');
  console.log('  2. ✅ Нода "Merge & Process" - добавлена фильтрация undefined значений');
  console.log('  3. ✅ Нода "Save to Cars" - добавлена для сохранения в основную таблицу cars');
  console.log('\n🎉 Все исправления применены!');
}

fixWorkflow()
  .then(() => {
    console.log('\n✅ Готово!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Ошибка:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  });

