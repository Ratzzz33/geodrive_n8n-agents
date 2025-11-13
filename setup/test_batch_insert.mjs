#!/usr/bin/env node
/**
 * Тестовое batch insert для проверки работы БД
 */

import postgres from 'postgres';

const sql = postgres('postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require', {
  ssl: { rejectUnauthorized: false },
  max: 1
});

console.log('\n🧪 Тестовое сохранение данных в БД...\n');

// Тестовые данные (как будто пришли из RentProg API)
const testBookings = [
  {
    branch: 'tbilisi',
    number: 999991,
    is_active: true,
    start_date: '2025-11-15T10:00:00Z',
    end_date: '2025-11-20T10:00:00Z',
    start_date_formatted: '15.11.2025 10:00',
    end_date_formatted: '20.11.2025 10:00',
    client_id: null,
    client_name: 'Иван Петров',
    client_category: 'VIP',
    car_id: null,
    car_name: 'Toyota Camry',
    car_code: 'TOY-123',
    location_start: 'Аэропорт Тбилиси',
    location_end: 'Аэропорт Тбилиси',
    total: 500,
    deposit: 200,
    rental_cost: 300,
    days: 5,
    state: 'planned',
    in_rent: false,
    archive: false,
    start_worker_id: '14714',
    end_worker_id: null,
    responsible: 'Данияр',
    description: 'Тестовая бронь',
    source: 'website',
    data: JSON.stringify({ test: true })
  },
  {
    branch: 'batumi',
    number: 999992,
    is_active: true,
    start_date: '2025-11-16T12:00:00Z',
    end_date: '2025-11-22T12:00:00Z',
    start_date_formatted: '16.11.2025 12:00',
    end_date_formatted: '22.11.2025 12:00',
    client_id: null,
    client_name: 'Мария Сидорова',
    client_category: 'Standard',
    car_id: null,
    car_name: 'Hyundai Elantra',
    car_code: 'HYU-456',
    location_start: 'Отель Батуми',
    location_end: 'Отель Батуми',
    total: 400,
    deposit: 150,
    rental_cost: 250,
    days: 6,
    state: 'issued',
    in_rent: true,
    archive: false,
    start_worker_id: '16003',
    end_worker_id: null,
    responsible: 'Георгий',
    description: 'Тестовая бронь 2',
    source: 'phone',
    data: JSON.stringify({ test: true, branch: 'batumi' })
  },
  {
    branch: 'kutaisi',
    number: 999993,
    is_active: false,
    start_date: '2025-11-10T08:00:00Z',
    end_date: '2025-11-13T18:00:00Z',
    start_date_formatted: '10.11.2025 08:00',
    end_date_formatted: '13.11.2025 18:00',
    client_id: null,
    client_name: 'Алексей Козлов',
    client_category: 'Regular',
    car_id: null,
    car_name: 'Kia Rio',
    car_code: 'KIA-789',
    location_start: 'Город Кутаиси',
    location_end: 'Город Кутаиси',
    total: 300,
    deposit: 100,
    rental_cost: 200,
    days: 3,
    state: 'returned',
    in_rent: false,
    archive: true,
    start_worker_id: '15001',
    end_worker_id: '15002',
    responsible: 'Давид',
    description: 'Завершенная бронь',
    source: 'booking.com',
    data: JSON.stringify({ test: true, completed: true })
  }
];

console.log(`📦 Подготовлено ${testBookings.length} тестовых записей\n`);

try {
  console.log('⏳ Выполнение batch INSERT...\n');
  
  const startTime = Date.now();
  
  // Batch INSERT с ON CONFLICT
  const result = await sql`
    INSERT INTO bookings ${sql(testBookings, 
      'branch', 'number', 'is_active',
      'start_date', 'end_date', 'start_date_formatted', 'end_date_formatted',
      'client_id', 'client_name', 'client_category',
      'car_id', 'car_name', 'car_code',
      'location_start', 'location_end',
      'total', 'deposit', 'rental_cost', 'days',
      'state', 'in_rent', 'archive',
      'start_worker_id', 'end_worker_id', 'responsible',
      'description', 'source', 'data'
    )}
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
      updated_at = NOW()
    RETURNING id, branch, number, is_active, client_name, car_name
  `;
  
  const duration = Date.now() - startTime;
  
  console.log(`✅ Batch INSERT завершен за ${duration}ms\n`);
  console.log(`📊 Сохранено записей: ${result.length}\n`);
  
  console.log('📋 Результаты:\n');
  result.forEach((row, idx) => {
    console.log(`   ${idx + 1}. ID: ${row.id}`);
    console.log(`      Branch: ${row.branch}`);
    console.log(`      Number: ${row.number}`);
    console.log(`      Active: ${row.is_active ? '✅' : '❌'}`);
    console.log(`      Client: ${row.client_name}`);
    console.log(`      Car: ${row.car_name}\n`);
  });
  
  // Проверяем что данные сохранились
  console.log('🔍 Проверка сохраненных данных...\n');
  
  const check = await sql`
    SELECT 
      branch,
      number,
      is_active,
      client_name,
      car_name,
      state,
      created_at
    FROM bookings 
    WHERE number >= 999991 AND number <= 999993
    ORDER BY number
  `;
  
  console.log(`📊 Найдено в БД: ${check.length} записей\n`);
  
  check.forEach((row, idx) => {
    console.log(`   ${idx + 1}. ${row.branch.toUpperCase()} | ${row.number}`);
    console.log(`      ${row.client_name} → ${row.car_name}`);
    console.log(`      State: ${row.state} | Active: ${row.is_active ? '✅' : '❌'}`);
    console.log(`      Created: ${row.created_at.toISOString()}\n`);
  });
  
  console.log('✅ Все тестовые данные успешно сохранены!');
  console.log('🚀 Batch INSERT работает корректно!\n');
  
} catch (error) {
  console.error('❌ Ошибка:', error.message);
  console.error(error.stack);
} finally {
  await sql.end();
}

