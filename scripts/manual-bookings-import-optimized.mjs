#!/usr/bin/env node

import 'dotenv/config';
import axios from 'axios';
import postgres from 'postgres';

const RENTPROG_URL = 'https://rentprog.net/api/v1/index_with_search';
const PER_PAGE = 50;  // Smaller batch
const BATCH_SIZE = 200;  // Save to DB every 200 records

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
  const clientName = sanitizeString(attrs.client_name) || '';
  const description = sanitizeString(attrs.description) || '';
  
  const isEmployee = clientName.toLowerCase().includes('сотрудник');
  const isRepair = /ремонт|сервис|service/i.test(description) || 
                   /ремонт|сервис/i.test(clientName);
  
  if (isEmployee || isRepair) {
    return {
      is_technical: true,
      technical_type: isRepair ? 'technical_repair' : 'technical',
      technical_purpose: isRepair 
        ? 'Техническая для ремонта/обслуживания' 
        : 'Техническая для поездки сотрудника'
    };
  }
  
  return {
    is_technical: false,
    technical_type: 'regular',
    technical_purpose: null
  };
}

async function fetchBranch(branch, token, isActive) {
  console.log(`\n[${branch}] Начинаем парсинг ${isActive ? 'активных' : 'неактивных'} броней...`);
  
  let page = 1;
  let totalRecords = 0;
  let batch = [];
  
  const sql = postgres(process.env.DATABASE_URL, {
    ssl: { rejectUnauthorized: false },
    max: 1
  });
  
  try {
    while (true) {
      const response = await axios.post(
        RENTPROG_URL,
        {
          model: 'booking',
          active: isActive,
          page,
          per_page: PER_PAGE
        },
        {
          headers: { 
            Authorization: token, 
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          timeout: 30000
        }
      );
      
      const bookings = response.data?.bookings?.data || [];
      
      if (bookings.length === 0) {
        console.log(`[${branch}] Страница ${page}: пусто. Завершаем.`);
        break;
      }
      
      console.log(`[${branch}] Страница ${page}: получено ${bookings.length} броней`);
      
      for (const booking of bookings) {
        const attrs = booking.attributes || booking;
        const techInfo = getTechnicalInfo(attrs);
        
        batch.push({
          branch,
          booking_id: String(booking.id || attrs.id),
          number: sanitizeString(attrs.number),
          is_active: toBoolean(attrs.active),
          start_date: sanitizeString(attrs.start_date),
          end_date: sanitizeString(attrs.end_date),
          start_date_formatted: sanitizeString(attrs.start_date_formatted),
          end_date_formatted: sanitizeString(attrs.end_date_formatted),
          created_at: sanitizeString(attrs.created_at),
          client_id: sanitizeString(attrs.client_id),
          client_name: [attrs.first_name, attrs.middle_name, attrs.last_name]
            .filter(Boolean)
            .join(' '),
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
          is_technical: techInfo.is_technical,
          technical_type: techInfo.technical_type,
          technical_purpose: techInfo.technical_purpose
        });
      }
      
      // Save batch to DB
      if (batch.length >= BATCH_SIZE) {
        await saveBatch(sql, batch);
        totalRecords += batch.length;
        console.log(`[${branch}] Сохранено в БД: ${batch.length} записей. Всего: ${totalRecords}`);
        batch = [];  // Clear batch
      }
      
      page++;
      
      // Break if less than per_page (last page)
      if (bookings.length < PER_PAGE) {
        console.log(`[${branch}] Последняя страница ${page - 1}`);
        break;
      }
    }
    
    // Save remaining
    if (batch.length > 0) {
      await saveBatch(sql, batch);
      totalRecords += batch.length;
      console.log(`[${branch}] Сохранено остаток: ${batch.length} записей. Итого: ${totalRecords}`);
    }
    
    console.log(`[${branch}] ✅ Завершено. Всего обработано: ${totalRecords} броней`);
    return totalRecords;
    
  } catch (error) {
    console.error(`[${branch}] ❌ Ошибка:`, error.message);
    
    // Save remaining batch on error
    if (batch.length > 0) {
      try {
        await saveBatch(sql, batch);
        console.log(`[${branch}] Сохранено ${batch.length} записей перед ошибкой`);
      } catch (saveErr) {
        console.error(`[${branch}] Ошибка сохранения:`, saveErr.message);
      }
    }
    
    throw error;
  } finally {
    await sql.end();
  }
}

async function saveBatch(sql, batch) {
  if (batch.length === 0) return;
  
  const values = batch
    .map(
      (d) =>
        `('${d.branch}', '${d.booking_id}', '${d.number || ''}', ${d.is_active}, ` +
        `${d.start_date ? "'" + d.start_date + "'" : 'NULL'}, ` +
        `${d.end_date ? "'" + d.end_date + "'" : 'NULL'}, ` +
        `${d.start_date_formatted ? "'" + d.start_date_formatted + "'" : 'NULL'}, ` +
        `${d.end_date_formatted ? "'" + d.end_date_formatted + "'" : 'NULL'}, ` +
        `${d.created_at ? "'" + d.created_at + "'" : 'NULL'}, ` +
        `${d.client_id ? "'" + d.client_id + "'" : 'NULL'}, ` +
        `${d.client_name ? "'" + d.client_name.replace(/'/g, "''") + "'" : 'NULL'}, ` +
        `${d.client_category ? "'" + d.client_category + "'" : 'NULL'}, ` +
        `${d.car_id ? "'" + d.car_id + "'" : 'NULL'}, ` +
        `${d.car_name ? "'" + d.car_name.replace(/'/g, "''") + "'" : 'NULL'}, ` +
        `${d.car_code ? "'" + d.car_code + "'" : 'NULL'}, ` +
        `${d.location_start ? "'" + d.location_start.replace(/'/g, "''") + "'" : 'NULL'}, ` +
        `${d.location_end ? "'" + d.location_end.replace(/'/g, "''") + "'" : 'NULL'}, ` +
        `${d.total !== null ? d.total : 'NULL'}, ` +
        `${d.deposit !== null ? d.deposit : 'NULL'}, ` +
        `${d.rental_cost !== null ? d.rental_cost : 'NULL'}, ` +
        `${d.days !== null ? d.days : 'NULL'}, ` +
        `${d.state ? "'" + d.state + "'" : 'NULL'}, ` +
        `${d.in_rent}, ${d.archive}, ` +
        `${d.start_worker_id ? "'" + d.start_worker_id + "'" : 'NULL'}, ` +
        `${d.end_worker_id ? "'" + d.end_worker_id + "'" : 'NULL'}, ` +
        `${d.responsible ? "'" + d.responsible.replace(/'/g, "''") + "'" : 'NULL'}, ` +
        `${d.description ? "'" + d.description.replace(/'/g, "''") + "'" : 'NULL'}, ` +
        `${d.source ? "'" + d.source + "'" : 'NULL'}, ` +
        `'${JSON.stringify(d.data).replace(/'/g, "''")}', ` +
        `${d.is_technical}, '${d.technical_type}', ` +
        `${d.technical_purpose ? "'" + d.technical_purpose.replace(/'/g, "''") + "'" : 'NULL'})`
    )
    .join(',\n');

  const query = `
    INSERT INTO bookings (
      branch, booking_id, number, is_active,
      start_date, end_date, start_date_formatted, end_date_formatted, created_at,
      client_id, client_name, client_category,
      car_id, car_name, car_code,
      location_start, location_end,
      total, deposit, rental_cost, days,
      state, in_rent, archive,
      start_worker_id, end_worker_id, responsible,
      description, source, data,
      is_technical, technical_type, technical_purpose
    ) VALUES ${values}
    ON CONFLICT (branch, number) DO UPDATE SET
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
      data = EXCLUDED.data,
      is_technical = EXCLUDED.is_technical,
      technical_type = EXCLUDED.technical_type,
      technical_purpose = EXCLUDED.technical_purpose
  `;

  await sql.unsafe(query);
}

async function main() {
  console.log('========================================');
  console.log('MANUAL BOOKINGS IMPORT (OPTIMIZED)');
  console.log('========================================');
  console.log(`Start time: ${new Date().toISOString()}`);
  console.log(`Batch size: ${BATCH_SIZE} records`);
  console.log(`Per page: ${PER_PAGE} records\n`);
  
  let grandTotal = 0;
  
  for (const { branch, token } of BRANCHES) {
    try {
      const activeCount = await fetchBranch(branch, token, true);
      const inactiveCount = await fetchBranch(branch, token, false);
      const branchTotal = activeCount + inactiveCount;
      grandTotal += branchTotal;
      console.log(`\n[${branch}] ИТОГО: ${branchTotal} броней (${activeCount} активных + ${inactiveCount} неактивных)\n`);
    } catch (error) {
      console.error(`\n[${branch}] ФАТАЛЬНАЯ ОШИБКА:`, error);
    }
  }
  
  console.log('\n========================================');
  console.log(`ЗАВЕРШЕНО. Обработано: ${grandTotal} броней`);
  console.log(`End time: ${new Date().toISOString()}`);
  console.log('========================================');
}

main().catch(console.error);

