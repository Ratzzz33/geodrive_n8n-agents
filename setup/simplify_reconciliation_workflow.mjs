#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const workflowPath = path.join(__dirname, '..', 'n8n-workflows', 'rentprog-car-states-reconciliation-v2.json');
const workflow = JSON.parse(fs.readFileSync(workflowPath, 'utf-8'));

console.log('🔧 Упрощение workflow: убираем сохранение в БД\n');

// 1. Удаляем узлы для сохранения в БД
const nodesToRemove = ['upsert-snapshot', 'generate-sql-updates', 'apply-updates'];
workflow.nodes = workflow.nodes.filter(node => !nodesToRemove.includes(node.id));

console.log(`✅ Удалены узлы: ${nodesToRemove.join(', ')}`);

// 2. Изменяем "Compute Diff (SQL)" - сравниваем напрямую API с БД (без snapshot)
const computeDiffNode = workflow.nodes.find(n => n.id === 'compute-diff');
if (computeDiffNode) {
  // Новый SQL запрос - сравнивает API данные (из Code node) с БД напрямую
  // Но для этого нужно сначала подготовить данные из API в Code node
  // Пока оставим старый SQL, но изменим его чтобы не использовать snapshot
  // Вместо этого будем использовать временную таблицу или CTE из API данных
  
  // Вариант: используем Code node для подготовки данных перед SQL
  // Или изменяем SQL чтобы принимать данные из предыдущего узла
  
  // Пока оставим как есть, но изменим логику - будем сравнивать через Code node
  console.log('⚠️  "Compute Diff (SQL)" требует изменения - будет сравнивать API с БД через Code node');
}

// 3. Добавляем новый узел "Prepare API Data" для подготовки данных из API перед сравнением
const prepareApiDataNode = {
  "parameters": {
    "jsCode": `// Подготовка данных из API для сравнения с БД
const items = $input.all();

// Нормализуем данные из API
const apiCars = items.map(item => {
  const car = item.json;
  return {
    rentprog_id: String(car.id),
    company_id: String(car.company_id || ''),
    model: car.car_name || car.model || null,
    plate: car.number || null,
    state: car.state !== undefined && car.state !== null ? String(car.state) : null,
    transmission: car.transmission || null,
    year: car.year !== undefined && car.year !== null ? String(car.year) : null,
    number_doors: car.number_doors !== undefined && car.number_doors !== null ? String(car.number_doors) : null,
    number_seats: car.number_seats || null,
    is_air: car.is_air === true ? 'true' : car.is_air === false ? 'false' : null,
    engine_capacity: car.engine_capacity || null,
    engine_power: car.engine_power || null,
    trunk_volume: car.trunk_volume || null,
    avatar_url: car.avatar_url || null
  };
});

return apiCars.map(car => ({ json: car }));`
  },
  "id": "prepare-api-data",
  "name": "Prepare API Data",
  "type": "n8n-nodes-base.code",
  "typeVersion": 2,
  "position": [1050, 525]
};

workflow.nodes.push(prepareApiDataNode);
console.log('✅ Добавлен узел "Prepare API Data"');

// 4. Изменяем "Compute Diff (SQL)" - сравниваем API данные (из Code) с БД
const newComputeDiffSQL = `WITH api_data AS (
  SELECT
    rentprog_id::text,
    company_id::text,
    model::text,
    NULLIF(TRIM(plate::text), '') AS plate,
    NULLIF(TRIM(state::text), '') AS state,
    NULLIF(TRIM(transmission::text), '') AS transmission,
    NULLIF(TRIM(year::text), '') AS year,
    NULLIF(TRIM(number_doors::text), '') AS number_doors,
    NULLIF(TRIM(number_seats::text), '') AS number_seats,
    CASE
      WHEN lower(is_air::text) IN ('true', 't', '1') THEN 'true'
      WHEN lower(is_air::text) IN ('false', 'f', '0') THEN 'false'
      ELSE NULL
    END AS is_air,
    NULLIF(TRIM(engine_capacity::text), '') AS engine_capacity,
    NULLIF(TRIM(engine_power::text), '') AS engine_power,
    NULLIF(TRIM(trunk_volume::text), '') AS trunk_volume,
    NULLIF(TRIM(avatar_url::text), '') AS avatar_url
  FROM json_populate_recordset(null::record, $1::json)
  AS t(rentprog_id text, company_id text, model text, plate text, state text, transmission text, year text, number_doors text, number_seats text, is_air text, engine_capacity text, engine_power text, trunk_volume text, avatar_url text)
),
db_data AS (
  SELECT
    er.external_id::text AS rentprog_id,
    c.id AS car_db_id,
    c.company_id::text AS company_id,
    c.model::text AS model,
    NULLIF(TRIM(c.plate::text), '') AS plate,
    NULLIF(TRIM(c.state::text), '') AS state,
    NULLIF(TRIM(c.transmission::text), '') AS transmission,
    NULLIF(TRIM(c.year::text), '') AS year,
    NULLIF(TRIM(c.number_doors::text), '') AS number_doors,
    NULLIF(TRIM(c.number_seats::text), '') AS number_seats,
    CASE
      WHEN c.is_air IS TRUE THEN 'true'
      WHEN c.is_air IS FALSE THEN 'false'
      ELSE NULL
    END AS is_air,
    NULLIF(TRIM(c.engine_capacity::text), '') AS engine_capacity,
    NULLIF(TRIM(c.engine_power::text), '') AS engine_power,
    NULLIF(TRIM(c.trunk_volume::text), '') AS trunk_volume,
    NULLIF(TRIM(c.avatar_url::text), '') AS avatar_url
  FROM cars c
  JOIN external_refs er ON er.entity_id = c.id
  WHERE er.system = 'rentprog'
    AND er.entity_type = 'car'
)
SELECT
  a.rentprog_id,
  d.car_db_id,
  a.company_id AS api_company,
  d.company_id AS db_company,
  a.model AS api_model,
  d.model AS db_model,
  a.plate AS api_plate,
  d.plate AS db_plate,
  a.state AS api_state,
  d.state AS db_state,
  a.transmission AS api_transmission,
  d.transmission AS db_transmission,
  a.year AS api_year,
  d.year AS db_year,
  a.number_doors AS api_number_doors,
  d.number_doors AS db_number_doors,
  a.number_seats AS api_number_seats,
  d.number_seats AS db_number_seats,
  a.is_air AS api_is_air,
  d.is_air AS db_is_air,
  a.engine_capacity AS api_engine_capacity,
  d.engine_capacity AS db_engine_capacity,
  a.engine_power AS api_engine_power,
  d.engine_power AS db_engine_power,
  a.trunk_volume AS api_trunk_volume,
  d.trunk_volume AS db_trunk_volume,
  a.avatar_url AS api_avatar,
  d.avatar_url AS db_avatar
FROM api_data a
LEFT JOIN db_data d ON d.rentprog_id = a.rentprog_id
WHERE
  d.car_db_id IS NULL
  OR (
    (a.company_id IS DISTINCT FROM d.company_id) OR
    (a.model IS DISTINCT FROM d.model) OR
    (a.plate IS DISTINCT FROM d.plate) OR
    (a.state IS DISTINCT FROM d.state) OR
    (a.transmission IS DISTINCT FROM d.transmission) OR
    (a.year IS DISTINCT FROM d.year) OR
    (a.number_doors IS DISTINCT FROM d.number_doors) OR
    (a.number_seats IS DISTINCT FROM d.number_seats) OR
    (a.is_air IS DISTINCT FROM d.is_air) OR
    (a.engine_capacity IS DISTINCT FROM d.engine_capacity) OR
    (a.engine_power IS DISTINCT FROM d.engine_power) OR
    (a.trunk_volume IS DISTINCT FROM d.trunk_volume) OR
    (a.avatar_url IS DISTINCT FROM d.avatar_url)
  )`;

// Но это сложно - n8n Postgres node не поддерживает параметры из предыдущего узла напрямую
// Лучше использовать Code node для сравнения

// 5. Заменяем "Compute Diff (SQL)" на Code node для сравнения
const compareNode = {
  "parameters": {
    "jsCode": `// Сравнение данных из API с БД
const apiItems = $input.all(0).map(item => item.json);
const dbItems = $input.all(1).map(item => item.json);

// Нормализация значений
const normalize = (val) => {
  if (val === null || val === undefined || val === '') return null;
  const str = String(val).trim();
  return str === '' || str.toLowerCase() === 'null' ? null : str;
};

// Мапа машин из БД
const dbMap = new Map();
dbItems.forEach(car => {
  if (car && car.rentprog_id) {
    dbMap.set(String(car.rentprog_id), car);
  }
});

const discrepancies = [];

// Поля для сравнения
const fieldMapping = {
  car_name: 'model',
  number: 'plate',
  state: 'state',
  transmission: 'transmission',
  year: 'year',
  number_doors: 'number_doors',
  number_seats: 'number_seats',
  is_air: 'is_air',
  engine_capacity: 'engine_capacity',
  engine_power: 'engine_power',
  trunk_volume: 'trunk_volume',
  avatar_url: 'avatar_url',
  company_id: 'company_id'
};

apiItems.forEach(apiCar => {
  if (!apiCar || !apiCar.id) return;

  const rentprogId = String(apiCar.id);
  const dbCar = dbMap.get(rentprogId);

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

  // plate (number → plate)
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

  // state
  const apiState = normalize(apiCar.state !== undefined ? String(apiCar.state) : null);
  const dbState = normalize(dbCar.state);
  if (apiState !== dbState) {
    fieldDiffs.push({
      field: 'state',
      fieldNameRu: 'Статус',
      apiValue: apiState,
      dbValue: dbState
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

return discrepancies.map(d => ({ json: d }));`
  },
  "id": "compare-api-db",
  "name": "Compare API vs DB",
  "type": "n8n-nodes-base.code",
  "typeVersion": 2,
  "position": [1450, 525]
};

// Заменяем "Compute Diff (SQL)" на Code node
const computeDiffIndex = workflow.nodes.findIndex(n => n.id === 'compute-diff');
if (computeDiffIndex !== -1) {
  workflow.nodes[computeDiffIndex] = compareNode;
  console.log('✅ Заменен "Compute Diff (SQL)" на "Compare API vs DB" (Code node)');
}

// 6. Добавляем узел "Get Cars from DB" для получения данных из БД
const getCarsFromDBNode = {
  "parameters": {
    "operation": "executeQuery",
    "query": `SELECT
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
  b.code AS branch_code
FROM cars c
JOIN external_refs er ON er.entity_id = c.id
JOIN branches b ON b.id = c.branch_id
WHERE er.system = 'rentprog'
  AND er.entity_type = 'car'`,
    "options": {}
  },
  "id": "get-cars-from-db",
  "name": "Get Cars from DB",
  "type": "n8n-nodes-base.postgres",
  "typeVersion": 2.4,
  "position": [1250, 525],
  "credentials": {
    "postgres": {
      "id": "3I9fyXVlGg4Vl4LZ",
      "name": "Postgres account"
    }
  }
};

workflow.nodes.push(getCarsFromDBNode);
console.log('✅ Добавлен узел "Get Cars from DB"');

// 7. Изменяем "Prepare Updates" → "Prepare Report" (убираем логику генерации SQL)
const prepareUpdatesNode = workflow.nodes.find(n => n.id === 'prepare-updates');
if (prepareUpdatesNode) {
  prepareUpdatesNode.name = "Prepare Report";
  prepareUpdatesNode.parameters.jsCode = `// Подготовка отчета о расхождениях (без генерации SQL)
const items = $input.all();

if (!items || items.length === 0) {
  return [{ json: { hasChanges: false, discrepancies: [] } }];
}

const discrepancies = [];

items.forEach(item => {
  const data = item.json;
  discrepancies.push(data);
});

return [{
  json: {
    hasChanges: discrepancies.length > 0,
    totalDiscrepancies: discrepancies.length,
    discrepancies: discrepancies
  }
}];`;
  console.log('✅ Изменен "Prepare Updates" → "Prepare Report" (убрана логика генерации SQL)');
}

// 8. Обновляем connections
workflow.connections = {
  "Daily at 04:00 Tbilisi": {
    "main": [
      [
        { "node": "Get Token Tbilisi", "type": "main", "index": 0 },
        { "node": "Get Token Batumi", "type": "main", "index": 0 },
        { "node": "Get Token Kutaisi", "type": "main", "index": 0 },
        { "node": "Get Token Service", "type": "main", "index": 0 }
      ]
    ]
  },
  "Get Token Tbilisi": {
    "main": [[{ "node": "Get Cars Tbilisi", "type": "main", "index": 0 }]]
  },
  "Get Token Batumi": {
    "main": [[{ "node": "Get Cars Batumi", "type": "main", "index": 0 }]]
  },
  "Get Token Kutaisi": {
    "main": [[{ "node": "Get Cars Kutaisi", "type": "main", "index": 0 }]]
  },
  "Get Token Service": {
    "main": [[{ "node": "Get Cars Service", "type": "main", "index": 0 }]]
  },
  "Get Cars Tbilisi": {
    "main": [[{ "node": "Flatten Tbilisi", "type": "main", "index": 0 }]]
  },
  "Get Cars Batumi": {
    "main": [[{ "node": "Flatten Batumi", "type": "main", "index": 0 }]]
  },
  "Get Cars Kutaisi": {
    "main": [[{ "node": "Flatten Kutaisi", "type": "main", "index": 0 }]]
  },
  "Get Cars Service": {
    "main": [[{ "node": "Flatten Service", "type": "main", "index": 0 }]]
  },
  "Flatten Tbilisi": {
    "main": [[{ "node": "Merge All API Cars", "type": "main", "index": 0 }]]
  },
  "Flatten Batumi": {
    "main": [[{ "node": "Merge All API Cars", "type": "main", "index": 1 }]]
  },
  "Flatten Kutaisi": {
    "main": [[{ "node": "Merge All API Cars", "type": "main", "index": 2 }]]
  },
  "Flatten Service": {
    "main": [[{ "node": "Merge All API Cars", "type": "main", "index": 3 }]]
  },
  "Merge All API Cars": {
    "main": [
      [
        { "node": "Compare API vs DB", "type": "main", "index": 0 }
      ]
    ]
  },
  "Get Cars from DB": {
    "main": [
      [
        { "node": "Compare API vs DB", "type": "main", "index": 1 }
      ]
    ]
  },
  "Compare API vs DB": {
    "main": [
      [
        { "node": "Prepare Report", "type": "main", "index": 0 }
      ]
    ]
  },
  "Prepare Report": {
    "main": [
      [
        { "node": "If Has Changes", "type": "main", "index": 0 }
      ]
    ]
  },
  "If Has Changes": {
    "main": [
      [
        { "node": "Format Alert", "type": "main", "index": 0 }
      ]
    ]
  },
  "Format Alert": {
    "main": [
      [
        { "node": "Send Telegram Alert", "type": "main", "index": 0 }
      ]
    ]
  }
};

console.log('✅ Обновлены connections');

// 9. Обновляем "Format Alert" для работы с новой структурой данных
const formatAlertNode = workflow.nodes.find(n => n.id === 'format-alert');
if (formatAlertNode) {
  formatAlertNode.parameters.jsCode = `const { totalDiscrepancies, discrepancies } = $json;

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

  if (d.type === 'field_mismatch') {
    const plate = showValue(d.plate);
    const model = showValue(d.model);
    lines.push(\`🚗 \${plate} (\${model})\`);

    // Показываем ВСЕ поля с изменениями
    for (const field of d.fields) {
      const oldVal = showValue(field.dbValue, field.field);
      const newVal = showValue(field.apiValue, field.field);
      lines.push(\`   \${field.fieldNameRu}: \${oldVal} → \${newVal}\`);
    }

    lines.push('   💡 Запустите скрипт restore_cars_from_rentprog.mjs для обновления');
    lines.push('');
  }
}

lines.push('━'.repeat(30));
lines.push(\`🕐 \${new Date().toLocaleString('ru-RU', { timeZone: 'Asia/Tbilisi' })}\`);

return [{ json: { alertText: lines.join('\\n') } }];`;
  console.log('✅ Обновлен "Format Alert" для новой структуры данных');
}

// Сохраняем обновленный workflow
fs.writeFileSync(workflowPath, JSON.stringify(workflow, null, 2), 'utf-8');

console.log('\n✅ Workflow упрощен!');
console.log('\n📋 Изменения:');
console.log('   1. Удалены узлы: Upsert Snapshot, Generate SQL Updates, Apply Updates');
console.log('   2. Добавлен узел: Get Cars from DB (для получения данных из БД)');
console.log('   3. Заменен "Compute Diff (SQL)" на "Compare API vs DB" (Code node)');
console.log('   4. Изменен "Prepare Updates" → "Prepare Report" (только отчет, без SQL)');
console.log('   5. Обновлен "Format Alert" для новой структуры данных');
console.log('   6. Обновлены connections');
console.log('\n⚠️  ВАЖНО: Нужно импортировать обновленный workflow в n8n!');

