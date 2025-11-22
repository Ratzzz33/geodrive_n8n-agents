#!/usr/bin/env node

/**
 * Исправление workflow активных и новых броней через MCP - добавление client_id
 * 
 * Используем:
 * - mcp_n8n-mcp-official_n8n_update_partial_workflow для точечных изменений
 */

console.log('🔧 Исправление workflow активных и новых броней через MCP...\n');

// Изменения для ноды "Process All Bookings"
const processNodeUpdate = {
  type: 'updateNode',
  nodeName: 'Process All Bookings',
  changes: {
    parameters: {
      jsCode: `// ✅ ПРАВИЛЬНЫЙ КОД для ноды "Process All Bookings"
// 
// Архитектура:
// - Брони СКВОЗНЫЕ для компании (как платежи, сотрудники)
// - rentprog_id - ЕДИНСТВЕННЫЙ правильный глобальный идентификатор
// - Филиал определяется через: location_start → cities → branch_id (fallback через company_id)
//
// Этот workflow парсит ВСЕ филиалы, поэтому филиал определяется по company_id из брони

// Обрабатываем все брони по филиалам + карта автомобилей
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
    const offsetDate = \`\${year}-\${month}-\${day}T\${hours}:\${minutes}:00+04:00\`;
    const iso = tryParse(offsetDate);
    return iso || offsetDate;
  }

  return tryParse(value);
}

// ⚠️ Маппинг company_id → branch_id (для fallback)
const COMPANY_ID_TO_BRANCH_ID = {
  9247: '277eaada-1428-4c04-9cd7-5e614e43bedc',   // tbilisi
  9248: '5e551b32-934c-498f-a4a1-a90079985c0a',   // kutaisi
  9506: '627c4c88-d8a1-47bf-b9a6-2e9ad33112a4',   // batumi
  11163: '6026cff7-eee8-4fb9-be26-604f308911f0',  // service-center
};

const COMPANY_ID_TO_BRANCH_CODE = {
  9247: 'tbilisi',
  9248: 'kutaisi',
  9506: 'batumi',
  11163: 'service-center',
};

const branchMapping = [
  { branch: 'tbilisi', active: true, defaultCompanyId: 9247 },
  { branch: 'batumi', active: true, defaultCompanyId: 9506 },
  { branch: 'kutaisi', active: true, defaultCompanyId: 9248 },
  { branch: 'service-center', active: true, defaultCompanyId: 11163 },
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
const skippedBookings = [];  // ✅ Собираем пропущенные брони

branchItems.forEach((item, index) => {
  const json = item.json;
  const mapping = branchMapping[index] || { branch: 'unknown', active: null, defaultCompanyId: null };

  if (json.error) {
    results.push({
      json: {
        error: true,
        error_message: json.error || 'Unknown error',
      },
    });
    return;
  }

  const bookingsData = json.bookings?.data || [];
  bookingsData.forEach(booking => {
    const attrs = booking.attributes || booking;
    
    // ✅ КРИТИЧНАЯ ВАЛИДАЦИЯ: rentprog_id (глобальный ID)
    const rentprogId = attrs.id;
    
    if (!rentprogId) {
      console.warn(\`⚠️  Skipping booking without rentprog_id (attrs.id)\`);
      skippedBookings.push({
        reason: 'Missing rentprog_id (attrs.id)',
        branch: mapping.branch,
        client_name: [attrs.first_name, attrs.middle_name, attrs.last_name]
          .filter(Boolean)
          .join(' ') || 'N/A',
        car_name: attrs.car_name || 'N/A',
        number: attrs.number || 'N/A',
      });
      return;  // Пропускаем эту бронь
    }
    
    // ⚠️ Валидация number (для удобства, не критично)
    const number = attrs.number;
    if (!number) {
      console.warn(\`⚠️  Booking \${rentprogId} has no number field\`);
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
    
    // ✅ Извлекаем client_id из RentProg
    const rentprogClientIdRaw = attrs.client_id ?? null;
    const rentprogClientId = rentprogClientIdRaw !== null && rentprogClientIdRaw !== undefined
      ? String(rentprogClientIdRaw)
      : null;
    
    const payloadObject = attrs ? JSON.parse(JSON.stringify(attrs)) : {};
    const payloadJson = JSON.stringify(payloadObject);
    const startAtISO = convertDateToISO(attrs.start_date_formatted || attrs.start_date);
    const endAtISO = convertDateToISO(attrs.end_date_formatted || attrs.end_date);

    // ✅ Определение филиала через company_id из брони (источник истины)
    const companyId = attrs.company_id || mapping.defaultCompanyId;
    const branchId = COMPANY_ID_TO_BRANCH_ID[companyId] || null;
    const branchCode = COMPANY_ID_TO_BRANCH_CODE[companyId] || mapping.branch;

    results.push({
      json: {
        // ✅ ГЛОБАЛЬНЫЙ ИДЕНТИФИКАТОР (источник истины)
        rentprog_id: String(rentprogId),
        
        // ✅ Локации (источник истины для филиала)
        location_start: attrs.location_start,
        location_end: attrs.location_end,
        
        // ✅ Fallback для определения филиала
        branch_id: branchId,
        
        // ⚠️ Денормализация (для быстрых запросов)
        branch: branchCode,
        number: number,
        
        // Остальные поля
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
        rentprog_client_id: rentprogClientId,  // ✅ ДОБАВЛЕНО!
        car_id: carId,
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
console.log('Skipped bookings:', skippedBookings.length);

// ✅ Добавляем информацию о пропущенных бронях
if (results.length > 0) {
  results[0].json._skipped_bookings = skippedBookings;
  results[0].json._skipped_count = skippedBookings.length;
}

return results;`
    }
  }
};

// Изменения для ноды "Save to DB" - добавляем client_id
const saveNodeUpdate = {
  type: 'updateNode',
  nodeName: 'Save to DB',
  changes: {
    parameters: {
      columns: {
        mappingMode: 'defineBelow',
        value: {
          rentprog_id: '={{ $json.rentprog_id }}',
          number: '={{ $json.number }}',
          branch_id: '={{ $json.branch_id }}',
          branch: '={{ $json.branch }}',
          is_active: '={{ $json.is_active }}',
          is_technical: '={{ $json.is_technical }}',
          start_date: '={{ $json.start_date }}',
          end_date: '={{ $json.end_date }}',
          start_date_formatted: '={{ $json.start_date_formatted }}',
          end_date_formatted: '={{ $json.end_date_formatted }}',
          start_at: '={{ $json.start_at }}',
          end_at: '={{ $json.end_at }}',
          created_at: '={{ $json.created_at }}',
          client_name: '={{ $json.client_name }}',
          client_category: '={{ $json.client_category }}',
          car_name: '={{ $json.car_name }}',
          car_code: '={{ $json.car_code }}',
          rentprog_car_id: '={{ $json.rentprog_car_id }}',
          car_id: '={{ $json.car_id }}',
          client_id: '={{ $json.rentprog_client_id }}',  // ✅ ДОБАВЛЕНО!
          location_start: '={{ $json.location_start }}',
          location_end: '={{ $json.location_end }}',
          total: '={{ $json.total }}',
          deposit: '={{ $json.deposit }}',
          rental_cost: '={{ $json.rental_cost }}',
          days: '={{ $json.days }}',
          state: '={{ $json.state }}',
          in_rent: '={{ $json.in_rent }}',
          archive: '={{ $json.archive }}',
          start_worker_id: '={{ $json.start_worker_id }}',
          end_worker_id: '={{ $json.end_worker_id }}',
          responsible: '={{ $json.responsible }}',
          description: '={{ $json.description }}',
          source: '={{ $json.source }}',
          technical_type: '={{ $json.technical_type }}',
          technical_purpose: '={{ $json.technical_purpose }}',
          data: '={{ $json.data }}',
          payload_json: '={{ $json.payload_json }}'
        },
        matchingColumns: ['rentprog_id']
      }
    }
  }
};

console.log('📝 Изменения подготовлены:');
console.log('   1. "Process All Bookings" - добавлено извлечение client_id');
console.log('   2. "Save to DB" - добавлено поле client_id');
console.log('\n✅ Операции готовы для MCP');
console.log('\nИспользуйте MCP инструмент:');
console.log('mcp_n8n-mcp-official_n8n_update_partial_workflow');
console.log('workflow_id: rCCVTgR2FcWWRxpq');
console.log('operations: [processNodeUpdate, saveNodeUpdate]');

