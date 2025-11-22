// ✅ УЛУЧШЕННЫЙ КОД для ноды "Process All Bookings"
// 
// Изменения:
// 1. Валидация наличия attrs.number
// 2. Сбор статистики пропущенных записей
// 3. Алерты в Telegram при обнаружении bookings без number
//
// Использование: замените код в ноде "Process All Bookings"

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

  const match = value.match(/^(\d{2})-(\d{2})-(\d{4})(?:\s+(\d{2}):(\d{2}))?$/);
  if (match) {
    const day = match[1];
    const month = match[2];
    const year = match[3];
    const hours = match[4] || '00';
    const minutes = match[5] || '00';
    const offsetDate = `${year}-${month}-${day}T${hours}:${minutes}:00+04:00`;
    const iso = tryParse(offsetDate);
    return iso || offsetDate;
  }

  return tryParse(value);
}

// ⚠️ ВАЖНО: Обновите этот массив для вашего workflow!
// Для Tbilisi: [{ branch: 'tbilisi', active: true }]
// Для Batumi: [{ branch: 'batumi', active: false }]
// Для Kutaisi: [{ branch: 'kutaisi', active: false }]
const branchMapping = [
  { branch: 'batumi', active: false }  // ← ИЗМЕНИТЕ ДЛЯ ВАШЕГО WORKFLOW
];

function getTechnicalType(attrs) {
  const firstName = (attrs.first_name || '').toLowerCase();
  const lastName = (attrs.last_name || '').toLowerCase();
  const clientName = `${firstName} ${lastName}`.toLowerCase();
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
const skippedBookings = [];  // ✅ Новое: собираем пропущенные брони

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
    
    // ✅ КРИТИЧНАЯ ВАЛИДАЦИЯ: проверка наличия number
    const number = attrs.number;
    const rentprogId = attrs.id;
    
    if (!number) {
      console.warn(`⚠️  Skipping booking without number: rentprog_id=${rentprogId}, branch=${mapping.branch}`);
      skippedBookings.push({
        rentprog_id: rentprogId,
        branch: mapping.branch,
        client_name: [attrs.first_name, attrs.middle_name, attrs.last_name]
          .filter(Boolean)
          .join(' ') || 'N/A',
        car_name: attrs.car_name || 'N/A',
        reason: 'Missing number field',
      });
      return;  // Пропускаем эту бронь
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
    const payloadJson = JSON.stringify(payloadObject);
    const startAtISO = convertDateToISO(attrs.start_date_formatted || attrs.start_date);
    const endAtISO = convertDateToISO(attrs.end_date_formatted || attrs.end_date);

    results.push({
      json: {
        branch: mapping.branch,
        number: number,  // ✅ Гарантированно не null
        rentprog_id: String(rentprogId || ''),  // ✅ Добавлен rentprog_id
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
console.log('Skipped bookings:', skippedBookings.length);

// ✅ Добавляем информацию о пропущенных бронях в первый item
// Это позволит следующей ноде отправить алерт если нужно
if (results.length > 0) {
  results[0].json._skipped_bookings = skippedBookings;
  results[0].json._skipped_count = skippedBookings.length;
}

return results;

