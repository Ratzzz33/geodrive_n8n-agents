#!/usr/bin/env node
import { readFileSync } from 'fs';

const data = JSON.parse(
  readFileSync(
    'c:/Users/33pok/.cursor/projects/c-Users-33pok-geodrive-n8n-agents/agent-tools/ca900325-0300-4ef4-b2b1-cf2cd36307fa.txt',
    'utf8'
  )
);

const items = data.data.nodes['Process All Bookings']?.data?.output?.[0] || [];

console.log(`📊 Всего броней в execution 21622: ${items.length}\n`);

// Ищем бронь с rentprog_id 509606
const found = items.find((item) => item.json?.booking_id === '509606');

if (found) {
  console.log('✅ НАЙДЕНА бронь с rentprog_id 509606:\n');
  console.log('Booking ID:', found.json?.booking_id);
  console.log('Number:', found.json?.number);
  console.log('Car Code:', found.json?.car_code);
  console.log('Car Name:', found.json?.car_name);
  console.log('Client:', found.json?.client_name);
  console.log('Branch:', found.json?.branch);
  console.log('Start Date:', found.json?.start_date);
  console.log('End Date:', found.json?.end_date);
  console.log('State:', found.json?.state);
  console.log('Is Active:', found.json?.is_active);
  console.log('\nПолные данные:');
  console.log(JSON.stringify(found.json, null, 2));
} else {
  console.log('❌ Бронь с rentprog_id 509606 НЕ найдена в execution 21622\n');
  
  console.log('📋 Все booking_id в execution:');
  items.forEach((item, idx) => {
    console.log(
      `  ${idx + 1}. ID: ${item.json?.booking_id}, Car: ${item.json?.car_code}, Number: ${item.json?.number}`
    );
  });
}

