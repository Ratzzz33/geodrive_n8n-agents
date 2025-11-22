#!/usr/bin/env node
/**
 * Локально обновляет файл n8n-workflows/_RentProg__Active_Bookings.json:
 * заменяет ноду "Save to DB" на Code-ноду с новым кодом.
 */

import { readFileSync, writeFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const WORKFLOW_PATH = path.join(
  __dirname,
  '..',
  'n8n-workflows',
  '_RentProg__Active_Bookings.json',
);
const PROCESS_CODE = `// Обрабатываем все брони по филиалам + карта автомобилей
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

function convertDateToISO(rawValue) {
  if (!rawValue) {
    return null;
  }

  const value = rawValue.toString().trim();
  if (!value) {
    return null;
  }

  const tryParse = (input) => {
    const parsed = new Date(input);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  };

  if (value.includes('T')) {
    const iso = tryParse(value);
    if (iso) {
      return iso;
    }
  }

  const match = value.match(/^(\\d{2})-(\\d{2})-(\\d{4})(?:\\s+(\\d{2}):(\\d{2}))?$/);
  if (match) {
    const day = match[1];
    const month = match[2];
    const year = match[3];
    const hours = match[4] || '00';
    const minutes = match[5] || '00';
    const offsetDate = year + '-' + month + '-' + day + 'T' + hours + ':' + minutes + ':00+04:00';
    const iso = tryParse(offsetDate);
    return iso || offsetDate;
  }

  return tryParse(value);
}

const branchMapping = [
  { branch: 'tbilisi', active: true },
  { branch: 'batumi', active: true },
  { branch: 'kutaisi', active: true },
  { branch: 'service-center', active: true },
];

function getTechnicalType(attrs) {
  const firstName = (attrs.first_name || '').toLowerCase();
  const lastName = (attrs.last_name || '').toLowerCase();
  const clientName = (firstName + ' ' + lastName).trim().toLowerCase();
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
    const bookingId = booking.id || attrs.id || null;

    if (!bookingId) {
      return;
    }

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
    const payloadObject = attrs ? JSON.parse(JSON.stringify(attrs)) : {};
    delete payloadObject.id;
    payloadObject.rentprog_id = String(bookingId);

    const startAtISO = convertDateToISO(attrs.start_date_formatted || attrs.start_date);
    const endAtISO = convertDateToISO(attrs.end_date_formatted || attrs.end_date);

    payloadObject.branch = mapping.branch;
    payloadObject.start_at = startAtISO;
    payloadObject.end_at = endAtISO;
    payloadObject.client_name = clientName;
    payloadObject.car_code = carCode;
    payloadObject.car_name = attrs.car_name || payloadObject.car_name;
    payloadObject.location_start = attrs.location_start;
    payloadObject.location_end = attrs.location_end;
    payloadObject.total = attrs.total;
    payloadObject.deposit = attrs.deposit;
    payloadObject.rental_cost = attrs.rental_cost;
    payloadObject.days = attrs.days;
    payloadObject.state = attrs.state;
    payloadObject.in_rent = attrs.in_rent;
    payloadObject.archive = attrs.archive;
    payloadObject.description = attrs.description;
    payloadObject.source = attrs.source;

    const payloadJson = JSON.stringify(payloadObject);

    results.push({
      json: {
        table_name: 'bookings',
        branch: mapping.branch,
        booking_id: String(bookingId),
        number: attrs.number,
        is_active: mapping.active,
        start_date: attrs.start_date,
        end_date: attrs.end_date,
        start_date_formatted: attrs.start_date_formatted,
        end_date_formatted: attrs.end_date_formatted,
        start_at: startAtISO,
        end_at: endAtISO,
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
        data: payloadObject,
        payload_json: payloadJson,
      },
    });
  });
});

console.log('Total results:', results.length);

return results;`;

const SAVE_QUERY = `SELECT * FROM dynamic_upsert_entity(
  $1::TEXT,
  $2::TEXT,
  $3::JSONB
);`;

function patchWorkflow() {
  const raw = readFileSync(WORKFLOW_PATH, 'utf8');
  const workflow = JSON.parse(raw);

  workflow.nodes = workflow.nodes.map((node) => {
    if (node.name === 'Process All Bookings') {
      return {
        ...node,
        parameters: {
          ...node.parameters,
          jsCode: PROCESS_CODE,
        },
      };
    }

    if (node.name !== 'Save to DB') {
      return node;
    }

    return {
      ...node,
      type: 'n8n-nodes-base.postgres',
      typeVersion: 2.5,
      parameters: {
        operation: 'executeQuery',
        query: SAVE_QUERY,
        options: {
          queryReplacement: "={{ $json.table_name }},={{ $json.booking_id }},={{ $json.payload_json }}",
        },
      },
      credentials: {
        postgres: {
          id: '3I9fyXVlGg4Vl4LZ',
          name: 'Postgres account',
        },
      },
    };
  });


  writeFileSync(WORKFLOW_PATH, JSON.stringify(workflow, null, 2));
  console.log('✅ Workflow file updated:', WORKFLOW_PATH);
}

patchWorkflow();


