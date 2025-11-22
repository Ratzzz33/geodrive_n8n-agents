#!/usr/bin/env node
/**
 * Обновляет workflow RentProg bookings:
 *  - Добавляет Postgres-ноду Get Car IDs (если её нет)
 *  - Подключает её к Schedule и Process All Bookings (второй вход)
 *  - Обновляет jsCode в Process All Bookings для работы с Merge + картой автомобилей
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const INPUT_FILE = process.argv[2] || path.join(__dirname, '..', 'n8n-workflows', 'rentprog-bookings-current.json');
const OUTPUT_FILE = process.argv[3] || path.join(__dirname, '..', 'n8n-workflows', '_RentProg__P3BnmX7Nrmh1cusF_carid.json');

const PROCESS_NODE = 'Process All Bookings';
const SCHEDULE_NODE = 'Every 60 Minutes';
const CAR_NODE = 'Get Car IDs';
const MERGE_NODE = 'Merge All Branches';

const PROCESS_JS = `// Обрабатываем все брони по филиалам + карта автомобилей
const branchItems = (() => {
  try {
    return $input.all(0);
  } catch (err) {
    console.warn('⚠️  Нет данных от Merge All Branches');
    return [];
  }
})();

const carItems = (() => {
  try {
    return $items('Get Car IDs', 'main', 0, { returnAll: true }) || [];
  } catch (err) {
    console.warn('⚠️  Нет данных из Get Car IDs');
    return [];
  }
})();

function normalizeCode(value) {
  return (value ?? '').toString().trim().toLowerCase();
}

const carIdMap = new Map();
carItems.forEach(item => {
  const code = normalizeCode(item.json?.code || item.json?.car_code);
  const id = item.json?.id;
  if (code && id) {
    carIdMap.set(code, id);
  }
});
console.log('Car codes in map:', carIdMap.size);

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

branchItems.forEach((item, index) => {
  const json = item.json;
  const mapping = branchMapping[index] || { branch: 'unknown', active: null };

  if (json.error) {
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
  bookingsData.forEach(booking => {
    const attrs = booking.attributes || booking;
    const technicalInfo = getTechnicalType(attrs);
    const clientName = [attrs.first_name, attrs.middle_name, attrs.last_name]
      .filter(Boolean)
      .join(' ');

    const carCode = attrs.car_code || '';
    const rentprogCarIdRaw = attrs.car_id ?? attrs.carId ?? null;
    const rentprogCarId = rentprogCarIdRaw !== null && rentprogCarIdRaw !== undefined
      ? String(rentprogCarIdRaw)
      : null;
    const carId = carIdMap.get(normalizeCode(carCode)) || null;
    const payloadJson = JSON.stringify(attrs ?? {});

    results.push({
      json: {
        branch: mapping.branch,
        number: attrs.number,
        is_active: mapping.active,
        start_date: attrs.start_date,
        end_date: attrs.end_date,
        start_date_formatted: attrs.start_date_formatted,
        end_date_formatted: attrs.end_date_formatted,
        created_at: attrs.created_at,
        client_name: clientName,
        client_category: attrs.client_category,
        car_name: attrs.car_name,
        car_code: carCode,
        rentprog_car_id: rentprogCarId,
        car_id: carId,
        location_start: attrs.location_start,
        location_end: attrs.location_end,
        total: attrs.total,
        deposit: attrs.deposit,
        rental_cost: attrs.rental_cost,
        days: attrs.days,
        state: attrs.state,
        in_rent: attrs.in_rent,
        archive: attrs.archive,
        start_worker_id: attrs.start_worker_id,
        end_worker_id: attrs.end_worker_id,
        responsible: attrs.responsible,
        description: attrs.description,
        source: attrs.source,
        is_technical: technicalInfo.is_technical,
        technical_type: technicalInfo.technical_type,
        technical_purpose: technicalInfo.technical_purpose,
        data: payloadJson,
        payload_json: payloadJson,
      },
    });
  });
});

console.log('Total results:', results.length);

return results;`;

function ensureCarNode(workflow) {
  let node = workflow.nodes.find(n => n.name === CAR_NODE);
  if (!node) {
    node = {
      parameters: {
        operation: 'executeQuery',
        query: 'SELECT code, id FROM cars WHERE code IS NOT NULL',
      },
      name: CAR_NODE,
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
    workflow.nodes.push(node);
  }
  return node;
}

function ensureScheduleConnection(workflow) {
  const scheduleConn = workflow.connections[SCHEDULE_NODE];
  if (!scheduleConn?.main?.[0]) return;
  const exists = scheduleConn.main[0].some(
    conn => conn.node === CAR_NODE,
  );
  if (!exists) {
    scheduleConn.main[0].push({
      node: CAR_NODE,
      type: 'main',
      index: 0,
    });
  }
}

function ensureCarToProcessConnection(workflow) {
  workflow.connections[CAR_NODE] = {
    main: [
      [
        {
          node: PROCESS_NODE,
          type: 'main',
          index: 1,
        },
      ],
    ],
  };
}

function updateProcessNode(workflow) {
  const process = workflow.nodes.find(n => n.name === PROCESS_NODE);
  if (!process) throw new Error('Process All Bookings node not found');
  process.parameters.jsCode = PROCESS_JS;
}

function main() {
  const workflow = JSON.parse(fs.readFileSync(INPUT_FILE, 'utf8'));

  ensureCarNode(workflow);
  ensureScheduleConnection(workflow);
  ensureCarToProcessConnection(workflow);
  updateProcessNode(workflow);

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(workflow, null, 2));
  console.log(`✅ Workflow patched: ${OUTPUT_FILE}`);
}

main();

