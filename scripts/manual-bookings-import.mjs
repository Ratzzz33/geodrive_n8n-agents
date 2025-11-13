#!/usr/bin/env node

import 'dotenv/config';
import axios from 'axios';
import postgres from 'postgres';

const RENTPROG_URL = 'https://rentprog.net/api/v1/index_with_search';
const PER_PAGE = 100;

const BRANCHES = [
  {
    branch: 'tbilisi',
    token:
      'Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxNjA0NiIsInNjcCI6InVzZXIiLCJhdWQiOm51bGwsImlhdCI6MTc2MjQ1OTY2MCwiZXhwIjoxNzY1MDUxNjYwLCJqdGkiOiIxOTFjMDY4ZS1jOGNhLTQ4OWEtODk0OS1iMjJkMmUzODE2ZDIifQ.G4_I4D96Flv4rP3JwjwDPpEHaH6ShSb0YRRQG8PasXk'
  },
  {
    branch: 'batumi',
    token:
      'Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxNjA0OCIsInNjcCI6InVzZXIiLCJhdWQiOm51bGwsImlhdCI6MTc2MjQ2MDAyNSwiZXhwIjoxNzY1MDUyMDI1LCJqdGkiOiI0ZmQ2ODE4Yy0zYWNiLTRmZmQtOGZmYS0wZWMwZDkyMmIyMzgifQ.16s2ruRb3x_S7bgy4zF7TW9dSQ3ITqX3kei8recyH_8'
  },
  {
    branch: 'kutaisi',
    token:
      'Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxNjA0OSIsInNjcCI6InVzZXIiLCJhdWQiOm51bGwsImlhdCI6MTc2MjQ2MDE3MiwiZXhwIjoxNzY1MDUyMTcyLCJqdGkiOiJmNzE1NGQ3MC0zZWFmLTRiNzItYTI3Ni0yZTg3MmQ4YjA0YmQifQ.1vd1kNbWB_qassLVqoxgyRsRJwtPsl7OR28gVsCxmwY'
  },
  {
    branch: 'service-center',
    token:
      'Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxNjA0NSIsInNjcCI6InVzZXIiLCJhdWQiOm51bGwsImlhdCI6MTc2MjQ1OTM4MSwiZXhwIjoxNzY1MDUxMzgxLCJqdGkiOiI4ZDdkYjYyNi1jNWJiLTQ0MWMtYTNlMy00YjQwOWFmODQ1NmUifQ.32BRzttLFFgOgMv-VusAXK8mmyvrk4X-pb_rHQHSFbw'
  }
];

function sanitizeString(value) {
  if (value === undefined || value === null) return null;
  return String(value);
}

function toNumber(value) {
  if (value === undefined || value === null || value === '') return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function toBoolean(value) {
  if (value === undefined || value === null) return false;
  if (typeof value === 'boolean') return value;
  return ['true', '1', 'yes'].includes(String(value).toLowerCase());
}

function getTechnicalInfo(attrs) {
  const firstName = (attrs.first_name || '').toLowerCase();
  const lastName = (attrs.last_name || '').toLowerCase();
  const clientName = `${firstName} ${lastName}`.trim();
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
      technical_purpose: null
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
      technical_purpose: 'repair'
    };
  }

  return {
    is_technical: true,
    technical_type: 'technical',
    technical_purpose: 'employee_trip'
  };
}

async function fetchBookingsForBranch({ branch, token }) {
  const headers = {
    Authorization: token,
    Accept: 'application/json',
    'Content-Type': 'application/json',
    Origin: 'https://web.rentprog.ru',
    Referer: 'https://web.rentprog.ru/'
  };

  const allResults = [];

  for (const active of [true, false]) {
    let page = 1;
    let totalFetched = 0;

    console.log(`\n📥 ${branch.toUpperCase()} | ${active ? 'Активные' : 'Неактивные'} — старт`);

    while (true) {
      const payload = {
        model: 'booking',
        active,
        page,
        per_page: PER_PAGE,
        filters: {}
      };

      const { data } = await axios.post(RENTPROG_URL, payload, { headers });
      const bookings = data?.bookings?.data || [];

      if (!bookings.length) {
        console.log(`   Страница ${page}: записей нет, стоп`);
        break;
      }

      console.log(`   Страница ${page}: ${bookings.length} записей`);

      bookings.forEach((booking) => {
        const attrs = booking.attributes || booking;
        const technical = getTechnicalInfo(attrs);

        const clientName = [attrs.first_name, attrs.middle_name, attrs.last_name]
          .filter(Boolean)
          .join(' ');

        allResults.push({
          branch,
          booking_id: sanitizeString(booking.id || attrs.id),
          number: sanitizeString(attrs.number),
          is_active: Boolean(attrs.active ?? active),
          start_date: sanitizeString(attrs.start_date),
          end_date: sanitizeString(attrs.end_date),
          start_date_formatted: sanitizeString(attrs.start_date_formatted),
          end_date_formatted: sanitizeString(attrs.end_date_formatted),
          created_at: sanitizeString(attrs.created_at),
          client_id: sanitizeString(attrs.client_id),
          client_name: sanitizeString(clientName),
          client_category: sanitizeString(attrs.client_category),
          car_id: sanitizeString(attrs.car_id),
          car_name: sanitizeString(attrs.car_name),
          car_code: sanitizeString(attrs.car_code),
          location_start: sanitizeString(attrs.location_start),
          location_end: sanitizeString(attrs.location_end),
          total: toNumber(attrs.total),
          deposit: toNumber(attrs.deposit),
          rental_cost: toNumber(attrs.rental_cost),
          days: toNumber(attrs.days),
          state: sanitizeString(attrs.state),
          in_rent: toBoolean(attrs.in_rent),
          archive: toBoolean(attrs.archive),
          start_worker_id: sanitizeString(attrs.start_worker_id),
          end_worker_id: sanitizeString(attrs.end_worker_id),
          responsible: sanitizeString(attrs.responsible),
          description: sanitizeString(attrs.description),
          source: sanitizeString(attrs.source),
          data: attrs,
          is_technical: technical.is_technical,
          technical_type: technical.technical_type,
          technical_purpose: technical.technical_purpose
        });
      });

      totalFetched += bookings.length;
      page += 1;

      const total = data?.bookings?.meta?.total || data?.bookings?.meta?.pagination?.total;
      if (total && totalFetched >= total) {
        console.log(`   Получено ${totalFetched}/${total}, стоп`);
        break;
      }

      if (bookings.length < PER_PAGE) {
        console.log(`   Последняя страница: ${bookings.length} < ${PER_PAGE}`);
        break;
      }

      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  console.log(`✅ ${branch.toUpperCase()} — всего ${allResults.length} записей`);
  return allResults;
}

function chunk(array, size) {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

async function saveToDatabase(rows, sql) {
  if (!rows.length) return { saved: 0 };

  const columns = [
    'branch',
    'number',
    'is_active',
    'start_date',
    'end_date',
    'start_date_formatted',
    'end_date_formatted',
    'client_id',
    'client_name',
    'client_category',
    'car_id',
    'car_name',
    'car_code',
    'location_start',
    'location_end',
    'total',
    'deposit',
    'rental_cost',
    'days',
    'state',
    'in_rent',
    'archive',
    'start_worker_id',
    'end_worker_id',
    'responsible',
    'description',
    'source',
    'data',
    'is_technical',
    'technical_type',
    'technical_purpose'
  ];

  const result = await sql`
    INSERT INTO bookings ${sql(rows, ...columns)}
    ON CONFLICT (branch, number)
    DO UPDATE SET
      is_active = EXCLUDED.is_active,
      start_date = EXCLUDED.start_date,
      end_date = EXCLUDED.end_date,
      start_date_formatted = EXCLUDED.start_date_formatted,
      end_date_formatted = EXCLUDED.end_date_formatted,
      client_id = EXCLUDED.client_id,
      client_name = EXCLUDED.client_name,
      client_category = EXCLUDED.client_category,
      car_id = EXCLUDED.car_id,
      car_name = EXCLUDED.car_name,
      car_code = EXCLUDED.car_code,
      location_start = EXCLUDED.location_start,
      location_end = EXCLUDED.location_end,
      total = EXCLUDED.total,
      deposit = EXCLUDED.deposit,
      rental_cost = EXCLUDED.rental_cost,
      days = EXCLUDED.days,
      state = EXCLUDED.state,
      in_rent = EXCLUDED.in_rent,
      archive = EXCLUDED.archive,
      start_worker_id = EXCLUDED.start_worker_id,
      end_worker_id = EXCLUDED.end_worker_id,
      responsible = EXCLUDED.responsible,
      description = EXCLUDED.description,
      source = EXCLUDED.source,
      data = EXCLUDED.data::jsonb,
      is_technical = EXCLUDED.is_technical,
      technical_type = EXCLUDED.technical_type,
      technical_purpose = EXCLUDED.technical_purpose,
      updated_at = NOW()
  `;

  return { saved: result.length };
}

async function main() {
  const start = Date.now();
  console.log('🚀 Ручной импорт броней RentProg → PostgreSQL');

  const dbUrl =
    process.env.DATABASE_URL ||
    'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

  console.log('🔗 Подключение к БД...');
  const sql = postgres(dbUrl, {
    ssl: { rejectUnauthorized: false },
    max: 1
  });

  try {
    const allBookings = [];

    for (const branch of BRANCHES) {
      const branchBookings = await fetchBookingsForBranch(branch);
      allBookings.push(...branchBookings);
    }

    console.log(`\n📦 Всего собрано записей: ${allBookings.length}`);

    const chunks = chunk(allBookings, 500);
    let totalSaved = 0;

    console.log(`💾 Сохранение в БД по ${chunks[0]?.length || 0} записей...`);

    for (let index = 0; index < chunks.length; index++) {
      const batch = chunks[index].map((item) => ({
        branch: item.branch,
        number: item.number,
        is_active: item.is_active,
        start_date: item.start_date,
        end_date: item.end_date,
        start_date_formatted: item.start_date_formatted,
        end_date_formatted: item.end_date_formatted,
        client_id: item.client_id,
        client_name: item.client_name,
        client_category: item.client_category,
        car_id: item.car_id,
        car_name: item.car_name,
        car_code: item.car_code,
        location_start: item.location_start,
        location_end: item.location_end,
        total: item.total,
        deposit: item.deposit,
        rental_cost: item.rental_cost,
        days: item.days,
        state: item.state,
        in_rent: item.in_rent,
        archive: item.archive,
        start_worker_id: item.start_worker_id,
        end_worker_id: item.end_worker_id,
        responsible: item.responsible,
        description: item.description,
        source: item.source,
        data: item.data,
        is_technical: item.is_technical,
        technical_type: item.technical_type,
        technical_purpose: item.technical_purpose
      }));

      const { saved } = await saveToDatabase(batch, sql);
      totalSaved += saved;

      console.log(`   ✅ Пакет ${index + 1}/${chunks.length}: сохранено ${saved}`);
    }

    console.log(`\n🎉 Импорт завершён. Всего сохранено/обновлено: ${totalSaved}`);
    const duration = ((Date.now() - start) / 1000).toFixed(1);
    console.log(`⏱️ Время выполнения: ${duration} сек.`);
  } catch (error) {
    console.error('❌ Ошибка импорта:', error);
    process.exitCode = 1;
  } finally {
    await sql.end();
  }
}

main();
