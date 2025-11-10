#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const workflowPath = path.join(__dirname, '..', 'n8n-workflows', 'rentprog-car-states-reconciliation-v2.json');
const workflow = JSON.parse(fs.readFileSync(workflowPath, 'utf-8'));

console.log('🔧 Исправление узла "Compare API vs DB"\n');

// Находим узел "Compare API vs DB"
const compareNode = workflow.nodes.find(n => n.id === 'compare-api-db');

if (!compareNode) {
  console.error('❌ Узел "Compare API vs DB" не найден!');
  process.exit(1);
}

// Обновляем код - добавляем логирование и исправляем логику
const newCode = `// Сравнение данных из API с БД
const apiItems = $input.all(0).map(item => item.json);
const dbItems = $input.all(1).map(item => item.json);

// Нормализация значений
const normalize = (val) => {
  if (val === null || val === undefined || val === '') return null;
  const str = String(val).trim();
  return str === '' || str.toLowerCase() === 'null' ? null : str;
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

  // Сравниваем поля
  const fieldDiffs = [];

  // company_id
  const apiCompanyId = normalize(String(apiCar.company_id || ''));
  const dbCompanyId = normalize(String(dbCar.company_id || ''));
  if (apiCompanyId !== dbCompanyId) {
    fieldDiffs.push({
      field: 'company_id',
      fieldNameRu: 'Компания',
      apiValue: apiCompanyId,
      dbValue: dbCompanyId
    });
  }

  // model (car_name → model)
  const apiModel = normalize(apiCar.car_name || apiCar.model);
  const dbModel = normalize(dbCar.model);
  if (apiModel !== dbModel) {
    fieldDiffs.push({
      field: 'model',
      fieldNameRu: 'Модель',
      apiValue: apiModel,
      dbValue: dbModel
    });
  }

  // plate (number → plate) - только если не совпадает
  const apiPlate = normalize(apiCar.number);
  const dbPlate = normalize(dbCar.plate);
  if (apiPlate !== dbPlate) {
    fieldDiffs.push({
      field: 'plate',
      fieldNameRu: 'Номер',
      apiValue: apiPlate,
      dbValue: dbPlate
    });
  }

  // state - ВАЖНОЕ ПОЛЕ!
  const apiState = apiCar.state !== undefined && apiCar.state !== null ? String(apiCar.state) : null;
  const dbState = dbCar.state !== undefined && dbCar.state !== null ? String(dbCar.state) : null;
  const apiStateNorm = normalize(apiState);
  const dbStateNorm = normalize(dbState);
  if (apiStateNorm !== dbStateNorm) {
    fieldDiffs.push({
      field: 'state',
      fieldNameRu: 'Статус',
      apiValue: apiStateNorm,
      dbValue: dbStateNorm
    });
  }

  // transmission
  const apiTransmission = normalize(apiCar.transmission);
  const dbTransmission = normalize(dbCar.transmission);
  if (apiTransmission !== dbTransmission) {
    fieldDiffs.push({
      field: 'transmission',
      fieldNameRu: 'Трансмиссия',
      apiValue: apiTransmission,
      dbValue: dbTransmission
    });
  }

  // year
  const apiYear = normalize(apiCar.year !== undefined ? String(apiCar.year) : null);
  const dbYear = normalize(dbCar.year);
  if (apiYear !== dbYear) {
    fieldDiffs.push({
      field: 'year',
      fieldNameRu: 'Год',
      apiValue: apiYear,
      dbValue: dbYear
    });
  }

  // number_doors
  const apiDoors = normalize(apiCar.number_doors !== undefined ? String(apiCar.number_doors) : null);
  const dbDoors = normalize(dbCar.number_doors);
  if (apiDoors !== dbDoors) {
    fieldDiffs.push({
      field: 'number_doors',
      fieldNameRu: 'Кол-во дверей',
      apiValue: apiDoors,
      dbValue: dbDoors
    });
  }

  // number_seats
  const apiSeats = normalize(apiCar.number_seats);
  const dbSeats = normalize(dbCar.number_seats);
  if (apiSeats !== dbSeats) {
    fieldDiffs.push({
      field: 'number_seats',
      fieldNameRu: 'Кол-во мест',
      apiValue: apiSeats,
      dbValue: dbSeats
    });
  }

  // is_air
  const apiIsAir = apiCar.is_air === true ? 'true' : apiCar.is_air === false ? 'false' : null;
  const dbIsAir = dbCar.is_air === true ? 'true' : dbCar.is_air === false ? 'false' : null;
  if (apiIsAir !== dbIsAir) {
    fieldDiffs.push({
      field: 'is_air',
      fieldNameRu: 'Кондиционер',
      apiValue: apiIsAir,
      dbValue: dbIsAir
    });
  }

  // engine_capacity
  const apiCapacity = normalize(apiCar.engine_capacity);
  const dbCapacity = normalize(dbCar.engine_capacity);
  if (apiCapacity !== dbCapacity) {
    fieldDiffs.push({
      field: 'engine_capacity',
      fieldNameRu: 'Объём двигателя',
      apiValue: apiCapacity,
      dbValue: dbCapacity
    });
  }

  // engine_power
  const apiPower = normalize(apiCar.engine_power);
  const dbPower = normalize(dbCar.engine_power);
  if (apiPower !== dbPower) {
    fieldDiffs.push({
      field: 'engine_power',
      fieldNameRu: 'Мощность',
      apiValue: apiPower,
      dbValue: dbPower
    });
  }

  // trunk_volume
  const apiTrunk = normalize(apiCar.trunk_volume);
  const dbTrunk = normalize(dbCar.trunk_volume);
  if (apiTrunk !== dbTrunk) {
    fieldDiffs.push({
      field: 'trunk_volume',
      fieldNameRu: 'Объём багажника',
      apiValue: apiTrunk,
      dbValue: dbTrunk
    });
  }

  // avatar_url
  const apiAvatar = normalize(apiCar.avatar_url);
  const dbAvatar = normalize(dbCar.avatar_url);
  if (apiAvatar !== dbAvatar) {
    fieldDiffs.push({
      field: 'avatar_url',
      fieldNameRu: 'Аватар',
      apiValue: apiAvatar,
      dbValue: dbAvatar
    });
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

// Сохраняем
fs.writeFileSync(workflowPath, JSON.stringify(workflow, null, 2), 'utf-8');

console.log('✅ Узел "Compare API vs DB" обновлен!');
console.log('\n📋 Изменения:');
console.log('   1. Добавлен поиск по plate, если не найдено по RentProg ID');
console.log('   2. Добавлено сравнение по state (важное поле!)');
console.log('   3. Улучшена нормализация значений');
console.log('   4. Добавлена обработка случая, когда RentProg ID не совпадает, но машина найдена по plate');
console.log('\n⚠️  Нужно импортировать обновленный workflow в n8n!');

