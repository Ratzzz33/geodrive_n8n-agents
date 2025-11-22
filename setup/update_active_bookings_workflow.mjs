import fs from 'node:fs/promises';
import path from 'node:path';

const workflowPath = path.resolve('n8n-workflows/_RentProg__Active_Bookings.json');

const fetchCode = `// Загружаем все страницы активных/новых броней по каждому филиалу
const branches = [
  {
    branch: 'tbilisi',
    active: true,
    token: 'Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxNjA0NiIsInNjcCI6InVzZXIiLCJhdWQiOm51bGwsImlhdCI6MTc2MjQ1OTY2MCwiZXhwIjoxNzY1MDUxNjYwLCJqdGkiOiIxOTFjMDY4ZS1jOGNhLTQ4OWEtODk0OS1iMjJkMmUzODE2ZDIifQ.G4_I4D96Flv4rP3JwjwDPpEHaH6ShSb0YRRQG8PasXk',
    extraHeaders: {
      Origin: 'https://web.rentprog.ru',
      Referer: 'https://web.rentprog.ru/'
    }
  },
  {
    branch: 'batumi',
    active: true,
    token: 'Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxNjA0OCIsInNjcCI6InVzZXIiLCJhdWQiOm51bGwsImlhdCI6MTc2MjQ2MDAyNSwiZXhwIjoxNzY1MDUyMDI1LCJqdGkiOiI0ZmQ2ODE4Yy0zYWNiLTRmZmQtOGZmYS0wZWMwZDkyMmIyMzgifQ.16s2ruRb3x_S7bgy4zF7TW9dSQ3ITqX3kei8recyH_8'
  },
  {
    branch: 'kutaisi',
    active: true,
    token: 'Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxNjA0OSIsInNjcCI6InVzZXIiLCJhdWQiOm51bGwsImlhdCI6MTc2MjQ2MDE3MiwiZXhwIjoxNzY1MDUyMTcyLCJqdGkiOiJmNzE1NGQ3MC0zZWFmLTRiNzItYTI3Ni0yZTg3MmQ4YjA0YmQifQ.1vd1kNbWB_qassLVqoxgyRsRJwtPsl7OR28gVsCxmwY'
  },
  {
    branch: 'service-center',
    active: true,
    token: 'Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxNjA0NSIsInNjcCI6InVzZXIiLCJhdWQiOm51bGwsImlhdCI6MTc2MjQ1OTM4MSwiZXhwIjoxNzY1MDUxMzgxLCJqdGkiOiI4ZDdkYjYyNi1jNWJiLTQ0MWMtYTNlMy00YjQwOWFmODQ1NmUifQ.32BRzttLFFgOgMv-VusAXK8mmyvrk4X-pb_rHQHSFbw'
  }
];

const perPage = 50;
const filters = {
  start_date_from: '2025-10-14',
  state: ['Активная', 'Новая']
};

const results = [];

for (const config of branches) {
  const aggregated = [];
  let page = 1;

  while (true) {
    const body = {
      model: 'booking',
      page,
      per_page: perPage,
      filters
    };

    const response = await this.helpers.httpRequest({
      method: 'POST',
      uri: 'https://rentprog.net/api/v1/index_with_search',
      headers: {
        Authorization: config.token,
        Accept: 'application/json',
        ...(config.extraHeaders || {})
      },
      body,
      json: true,
      timeout: 60000
    });

    const pageData = response?.bookings?.data || [];
    aggregated.push(...pageData);

    if (pageData.length < perPage) {
      break;
    }

    page += 1;
    if (page > 50) {
      throw new Error(\`Too many pages for \${config.branch}\`);
    }
  }

  console.log(\`Fetched \${aggregated.length} bookings for \${config.branch}\`);

  results.push({
    json: {
      branch: config.branch,
      active: config.active,
      bookings: {
        data: aggregated
      }
    }
  });
}

return results;`;

const processCode = `// Обрабатываем все брони по филиалам + карта автомобилей
const branchItems = (() => {
  try {
    return $input.all(0);
  } catch (err) {
    console.warn('⚠️  Нет данных от Fetch Branch Bookings');
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

const branchMappingByName = new Map(branchMapping.map(item => [item.branch, item]));

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
  const branchKey = json.branch || branchMapping[index]?.branch;
  const fallback = branchMapping[index] || { branch: branchKey || 'unknown', active: null };
  const mapping = branchMappingByName.get(branchKey) || fallback;
  const isActiveFlag = mapping.active ?? json.active ?? null;

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
        is_active: isActiveFlag,
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

const workflow = JSON.parse(await fs.readFile(workflowPath, 'utf8'));

const nodesToRemove = new Set([
  'Get Tbilisi Active',
  'Get Batumi Active',
  'Get Kutaisi Active',
  'Get Service Active',
  'Merge All Branches',
]);

workflow.nodes = workflow.nodes
  .filter((node) => !nodesToRemove.has(node.name) && node.name !== 'Fetch Branch Bookings');

workflow.nodes.push({
  parameters: { jsCode: fetchCode },
  name: 'Fetch Branch Bookings',
  type: 'n8n-nodes-base.code',
  typeVersion: 2,
  position: [560, 448],
  id: 'e3b2309b-0113-4cb9-9b28-1d4dc1ff33a5',
});

const processNode = workflow.nodes.find((node) => node.name === 'Process All Bookings');
if (!processNode) {
  throw new Error('Process All Bookings node not found');
}
processNode.parameters.jsCode = processCode;

for (const key of Object.keys(workflow.connections)) {
  if (nodesToRemove.has(key)) {
    delete workflow.connections[key];
  }
}

workflow.connections['Fetch Branch Bookings'] = {
  main: [
    [
      {
        node: 'Process All Bookings',
        type: 'main',
        index: 0,
      },
    ],
  ],
};

workflow.connections['Every 5 Minutes'] = {
  main: [
    [
      {
        node: 'Fetch Branch Bookings',
        type: 'main',
        index: 0,
      },
      {
        node: 'Get Car IDs',
        type: 'main',
        index: 0,
      },
    ],
  ],
};

await fs.writeFile(workflowPath, JSON.stringify(workflow, null, 2) + '\n', 'utf8');
console.log('✅ Workflow updated with pagination and new branching logic.');
