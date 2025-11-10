#!/usr/bin/env node
/**
 * Обновление данных машин в БД на основе сравнения с RentProg API
 * Обновляет только те поля, где есть расхождения
 */

import { Client } from 'pg';

const BASE_URL = 'https://rentprog.net/api/v1/public';
const PAGE_SIZE = 20;
const MAX_PAGES = 150;
const REQUEST_DELAY_MS = 1000;

// Токены для каждого филиала
const BRANCH_TOKENS = {
  tbilisi: '91b83b93963633649f29a04b612bab3f9fbb0471b5928622',
  batumi: '7ad345720f8d92f10c187122427c6a2c2bb9494c6bf14e8d',
  kutaisi: '5599ebb7b94827fdfd49ca3a5b7e259cfa99d8ea78edeb50',
  'service-center': '5y4j4gcs75o9n5s1e2vrxx4a'
};

const DEFAULT_ORDER = ['tbilisi', 'batumi', 'kutaisi', 'service-center'];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Нормализация значений
const normalize = (val) => {
  if (val === null || val === undefined || val === '') return null;
  const str = String(val).trim();
  return str === '' || str.toLowerCase() === 'null' ? null : str;
};

// Нормализация boolean
const normalizeBool = (val) => {
  if (val === true || val === 'true' || val === '1' || val === 1) return true;
  if (val === false || val === 'false' || val === '0' || val === 0) return false;
  return null;
};

// Получение токена запроса
async function getRequestToken(companyToken) {
  const res = await fetch(`${BASE_URL}/get_token?company_token=${companyToken}`, { method: 'GET' });
  if (!res.ok) {
    throw new Error(`get_token HTTP ${res.status}`);
  }
  const json = await res.json();
  const token = json?.token;
  if (!token) {
    throw new Error('Empty request token');
  }
  return token;
}

// Получение машин с пагинацией
async function fetchCarsPage(requestToken, page) {
  const url = `${BASE_URL}/all_cars_full?limit=${PAGE_SIZE}&page=${page}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${requestToken}` } });
  if (res.status === 401 || res.status === 403) {
    const err = new Error('Unauthorized');
    err.code = 'UNAUTH';
    throw err;
  }
  if (!res.ok) {
    throw new Error(`all_cars_full HTTP ${res.status}`);
  }
  const json = await res.json();
  if (Array.isArray(json)) return json;
  if (Array.isArray(json?.data)) return json.data;
  if (Array.isArray(json?.cars)) return json.cars;
  return [];
}

// Получение всех машин из филиала
async function fetchAllCars(branchCode, companyToken) {
  let requestToken;
  try {
    requestToken = await getRequestToken(companyToken);
    await sleep(REQUEST_DELAY_MS);
  } catch (error) {
    throw new Error(`Ошибка получения токена для ${branchCode}: ${error.message}`);
  }

  const allCars = [];
  let page = 1;
  let hasMore = true;

  while (hasMore && page <= MAX_PAGES) {
    const carsPage = await fetchCarsPage(requestToken, page);
    allCars.push(...carsPage);
    hasMore = carsPage.length === PAGE_SIZE;
    page++;
    if (hasMore) await sleep(REQUEST_DELAY_MS);
  }

  return allCars;
}

// Получение машин из БД
async function getCarsFromDB(client) {
  const result = await client.query(`
    SELECT
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
      c.vin AS vin,
      b.code AS branch_code
    FROM cars c
    JOIN external_refs er ON er.entity_id = c.id
    JOIN branches b ON b.id = c.branch_id
    WHERE er.system = 'rentprog'
      AND er.entity_type = 'car'
  `);

  return result.rows;
}

// Форматирование значения для SQL
function formatValueForSQL(val, fieldType) {
  if (val === null || val === undefined || val === '') return 'NULL';
  
  if (fieldType === 'number') {
    const num = Number(val);
    return Number.isNaN(num) ? 'NULL' : String(num);
  }
  
  if (fieldType === 'boolean') {
    if (val === true || val === 'true' || val === '1' || val === 1) return 'TRUE';
    if (val === false || val === 'false' || val === '0' || val === 0) return 'FALSE';
    return 'NULL';
  }
  
  // Строка
  return `'${String(val).replace(/'/g, "''")}'`;
}

// Обновление машины в БД
async function updateCarInDB(client, carId, updates) {
  if (Object.keys(updates).length === 0) return false;

  const setClauses = [];
  for (const [field, value] of Object.entries(updates)) {
    if (value === null || value === undefined || value === '') {
      // Пропускаем пустые значения - не перезаписываем существующие данные
      continue;
    }
    
    let sqlValue;
    if (['year', 'mileage', 'number_doors', 'number_seats', 'tire_type',
         'franchise', 'max_fine', 'start_mileage', 'tank_value',
         'repair_cost', 'extra_mileage_km', 'extra_mileage_price'].includes(field)) {
      sqlValue = formatValueForSQL(value, 'number');
    } else if (['is_air', 'abs', 'ebd', 'esp', 'is_electropackage', 'cd_system',
                'tv_system', 'parktronic', 'parktronic_back', 'parktronic_camera',
                'tank_state', 'heated_seats', 'heated_seats_front', 'clean_state',
                'audio_system', 'video_system', 'folding_seats', 'climate_control',
                'usb_system', 'rain_sensor', 'wheel_adjustment', 'wheel_adjustment_full',
                'heated_windshield'].includes(field)) {
      sqlValue = formatValueForSQL(value, 'boolean');
    } else {
      sqlValue = formatValueForSQL(value, 'string');
    }
    
    if (sqlValue !== 'NULL') {
      setClauses.push(`${field} = ${sqlValue}`);
    }
  }

  if (setClauses.length === 0) return false;

  setClauses.push('updated_at = NOW()');

  await client.query(`
    UPDATE cars
    SET ${setClauses.join(', ')}
    WHERE id = $1
  `, [carId]);

  return true;
}

// Обновление цен в БД
async function updatePricesInDB(client, carId, apiPrices) {
  if (!apiPrices || !Array.isArray(apiPrices) || apiPrices.length === 0) {
    return { inserted: 0, updated: 0 };
  }

  let inserted = 0;
  let updated = 0;

  for (const price of apiPrices) {
    if (!price || !Array.isArray(price.values)) continue;

    // Обрабатываем цены с season_id = null (используем специальное значение -1)
    const seasonId = price.season_id !== null && price.season_id !== undefined ? price.season_id : -1;
    const priceValues = JSON.stringify(price.values);

    // Проверяем существование (для NULL используем специальную проверку)
    let existing;
    if (seasonId === -1) {
      // Для NULL используем отдельный запрос
      existing = await client.query(`
        SELECT id FROM car_prices
        WHERE car_id = $1 AND season_id IS NULL
        LIMIT 1
      `, [carId]);
    } else {
      // Для обычных season_id
      existing = await client.query(`
        SELECT id FROM car_prices
        WHERE car_id = $1 AND season_id = $2
        LIMIT 1
      `, [carId, seasonId]);
    }

    if (existing.rows.length > 0) {
      // Обновляем существующую цену
      await client.query(`
        UPDATE car_prices
        SET price_values = $1::jsonb,
            updated_at = NOW()
        WHERE id = $2
      `, [priceValues, existing.rows[0].id]);
      updated++;
    } else {
      // Вставляем новую цену (для NULL используем NULL, а не -1)
      await client.query(`
        INSERT INTO car_prices (car_id, season_id, price_values, active, created_at, updated_at)
        VALUES ($1, $2, $3::jsonb, TRUE, NOW(), NOW())
      `, [carId, seasonId === -1 ? null : seasonId, priceValues]);
      inserted++;
    }
  }

  return { inserted, updated };
}

// Создание новой машины в БД
async function createCarInDB(client, apiCar, branchId) {
  const rentprogId = String(apiCar.id);
  const companyId = String(apiCar.company_id || '');

  // Определяем branch_id по company_id, если не передан
  let actualBranchId = branchId;
  if (!actualBranchId && companyId) {
    const companyToBranch = {
      '9247': 'tbilisi',
      '9506': 'batumi',
      '9248': 'kutaisi',
      '11163': 'service-center'
    };
    const branchCode = companyToBranch[companyId];
    if (branchCode) {
      const branch = await client.query(`SELECT id FROM branches WHERE code = $1 LIMIT 1`, [branchCode]);
      if (branch.rows.length > 0) {
        actualBranchId = branch.rows[0].id;
      }
    }
  }

  if (!actualBranchId) {
    throw new Error(`Не удалось определить branch_id для машины ${rentprogId}`);
  }

  // Формируем поля для INSERT
  const fields = ['id', 'branch_id', 'created_at', 'updated_at'];
  const values = ['gen_random_uuid()', `'${actualBranchId}'`, 'NOW()', 'NOW()'];

  // Добавляем поля из API (только если значение не пустое)
  const addField = (fieldName, apiValue, fieldType) => {
    if (apiValue === null || apiValue === undefined || apiValue === '') return;
    const sqlValue = formatValueForSQL(apiValue, fieldType);
    if (sqlValue !== 'NULL') {
      fields.push(fieldName);
      values.push(sqlValue);
    }
  };

  // Основные поля
  addField('company_id', companyId, 'string');
  addField('model', apiCar.car_name || apiCar.model, 'string');
  addField('plate', apiCar.number, 'string');
  addField('state', apiCar.state, 'number');
  addField('transmission', apiCar.transmission, 'string');
  addField('year', apiCar.year, 'number');
  addField('color', apiCar.color, 'string');
  addField('mileage', apiCar.mileage, 'number');
  addField('car_type', apiCar.car_type, 'string');
  addField('interior', apiCar.interior, 'string');
  addField('car_class', apiCar.car_class, 'string');
  addField('code', apiCar.code, 'string');
  addField('drive_unit', apiCar.drive_unit, 'string');
  addField('steering_side', apiCar.steering_side, 'string');
  addField('fuel', apiCar.fuel, 'string');
  addField('number_doors', apiCar.number_doors, 'number');
  addField('number_seats', apiCar.number_seats, 'number');
  addField('engine_capacity', apiCar.engine_capacity, 'string');
  addField('engine_power', apiCar.engine_power, 'string');
  addField('trunk_volume', apiCar.trunk_volume, 'string');
  addField('tire_size', apiCar.tire_size, 'string');
  addField('tire_type', apiCar.tire_type, 'number');
  addField('gas_mileage', apiCar.gas_mileage, 'string');
  addField('vin', apiCar.vin, 'string');
  addField('body_number', apiCar.body_number, 'string');
  addField('pts', apiCar.pts, 'string');
  addField('registration_certificate', apiCar.registration_certificate, 'string');
  addField('start_mileage', apiCar.start_mileage, 'number');
  addField('tank_value', apiCar.tank_value, 'number');
  addField('franchise', apiCar.franchise, 'number');
  addField('max_fine', apiCar.max_fine, 'number');
  addField('repair_cost', apiCar.repair_cost, 'number');
  addField('store_place', apiCar.store_place, 'string');
  addField('roof', apiCar.roof, 'string');
  addField('custom_field_1', apiCar.custom_field_1, 'string');
  addField('custom_field_2', apiCar.custom_field_2, 'string');
  addField('custom_field_3', apiCar.custom_field_3, 'string');
  addField('window_lifters', apiCar.window_lifters, 'string');
  addField('extra_mileage_km', apiCar.extra_mileage_km, 'number');
  addField('extra_mileage_price', apiCar.extra_mileage_price, 'number');
  addField('insurance', apiCar.insurance, 'string');
  addField('avatar_url', apiCar.avatar_url, 'string');

  // Boolean поля
  addField('is_air', apiCar.is_air, 'boolean');
  addField('abs', apiCar.abs, 'boolean');
  addField('ebd', apiCar.ebd, 'boolean');
  addField('esp', apiCar.esp, 'boolean');
  addField('is_electropackage', apiCar.is_electropackage, 'boolean');
  addField('cd_system', apiCar.cd_system, 'boolean');
  addField('tv_system', apiCar.tv_system, 'boolean');
  addField('parktronic', apiCar.parktronic, 'boolean');
  addField('parktronic_back', apiCar.parktronic_back, 'boolean');
  addField('parktronic_camera', apiCar.parktronic_camera, 'boolean');
  addField('tank_state', apiCar.tank_state, 'boolean');
  addField('heated_seats', apiCar.heated_seats, 'boolean');
  addField('heated_seats_front', apiCar.heated_seats_front, 'boolean');
  addField('clean_state', apiCar.clean_state, 'boolean');
  addField('audio_system', apiCar.audio_system, 'boolean');
  addField('video_system', apiCar.video_system, 'boolean');
  addField('folding_seats', apiCar.folding_seats, 'boolean');
  addField('climate_control', apiCar.climate_control, 'boolean');
  addField('usb_system', apiCar.usb_system, 'boolean');
  addField('rain_sensor', apiCar.rain_sensor, 'boolean');
  addField('wheel_adjustment', apiCar.wheel_adjustment, 'boolean');
  addField('wheel_adjustment_full', apiCar.wheel_adjustment_full, 'boolean');
  addField('heated_windshield', apiCar.heated_windshield, 'boolean');

  // Выполняем INSERT через DO блок для атомарности
  const insertQuery = `
    DO $$
    DECLARE
      new_car_id UUID;
    BEGIN
      INSERT INTO cars (${fields.join(', ')})
      VALUES (${values.join(', ')})
      RETURNING id INTO new_car_id;
      
      INSERT INTO external_refs (entity_type, entity_id, system, external_id, created_at, updated_at)
      VALUES ('car', new_car_id, 'rentprog', '${rentprogId}', NOW(), NOW())
      ON CONFLICT (system, external_id) DO UPDATE SET
        entity_id = EXCLUDED.entity_id,
        updated_at = NOW();
    END $$;
  `;

  await client.query(insertQuery);

  // Получаем ID созданной машины
  const result = await client.query(`
    SELECT c.id
    FROM cars c
    JOIN external_refs er ON er.entity_id = c.id
    WHERE er.system = 'rentprog'
      AND er.entity_type = 'car'
      AND er.external_id = $1
    LIMIT 1
  `, [rentprogId]);

  return result.rows[0]?.id;
}

// Поля для сравнения (такие же как в compare)
const fieldMapping = {
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
  number_doors: { api: 'number_doors', db: 'number_doors', name: 'Кол-во дверей' },
  number_seats: { api: 'number_seats', db: 'number_seats', name: 'Кол-во мест' },
  engine_capacity: { api: 'engine_capacity', db: 'engine_capacity', name: 'Объём двигателя' },
  engine_power: { api: 'engine_power', db: 'engine_power', name: 'Мощность' },
  trunk_volume: { api: 'trunk_volume', db: 'trunk_volume', name: 'Объём багажника' },
  tire_size: { api: 'tire_size', db: 'tire_size', name: 'Размер шин' },
  tire_type: { api: 'tire_type', db: 'tire_type', name: 'Тип шин' },
  gas_mileage: { api: 'gas_mileage', db: 'gas_mileage', name: 'Расход топлива' },
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

// Сравнение и подготовка обновлений
function prepareUpdates(apiCar, dbCar) {
  const updates = {};

  for (const [fieldKey, fieldConfig] of Object.entries(fieldMapping)) {
    const apiField = fieldConfig.api;
    const dbField = fieldConfig.db;
    const isBool = fieldConfig.isBool || false;

    let apiValue = apiCar[apiField];
    let dbValue = dbCar[dbField];

    // Нормализация
    if (isBool) {
      apiValue = normalizeBool(apiValue);
      dbValue = normalizeBool(dbValue);
    } else {
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

    // Сравнение - обновляем только если значения различаются И apiValue не пустое
    if (apiValue !== dbValue && apiValue !== null && apiValue !== undefined && apiValue !== '') {
      // Для boolean сохраняем как boolean, для остальных - как есть
      if (isBool) {
        updates[dbField] = apiValue === true || apiValue === 'true';
      } else if (['year', 'mileage', 'number_doors', 'number_seats', 'tire_type',
                   'franchise', 'max_fine', 'start_mileage', 'tank_value',
                   'repair_cost', 'extra_mileage_km', 'extra_mileage_price'].includes(fieldKey)) {
        const num = Number(apiValue);
        updates[dbField] = Number.isNaN(num) ? null : num;
      } else {
        updates[dbField] = String(apiValue);
      }
    }
  }

  return updates;
}

// Главная функция
async function main() {
  const client = new Client({
    connectionString: 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require',
  });

  try {
    await client.connect();
    console.log('🔄 Обновление данных машин из RentProg API');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📅 Дата: ${new Date().toLocaleString('ru-RU', { timeZone: 'Asia/Tbilisi' })}`);
    console.log('\n');

    // Получаем данные из БД
    console.log('📥 Получение данных из БД...');
    const dbCars = await getCarsFromDB(client);
    console.log(`   ✅ Получено машин из БД: ${dbCars.length}\n`);

    // Создаем мапы для быстрого поиска
    const dbMapById = new Map();
    const dbMapByPlate = new Map();

    dbCars.forEach(car => {
      if (car && car.rentprog_id) {
        const key = String(car.rentprog_id).trim();
        if (key) {
          dbMapById.set(key, car);
        }
      }
      if (car && car.plate) {
        const key = String(car.plate).trim().toUpperCase();
        if (key) {
          dbMapByPlate.set(key, car);
        }
      }
    });

    // Получаем данные из API для всех филиалов
    const allApiCars = [];
    for (const branchCode of DEFAULT_ORDER) {
      console.log(`📡 Получение машин из RentProg API (${branchCode})...`);
      const companyToken = BRANCH_TOKENS[branchCode];
      if (!companyToken) {
        console.error(`   ❌ Токен для филиала ${branchCode} не найден. Пропускаю.`);
        continue;
      }

      try {
        const cars = await fetchAllCars(branchCode, companyToken);
        console.log(`   ✅ Получено машин: ${cars.length}`);
        allApiCars.push(...cars);
      } catch (error) {
        console.error(`   ❌ Ошибка получения машин из ${branchCode}: ${error.message}`);
      }
      console.log('');
    }

    console.log(`📊 Всего машин из API: ${allApiCars.length}\n`);

    // Статистика
    const stats = {
      updated: 0,
      created: 0,
      pricesInserted: 0,
      pricesUpdated: 0,
      skipped: 0,
      errors: 0
    };

    // Обрабатываем каждую машину из API
    console.log('🔄 Обновление данных...\n');
    
    for (const apiCar of allApiCars) {
      if (!apiCar || !apiCar.id) continue;

      const rentprogId = String(apiCar.id).trim();
      let dbCar = dbMapById.get(rentprogId);

      // Если не нашли по RentProg ID, пробуем найти по plate
      if (!dbCar && apiCar.number) {
        const plateKey = String(apiCar.number).trim().toUpperCase();
        dbCar = dbMapByPlate.get(plateKey);
      }

      try {
        if (!dbCar) {
          // Создаем новую машину
          const branchCode = apiCar.company_id ? {
            '9247': 'tbilisi',
            '9506': 'batumi',
            '9248': 'kutaisi',
            '11163': 'service-center'
          }[String(apiCar.company_id)] : null;

          if (!branchCode) {
            console.log(`   ⚠️  Пропущена машина ${rentprogId}: не удалось определить филиал`);
            stats.skipped++;
            continue;
          }

          const branch = await client.query(`SELECT id FROM branches WHERE code = $1 LIMIT 1`, [branchCode]);
          if (branch.rows.length === 0) {
            console.log(`   ⚠️  Пропущена машина ${rentprogId}: филиал ${branchCode} не найден`);
            stats.skipped++;
            continue;
          }

          const carId = await createCarInDB(client, apiCar, branch.rows[0].id);
          
          // Обновляем цены
          if (apiCar.prices && Array.isArray(apiCar.prices)) {
            const priceStats = await updatePricesInDB(client, carId, apiCar.prices);
            stats.pricesInserted += priceStats.inserted;
            stats.pricesUpdated += priceStats.updated;
          }

          stats.created++;
          console.log(`   ✅ Создана: ${apiCar.number || 'N/A'} (${apiCar.car_name || 'N/A'})`);
        } else {
          // Обновляем существующую машину
          const updates = prepareUpdates(apiCar, dbCar);
          const wasUpdated = await updateCarInDB(client, dbCar.car_db_id, updates);

          // Обновляем цены
          let priceStats = { inserted: 0, updated: 0 };
          if (apiCar.prices && Array.isArray(apiCar.prices)) {
            priceStats = await updatePricesInDB(client, dbCar.car_db_id, apiCar.prices);
            stats.pricesInserted += priceStats.inserted;
            stats.pricesUpdated += priceStats.updated;
          }

          if (wasUpdated || priceStats.inserted > 0 || priceStats.updated > 0) {
            stats.updated++;
            const updateInfo = [];
            if (wasUpdated) updateInfo.push(`${Object.keys(updates).length} полей`);
            if (priceStats.inserted > 0 || priceStats.updated > 0) {
              updateInfo.push(`цен: +${priceStats.inserted}/~${priceStats.updated}`);
            }
            console.log(`   ✅ Обновлена: ${dbCar.plate || 'N/A'} (${dbCar.model || 'N/A'}) [${updateInfo.join(', ')}]`);
          }
        }
      } catch (error) {
        console.error(`   ❌ Ошибка при обработке машины ${rentprogId}: ${error.message}`);
        stats.errors++;
      }
    }

    // Итоговая статистика
    console.log('\n' + '━'.repeat(50));
    console.log('📊 ИТОГОВАЯ СТАТИСТИКА');
    console.log('━'.repeat(50));
    console.log(`   Создано новых машин: ${stats.created}`);
    console.log(`   Обновлено существующих: ${stats.updated}`);
    console.log(`   Пропущено: ${stats.skipped}`);
    console.log(`   Ошибок: ${stats.errors}`);
    console.log(`   Цен добавлено: ${stats.pricesInserted}`);
    console.log(`   Цен обновлено: ${stats.pricesUpdated}`);
    console.log('━'.repeat(50));
    console.log('\n✅ Готово!');

  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    console.error(error.stack);
  } finally {
    await client.end();
  }
}

main().catch(console.error);

