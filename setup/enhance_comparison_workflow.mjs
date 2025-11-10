#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const workflowPath = path.join(__dirname, '..', 'n8n-workflows', 'rentprog-car-states-reconciliation-v2.json');
const workflow = JSON.parse(fs.readFileSync(workflowPath, 'utf-8'));

console.log('🔧 Расширение сравнения: все параметры + цены\n');

// 1. Обновляем SQL запрос "Get Cars from DB" - добавляем все поля
const getCarsFromDBNode = workflow.nodes.find(n => n.id === 'get-cars-from-db');
if (getCarsFromDBNode) {
  const newQuery = `SELECT
  c.id AS car_db_id,
  c.branch_id AS branch_id,
  er.external_id::text AS rentprog_id,
  c.company_id::text AS company_id,
  c.model AS model,
  c.plate AS plate,
  c.state AS state,
  c.transmission AS transmission,
  c.year AS year,
  c.number_doors AS number_doors,
  c.number_seats AS number_seats,
  c.is_air AS is_air,
  c.engine_capacity AS engine_capacity,
  c.engine_power AS engine_power,
  c.trunk_volume AS trunk_volume,
  c.avatar_url AS avatar_url,
  c.color AS color,
  c.mileage AS mileage,
  c.car_type AS car_type,
  c.interior AS interior,
  c.car_class AS car_class,
  c.code AS code,
  c.drive_unit AS drive_unit,
  c.steering_side AS steering_side,
  c.tire_size AS tire_size,
  c.tire_type AS tire_type,
  c.franchise AS franchise,
  c.max_fine AS max_fine,
  c.insurance AS insurance,
  c.start_mileage AS start_mileage,
  c.registration_certificate AS registration_certificate,
  c.tank_value AS tank_value,
  c.gas_mileage AS gas_mileage,
  c.repair_cost AS repair_cost,
  c.store_place AS store_place,
  c.pts AS pts,
  c.roof AS roof,
  c.custom_field_1 AS custom_field_1,
  c.custom_field_2 AS custom_field_2,
  c.custom_field_3 AS custom_field_3,
  c.window_lifters AS window_lifters,
  c.extra_mileage_km AS extra_mileage_km,
  c.extra_mileage_price AS extra_mileage_price,
  c.body_number AS body_number,
  c.abs AS abs,
  c.ebd AS ebd,
  c.esp AS esp,
  c.cd_system AS cd_system,
  c.tv_system AS tv_system,
  c.parktronic AS parktronic,
  c.parktronic_back AS parktronic_back,
  c.parktronic_camera AS parktronic_camera,
  c.tank_state AS tank_state,
  c.heated_seats AS heated_seats,
  c.heated_seats_front AS heated_seats_front,
  c.clean_state AS clean_state,
  c.audio_system AS audio_system,
  c.video_system AS video_system,
  c.folding_seats AS folding_seats,
  c.climate_control AS climate_control,
  c.usb_system AS usb_system,
  c.rain_sensor AS rain_sensor,
  c.wheel_adjustment AS wheel_adjustment,
  c.wheel_adjustment_full AS wheel_adjustment_full,
  c.heated_windshield AS heated_windshield,
  c.is_electropackage AS is_electropackage,
  c.fuel AS fuel,
  b.code AS branch_code,
  -- Цены (JSONB агрегация)
  COALESCE(
    json_agg(
      json_build_object(
        'season_id', cp.season_id,
        'season_name', cp.season_name,
        'price_values', cp.price_values,
        'active', cp.active
      )
      ORDER BY cp.season_id
    ) FILTER (WHERE cp.id IS NOT NULL),
    '[]'::json
  ) AS prices
FROM cars c
JOIN external_refs er ON er.entity_id = c.id
JOIN branches b ON b.id = c.branch_id
LEFT JOIN car_prices cp ON cp.car_id = c.id AND cp.active = TRUE
WHERE er.system = 'rentprog'
  AND er.entity_type = 'car'
GROUP BY
  c.id, c.branch_id, er.external_id, c.company_id, c.model, c.plate, c.state,
  c.transmission, c.year, c.number_doors, c.number_seats, c.is_air,
  c.engine_capacity, c.engine_power, c.trunk_volume, c.avatar_url,
  c.color, c.mileage, c.car_type, c.interior, c.car_class, c.code,
  c.drive_unit, c.steering_side, c.tire_size, c.tire_type, c.franchise,
  c.max_fine, c.insurance, c.start_mileage, c.registration_certificate,
  c.tank_value, c.gas_mileage, c.repair_cost, c.store_place, c.pts, c.roof,
  c.custom_field_1, c.custom_field_2, c.custom_field_3, c.window_lifters,
  c.extra_mileage_km, c.extra_mileage_price, c.body_number,
  c.abs, c.ebd, c.esp, c.cd_system, c.tv_system, c.parktronic,
  c.parktronic_back, c.parktronic_camera, c.tank_state, c.heated_seats,
  c.heated_seats_front, c.clean_state, c.audio_system, c.video_system,
  c.folding_seats, c.climate_control, c.usb_system, c.rain_sensor,
  c.wheel_adjustment, c.wheel_adjustment_full, c.heated_windshield,
  c.is_electropackage, c.fuel, b.code`;

  getCarsFromDBNode.parameters.query = newQuery;
  console.log('✅ Обновлен SQL запрос "Get Cars from DB" - добавлены все поля + цены');
}

// 2. Обновляем узел "Compare API vs DB" - расширенное сравнение
const compareNode = workflow.nodes.find(n => n.id === 'compare-api-db');
if (compareNode) {
  const newCode = `// Расширенное сравнение данных из API с БД (все параметры + цены)
const apiItems = $input.all(0).map(item => item.json);
const dbItems = $input.all(1).map(item => item.json);

// Нормализация значений
const normalize = (val) => {
  if (val === null || val === undefined || val === '') return null;
  const str = String(val).trim();
  return str === '' || str.toLowerCase() === 'null' ? null : str;
};

// Нормализация boolean
const normalizeBool = (val) => {
  if (val === true || val === 'true' || val === '1' || val === 1) return 'true';
  if (val === false || val === 'false' || val === '0' || val === 0) return 'false';
  return null;
};

// Мапа машин из БД по rentprog_id (строка)
const dbMap = new Map();
dbItems.forEach(car => {
  if (car && car.rentprog_id) {
    const key = String(car.rentprog_id).trim();
    if (key) {
      dbMap.set(key, car);
    }
  }
});

// Дополнительная мапа по plate (на случай если rentprog_id не совпадает)
const dbMapByPlate = new Map();
dbItems.forEach(car => {
  if (car && car.plate) {
    const key = String(car.plate).trim().toUpperCase();
    if (key) {
      dbMapByPlate.set(key, car);
    }
  }
});

const discrepancies = [];

// Поля для сравнения с русскими названиями
const fieldMapping = {
  // Основные
  company_id: { api: 'company_id', db: 'company_id', name: 'Компания' },
  car_name: { api: 'car_name', db: 'model', name: 'Модель' },
  number: { api: 'number', db: 'plate', name: 'Номер' },
  state: { api: 'state', db: 'state', name: 'Статус' },
  transmission: { api: 'transmission', db: 'transmission', name: 'Трансмиссия' },
  year: { api: 'year', db: 'year', name: 'Год' },
  color: { api: 'color', db: 'color', name: 'Цвет' },
  mileage: { api: 'mileage', db: 'mileage', name: 'Пробег' },
  car_type: { api: 'car_type', db: 'car_type', name: 'Тип кузова' },
  interior: { api: 'interior', db: 'interior', name: 'Салон' },
  car_class: { api: 'car_class', db: 'car_class', name: 'Класс' },
  code: { api: 'code', db: 'code', name: 'Код' },
  drive_unit: { api: 'drive_unit', db: 'drive_unit', name: 'Привод' },
  steering_side: { api: 'steering_side', db: 'steering_side', name: 'Руль' },
  fuel: { api: 'fuel', db: 'fuel', name: 'Топливо' },
  
  // Характеристики
  number_doors: { api: 'number_doors', db: 'number_doors', name: 'Кол-во дверей' },
  number_seats: { api: 'number_seats', db: 'number_seats', name: 'Кол-во мест' },
  engine_capacity: { api: 'engine_capacity', db: 'engine_capacity', name: 'Объём двигателя' },
  engine_power: { api: 'engine_power', db: 'engine_power', name: 'Мощность' },
  trunk_volume: { api: 'trunk_volume', db: 'trunk_volume', name: 'Объём багажника' },
  tire_size: { api: 'tire_size', db: 'tire_size', name: 'Размер шин' },
  tire_type: { api: 'tire_type', db: 'tire_type', name: 'Тип шин' },
  gas_mileage: { api: 'gas_mileage', db: 'gas_mileage', name: 'Расход топлива' },
  
  // Дополнительные
  vin: { api: 'vin', db: 'vin', name: 'VIN' },
  body_number: { api: 'body_number', db: 'body_number', name: 'Номер кузова' },
  pts: { api: 'pts', db: 'pts', name: 'ПТС' },
  registration_certificate: { api: 'registration_certificate', db: 'registration_certificate', name: 'Свидетельство' },
  start_mileage: { api: 'start_mileage', db: 'start_mileage', name: 'Начальный пробег' },
  tank_value: { api: 'tank_value', db: 'tank_value', name: 'Объём бака' },
  franchise: { api: 'franchise', db: 'franchise', name: 'Франшиза' },
  max_fine: { api: 'max_fine', db: 'max_fine', name: 'Макс. штраф' },
  repair_cost: { api: 'repair_cost', db: 'repair_cost', name: 'Стоимость ремонта' },
  store_place: { api: 'store_place', db: 'store_place', name: 'Место хранения' },
  roof: { api: 'roof', db: 'roof', name: 'Крыша' },
  custom_field_1: { api: 'custom_field_1', db: 'custom_field_1', name: 'Поле 1' },
  custom_field_2: { api: 'custom_field_2', db: 'custom_field_2', name: 'Поле 2' },
  custom_field_3: { api: 'custom_field_3', db: 'custom_field_3', name: 'Поле 3' },
  window_lifters: { api: 'window_lifters', db: 'window_lifters', name: 'Стекла' },
  extra_mileage_km: { api: 'extra_mileage_km', db: 'extra_mileage_km', name: 'Доп. пробег (км)' },
  extra_mileage_price: { api: 'extra_mileage_price', db: 'extra_mileage_price', name: 'Доп. пробег (цена)' },
  insurance: { api: 'insurance', db: 'insurance', name: 'Страховка' },
  avatar_url: { api: 'avatar_url', db: 'avatar_url', name: 'Аватар' },
  
  // Boolean поля
  is_air: { api: 'is_air', db: 'is_air', name: 'Кондиционер', isBool: true },
  abs: { api: 'abs', db: 'abs', name: 'ABS', isBool: true },
  ebd: { api: 'ebd', db: 'ebd', name: 'EBD', isBool: true },
  esp: { api: 'esp', db: 'esp', name: 'ESP', isBool: true },
  is_electropackage: { api: 'is_electropackage', db: 'is_electropackage', name: 'Электропакет', isBool: true },
  cd_system: { api: 'cd_system', db: 'cd_system', name: 'CD', isBool: true },
  tv_system: { api: 'tv_system', db: 'tv_system', name: 'TV', isBool: true },
  parktronic: { api: 'parktronic', db: 'parktronic', name: 'Парктроник', isBool: true },
  parktronic_back: { api: 'parktronic_back', db: 'parktronic_back', name: 'Парктроник задний', isBool: true },
  parktronic_camera: { api: 'parktronic_camera', db: 'parktronic_camera', name: 'Камера', isBool: true },
  tank_state: { api: 'tank_state', db: 'tank_state', name: 'Состояние бака', isBool: true },
  heated_seats: { api: 'heated_seats', db: 'heated_seats', name: 'Подогрев сидений', isBool: true },
  heated_seats_front: { api: 'heated_seats_front', db: 'heated_seats_front', name: 'Подогрев передних', isBool: true },
  clean_state: { api: 'clean_state', db: 'clean_state', name: 'Чистота', isBool: true },
  audio_system: { api: 'audio_system', db: 'audio_system', name: 'Аудио', isBool: true },
  video_system: { api: 'video_system', db: 'video_system', name: 'Видео', isBool: true },
  folding_seats: { api: 'folding_seats', db: 'folding_seats', name: 'Складные сиденья', isBool: true },
  climate_control: { api: 'climate_control', db: 'climate_control', name: 'Климат-контроль', isBool: true },
  usb_system: { api: 'usb_system', db: 'usb_system', name: 'USB', isBool: true },
  rain_sensor: { api: 'rain_sensor', db: 'rain_sensor', name: 'Датчик дождя', isBool: true },
  wheel_adjustment: { api: 'wheel_adjustment', db: 'wheel_adjustment', name: 'Регулировка руля', isBool: true },
  wheel_adjustment_full: { api: 'wheel_adjustment_full', db: 'wheel_adjustment_full', name: 'Полная регулировка', isBool: true },
  heated_windshield: { api: 'heated_windshield', db: 'heated_windshield', name: 'Подогрев стекла', isBool: true }
};

// Функция сравнения цен
const comparePrices = (apiPrices, dbPrices) => {
  if (!apiPrices || !Array.isArray(apiPrices)) return null;
  if (!dbPrices || !Array.isArray(dbPrices)) return { type: 'missing_in_db', count: apiPrices.length };
  
  // Нормализуем цены из API
  const apiPriceMap = new Map();
  apiPrices.forEach(price => {
    if (price && price.season_id) {
      const key = String(price.season_id);
      apiPriceMap.set(key, {
        season_id: price.season_id,
        values: price.values || [],
        id: price.id
      });
    }
  });
  
  // Нормализуем цены из БД
  const dbPriceMap = new Map();
  dbPrices.forEach(price => {
    if (price && price.season_id) {
      const key = String(price.season_id);
      dbPriceMap.set(key, {
        season_id: price.season_id,
        values: price.price_values || price.values || [],
        season_name: price.season_name
      });
    }
  });
  
  const priceDiffs = [];
  
  // Проверяем цены из API
  for (const [seasonId, apiPrice] of apiPriceMap.entries()) {
    const dbPrice = dbPriceMap.get(seasonId);
    
    if (!dbPrice) {
      priceDiffs.push({
        season_id: seasonId,
        type: 'missing_in_db',
        api_values: apiPrice.values
      });
      continue;
    }
    
    // Сравниваем значения цен
    const apiValues = JSON.stringify(apiPrice.values || []);
    const dbValues = JSON.stringify(dbPrice.values || []);
    
    if (apiValues !== dbValues) {
      priceDiffs.push({
        season_id: seasonId,
        season_name: dbPrice.season_name,
        type: 'mismatch',
        api_values: apiPrice.values,
        db_values: dbPrice.values
      });
    }
  }
  
  // Проверяем цены из БД, которых нет в API
  for (const [seasonId, dbPrice] of dbPriceMap.entries()) {
    if (!apiPriceMap.has(seasonId)) {
      priceDiffs.push({
        season_id: seasonId,
        season_name: dbPrice.season_name,
        type: 'missing_in_api',
        db_values: dbPrice.values
      });
    }
  }
  
  return priceDiffs.length > 0 ? priceDiffs : null;
};

apiItems.forEach(apiCar => {
  if (!apiCar || !apiCar.id) return;

  const rentprogId = String(apiCar.id).trim();
  let dbCar = dbMap.get(rentprogId);

  // Если не нашли по RentProg ID, пробуем найти по plate
  if (!dbCar && apiCar.number) {
    const plateKey = String(apiCar.number).trim().toUpperCase();
    dbCar = dbMapByPlate.get(plateKey);
    
    if (dbCar) {
      // Нашли по plate, но RentProg ID не совпадает - это расхождение
      discrepancies.push({
        rentprog_id: rentprogId,
        type: 'rentprog_id_mismatch',
        plate: apiCar.number || null,
        model: apiCar.car_name || apiCar.model || null,
        api_rentprog_id: rentprogId,
        db_rentprog_id: dbCar.rentprog_id,
        message: 'Машина найдена по plate, но RentProg ID не совпадает'
      });
      // Продолжаем сравнение с найденной машиной
    }
  }

  // Машина есть в API, но отсутствует в БД
  if (!dbCar) {
    discrepancies.push({
      rentprog_id: rentprogId,
      type: 'missing_in_db',
      plate: apiCar.number || null,
      model: apiCar.car_name || apiCar.model || null,
      api_data: apiCar
    });
    return;
  }

  // Сравниваем все поля
  const fieldDiffs = [];

  // Проходим по всем полям из fieldMapping
  for (const [fieldKey, fieldConfig] of Object.entries(fieldMapping)) {
    const apiField = fieldConfig.api;
    const dbField = fieldConfig.db;
    const fieldName = fieldConfig.name;
    const isBool = fieldConfig.isBool || false;

    let apiValue = apiCar[apiField];
    let dbValue = dbCar[dbField];

    // Нормализация
    if (isBool) {
      apiValue = normalizeBool(apiValue);
      dbValue = normalizeBool(dbValue);
    } else {
      // Для числовых полей
      if (['year', 'mileage', 'number_doors', 'number_seats', 'tire_type', 
           'franchise', 'max_fine', 'start_mileage', 'tank_value', 
           'repair_cost', 'extra_mileage_km', 'extra_mileage_price'].includes(fieldKey)) {
        apiValue = apiValue !== undefined && apiValue !== null ? String(apiValue) : null;
        dbValue = dbValue !== undefined && dbValue !== null ? String(dbValue) : null;
      } else {
        apiValue = normalize(apiValue);
        dbValue = normalize(dbValue);
      }
    }

    // Сравнение
    if (apiValue !== dbValue) {
      fieldDiffs.push({
        field: dbField,
        fieldNameRu: fieldName,
        apiValue: apiValue,
        dbValue: dbValue
      });
    }
  }

  // Сравнение цен
  const priceDiffs = comparePrices(apiCar.prices, dbCar.prices);
  if (priceDiffs) {
    if (Array.isArray(priceDiffs)) {
      // Есть расхождения в ценах
      fieldDiffs.push({
        field: 'prices',
        fieldNameRu: 'Цены',
        apiValue: \`Расхождений: \${priceDiffs.length}\`,
        dbValue: 'См. детали',
        priceDetails: priceDiffs
      });
    } else {
      // Цены отсутствуют в БД
      fieldDiffs.push({
        field: 'prices',
        fieldNameRu: 'Цены',
        apiValue: \`В API: \${priceDiffs.count} сезонов\`,
        dbValue: 'Отсутствуют в БД'
      });
    }
  }

  if (fieldDiffs.length > 0) {
    discrepancies.push({
      rentprog_id: rentprogId,
      type: 'field_mismatch',
      car_id: dbCar.car_db_id || dbCar.id,
      plate: dbCar.plate,
      model: dbCar.model,
      fields: fieldDiffs
    });
  }
});

return discrepancies.map(d => ({ json: d }));`;

  compareNode.parameters.jsCode = newCode;
  console.log('✅ Обновлен узел "Compare API vs DB" - расширенное сравнение всех полей + цены');
}

// 3. Обновляем "Format Alert" для отображения всех полей и цен
const formatAlertNode = workflow.nodes.find(n => n.id === 'format-alert');
if (formatAlertNode) {
  const newFormatCode = `const { totalDiscrepancies, discrepancies } = $json;

const stateNames = {
  '1': 'Можно выдавать',
  '2': 'В ремонте',
  '3': 'Критическое состояние',
  '4': 'В долгосрочной аренде',
  '5': 'Не выдавать',
  '6': 'Необходимо обслуживание'
};

const showValue = (value, field) => {
  if (value === null || value === undefined || value === '') return '∅';
  if (field === 'state') {
    return stateNames[value] || value;
  }
  return value;
};

const lines = [
  '🔄 Сравнение состояний автомобилей (RentProg API vs БД)',
  '',
  \`📊 Обнаружено расхождений: \${totalDiscrepancies}\`,
  '',
  '📋 Детали:',
  ''
];

for (const d of discrepancies) {
  if (d.type === 'missing_in_db') {
    const plate = showValue(d.plate);
    const model = showValue(d.model);
    lines.push(
      \`🚗 \${plate} (\${model})\`,
      '   ⚠️ Есть в RentProg API, НЕТ в БД',
      '   💡 Запустите скрипт restore_cars_from_rentprog.mjs для добавления',
      ''
    );
    continue;
  }

  if (d.type === 'rentprog_id_mismatch') {
    const plate = showValue(d.plate);
    const model = showValue(d.model);
    lines.push(
      \`🚗 \${plate} (\${model})\`,
      \`   ⚠️ RentProg ID не совпадает: API=\${d.api_rentprog_id}, БД=\${d.db_rentprog_id}\`,
      '   💡 Проверьте связь в external_refs',
      ''
    );
    continue;
  }

  if (d.type === 'field_mismatch') {
    const plate = showValue(d.plate);
    const model = showValue(d.model);
    lines.push(\`🚗 \${plate} (\${model})\`);

    // Показываем ВСЕ поля с изменениями
    for (const field of d.fields) {
      const oldVal = showValue(field.dbValue, field.field);
      const newVal = showValue(field.apiValue, field.field);
      
      // Специальная обработка для цен
      if (field.field === 'prices' && field.priceDetails) {
        lines.push('   💰 Цены:');
        for (const priceDiff of field.priceDetails) {
          if (priceDiff.type === 'missing_in_db') {
            lines.push(\`      Сезон \${priceDiff.season_id}: отсутствует в БД (API: \${JSON.stringify(priceDiff.api_values)})\`);
          } else if (priceDiff.type === 'missing_in_api') {
            lines.push(\`      Сезон \${priceDiff.season_id} (\${priceDiff.season_name || ''}): есть в БД, нет в API\`);
          } else if (priceDiff.type === 'mismatch') {
            lines.push(\`      Сезон \${priceDiff.season_id} (\${priceDiff.season_name || ''}):\`);
            lines.push(\`         API: \${JSON.stringify(priceDiff.api_values)}\`);
            lines.push(\`         БД:  \${JSON.stringify(priceDiff.db_values)}\`);
          }
        }
      } else {
        lines.push(\`   \${field.fieldNameRu}: \${oldVal} → \${newVal}\`);
      }
    }

    lines.push('   💡 Запустите скрипт restore_cars_from_rentprog.mjs для обновления');
    lines.push('');
  }
}

lines.push('━'.repeat(30));
lines.push(\`🕐 \${new Date().toLocaleString('ru-RU', { timeZone: 'Asia/Tbilisi' })}\`);

return [{ json: { alertText: lines.join('\\n') } }];`;

  formatAlertNode.parameters.jsCode = newFormatCode;
  console.log('✅ Обновлен "Format Alert" - отображение всех полей и цен');
}

// Сохраняем
fs.writeFileSync(workflowPath, JSON.stringify(workflow, null, 2), 'utf-8');

console.log('\n✅ Workflow расширен!');
console.log('\n📋 Изменения:');
console.log('   1. SQL запрос "Get Cars from DB" - добавлены все поля + цены (JSONB агрегация)');
console.log('   2. Узел "Compare API vs DB" - сравнение всех параметров и характеристик');
console.log('   3. Добавлено сравнение цен (prices) - проверка сезонов и значений');
console.log('   4. Добавлена проверка по plate (если не найдено по RentProg ID)');
console.log('   5. "Format Alert" - отображение всех расхождений, включая цены');
console.log('\n⚠️  Нужно импортировать обновленный workflow в n8n!');

