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

// Ищем бронь "Cruze 551 Hatch" (RentProg ID 513948, number 4020)
const targetBooking = items.find(
  (item) =>
    item.json?.booking_id === '513948' ||
    item.json?.number === 4020 ||
    item.json?.car_code?.includes('Cruze 551')
);

if (targetBooking) {
  console.log('✅ НАЙДЕНА бронь "Cruze 551 Hatch":\n');
  console.log(JSON.stringify(targetBooking.json, null, 2));
} else {
  console.log('❌ Бронь "Cruze 551 Hatch" (RentProg ID 513948, number 4020) НЕ найдена в execution 21622\n');
  
  console.log('📋 Первые 10 booking_id из execution:');
  items.slice(0, 10).forEach((item, idx) => {
    console.log(
      `  ${idx + 1}. ID: ${item.json?.booking_id}, Car: ${item.json?.car_code}, Number: ${item.json?.number}`
    );
  });
  
  // Проверяем есть ли вообще Cruze в execution
  const cruzeBookings = items.filter((item) =>
    item.json?.car_code?.toLowerCase().includes('cruze')
  );
  
  if (cruzeBookings.length > 0) {
    console.log(`\n🔍 Найдено ${cruzeBookings.length} броней с "Cruze" в названии:`);
    cruzeBookings.forEach((item) => {
      console.log(
        `  - ID: ${item.json?.booking_id}, Car: ${item.json?.car_code}, Number: ${item.json?.number}`
      );
    });
  }
}

