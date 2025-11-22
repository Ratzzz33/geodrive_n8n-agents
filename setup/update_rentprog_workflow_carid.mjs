#!/usr/bin/env node
/**
 * Подготовка workflow P3BnmX7Nrmh1cusF:
 *  - Добавляет Postgres-ноду с картой автомобилей (code -> id)
 *  - Обновляет Code-ноду "Process All Bookings" для установки car_id
 *  - Переподключает HTTP-ноды напрямую к Code-ноде и удаляет Merge
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const WORKFLOW_FILE = process.argv[2] || path.join(__dirname, '..', 'n8n-workflows', 'rentprog-bookings-latest.json');
const OUTPUT_FILE = process.argv[3] || path.join(__dirname, '..', 'n8n-workflows', '_RentProg__P3BnmX7Nrmh1cusF_prepared.json');

const HTTP_NODES_ORDER = [
  'Get Tbilisi Active',
  'Get Tbilisi Inactive',
  'Get Batumi Active',
  'Get Batumi Inactive',
  'Get Kutaisi Active',
  'Get Kutaisi Inactive',
  'Get Service Active',
  'Get Service Inactive',
];

const PROCESS_NODE_NAME = 'Process All Bookings';
const CAR_NODE_NAME = 'Get Car IDs';
const MERGE_NODE_NAME = 'Merge All Branches';

const PROCESS_JS = `// Обрабатываем все брони со всех филиалов
const BRANCH_INPUTS_COUNT = 8;
let allItems = [];
for (let i = 0; i < BRANCH_INPUTS_COUNT; i++) {
  try {
    const items = $input.all(i);
    if (items && items.length > 0) {
      allItems = allItems.concat(items);
    }
  } catch (e) {
    // Если входа нет, пропускаем
  }
}
console.log('Total input items:', allItems.length);

function normalizeCode(value) {
  return (value ?? '').toString().trim().toLowerCase();
}

const carMapInputIndex = BRANCH_INPUTS_COUNT; // индекс 8
const carIdMap = new Map();
try {
  const carItems = $input.all(carMapInputIndex);
  carItems.forEach(item => {
    const code = normalizeCode(item.json.code || item.json.car_code);
    if (code) {
      carIdMap.set(code, item.json.id);
    }
  });
  console.log(\`Loaded \${carIdMap.size} car codes\`);
} catch (err) {
  console.warn('⚠️  Не удалось загрузить карту автомобилей, car_id останется null');
}

const branchMapping = [
  { branch: 'tbilisi', active: true },
  { branch: 'tbilisi', active: false },
  { branch: 'batumi', active: true },
  { branch: 'batumi', active: false },
  { branch: 'kutaisi', active: true },
  { branch: 'kutaisi', active: false },
  { branch: 'service-center', active: true },
  { branch: 'service-center', active: false },
];

function getTechnicalType(attrs) {
  const firstName = (attrs.first_name || '').toLowerCase();
  const lastName = (attrs.last_name || '').toLowerCase();
  const clientName = \`\${firstName} \${lastName}\`.toLowerCase();
  const description = (attrs.description || '').toLowerCase();
  const locationStart = (attrs.location_start || '').toLowerCase();

  const isTechnical =
    clientName.includes('сервис') ||
    clientName.includes('сотрудник') ||
    clientName.includes('service') ||
    clientName.includes('employee') ||
    attrs.rental_cost === 0;

  if (!isTechnical) {
    return {
      is_technical: false,
      technical_type: 'regular',
      technical_purpose: null,
    };
  }

  const isRepair =
    clientName.includes('сервис') ||
    description.includes('ремонт') ||
    description.includes('repair') ||
    description.includes('fix') ||
    description.includes('сто') ||
    locationStart.includes('сервис') ||
    locationStart.includes('service');

  if (isRepair) {
    return {
      is_technical: true,
      technical_type: 'technical_repair',
      technical_purpose: 'repair',
    };
  }

  return {
    is_technical: true,
    technical_type: 'technical',
    technical_purpose: 'employee_trip',
  };
}

const results = [];

allItems.forEach((item, index) => {
  const json = item.json;
  const mapping = branchMapping[index] || { branch: 'unknown', active: null };

  if (json.error) {
    console.error(\`Error in item \${index}:\`, json.error);
    results.push({
      json: {
        branch: mapping.branch,
        error: true,
        error_message: json.error || 'Unknown error',
      },
    });
    return;
  }

  const bookingsData = json.bookings?.data || [];

  if (bookingsData.length === 0) {
    return;
  }

  bookingsData.forEach(booking => {
    const attrs = booking.attributes || booking;
    const technicalInfo = getTechnicalType(attrs);
    const clientName = [attrs.first_name, attrs.middle_name, attrs.last_name]
      .filter(Boolean)
      .join(' ');

    const carCode = attrs['car_code'] || '';
    const carId = carIdMap.get(normalizeCode(carCode)) || null;

    results.push({
      json: {
        branch: mapping.branch,
        number: attrs.number,
        is_active: mapping.active,
        start_date: attrs['start_date'],
        end_date: attrs['end_date'],
        start_date_formatted: attrs['start_date_formatted'],
        end_date_formatted: attrs['end_date_formatted'],
        created_at: attrs['created_at'],
        client_name: clientName,
        client_category: attrs['client_category'],
        car_name: attrs['car_name'],
        car_code: carCode,
        car_id: carId,
        location_start: attrs['location_start'],
        location_end: attrs['location_end'],
        total: attrs['total'],
        deposit: attrs['deposit'],
        rental_cost: attrs['rental_cost'],
        days: attrs['days'],
        state: attrs['state'],
        in_rent: attrs['in_rent'],
        archive: attrs['archive'],
        start_worker_id: attrs['start_worker_id'],
        end_worker_id: attrs['end_worker_id'],
        responsible: attrs['responsible'],
        description: attrs['description'],
        source: attrs['source'],
        is_technical: technicalInfo.is_technical,
        technical_type: technicalInfo.technical_type,
        technical_purpose: technicalInfo.technical_purpose,
        data: attrs,
      },
    });
  });
});

console.log(\`Total results: \${results.length}\`);

return results;`;

function main() {
  const workflow = JSON.parse(fs.readFileSync(WORKFLOW_FILE, 'utf8'));

  const processNode = workflow.nodes.find(n => n.name === PROCESS_NODE_NAME);
  if (!processNode) throw new Error('Process All Bookings node not found');
  processNode.parameters.jsCode = PROCESS_JS;

  // Удаляем Merge-ноду
  workflow.nodes = workflow.nodes.filter(n => n.name !== MERGE_NODE_NAME);
  delete workflow.connections[MERGE_NODE_NAME];

  // Добавляем Postgres-ноду, если её нет
  let carNode = workflow.nodes.find(n => n.name === CAR_NODE_NAME);
  if (!carNode) {
    carNode = {
      parameters: {
        operation: 'executeQuery',
        query: 'SELECT code, id FROM cars WHERE code IS NOT NULL',
      },
      name: CAR_NODE_NAME,
      type: 'n8n-nodes-base.postgres',
      typeVersion: 2.5,
      position: [720, 240],
      id: 'node-car-ids',
      credentials: {
        postgres: {
          id: '3I9fyXVlGg4Vl4LZ',
          name: 'Postgres account',
        },
      },
    };
    workflow.nodes.push(carNode);
  }

  // Переподключаем HTTP-ноды напрямую к Process
  HTTP_NODES_ORDER.forEach((nodeName, idx) => {
    const conn = workflow.connections[nodeName] || { main: [[]] };
    conn.main = conn.main || [];
    conn.main[0] = [
      {
        node: PROCESS_NODE_NAME,
        type: 'main',
        index: idx,
      },
    ];
    workflow.connections[nodeName] = conn;
  });

  // Подключаем Postgres-ноду
  workflow.connections[CAR_NODE_NAME] = {
    main: [
      [
        {
          node: PROCESS_NODE_NAME,
          type: 'main',
          index: HTTP_NODES_ORDER.length,
        },
      ],
    ],
  };

  // Удаляем связь Merge -> Process, если осталась
  if (workflow.connections[PROCESS_NODE_NAME]) {
    workflow.connections[PROCESS_NODE_NAME].main = workflow.connections[PROCESS_NODE_NAME].main || [];
  }

  // Добавляем триггер -> Get Car IDs
  const scheduleConnections = workflow.connections['Every 60 Minutes'];
  if (scheduleConnections?.main?.[0]) {
    const existing = scheduleConnections.main[0];
    const already = existing.some(c => c.node === CAR_NODE_NAME);
    if (!already) {
      existing.push({
        node: CAR_NODE_NAME,
        type: 'main',
        index: 0,
      });
    }
  }

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(workflow, null, 2));
  console.log(`✅ Workflow updated: ${OUTPUT_FILE}`);
}

main();

