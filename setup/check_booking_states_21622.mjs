#!/usr/bin/env node
import { readFileSync } from 'fs';

const data = JSON.parse(
  readFileSync(
    'c:/Users/33pok/.cursor/projects/c-Users-33pok-geodrive-n8n-agents/agent-tools/c98d0064-91f4-4f2d-95fc-77afcbfe53be.txt',
    'utf8'
  )
);

console.log('📊 Проверяю статусы броней в execution 21622...\n');

const branches = ['Get Tbilisi Active', 'Get Batumi Active', 'Get Kutaisi Active', 'Get Service Active'];
const allStates = new Set();
const bookingsByState = {};

branches.forEach((branchName) => {
  const node = data.data?.nodes?.[branchName];
  if (!node || !node.data?.output?.[0]) {
    console.log(`⚠️  ${branchName}: нет данных`);
    return;
  }

  const items = node.data.output[0];
  let totalBookings = 0;

  items.forEach((item) => {
    const bookingsData = item.json?.bookings?.data || [];
    totalBookings += bookingsData.length;

    bookingsData.forEach((booking) => {
      const attrs = booking?.attributes || booking;
      const state = attrs?.state || 'unknown';
      
      allStates.add(state);
      
      if (!bookingsByState[state]) {
        bookingsByState[state] = [];
      }
      
      bookingsByState[state].push({
        id: booking?.id || attrs?.id,
        car_code: attrs?.car_code,
        number: attrs?.number,
        branch: branchName,
        active: attrs?.active,
      });
    });
  });

  console.log(`${branchName}: ${totalBookings} броней`);
});

console.log('\n\n📋 Все найденные статусы броней:');
Array.from(allStates).sort().forEach((state) => {
  const count = bookingsByState[state]?.length || 0;
  console.log(`  - "${state}": ${count} броней`);
});

console.log('\n\n📊 Детали по статусам:');
Object.keys(bookingsByState).sort().forEach((state) => {
  const bookings = bookingsByState[state];
  console.log(`\n"${state}" (${bookings.length} броней):`);
  bookings.slice(0, 5).forEach((b) => {
    console.log(`  - ID: ${b.id}, Car: ${b.car_code}, Number: ${b.number}, Active: ${b.active}, Branch: ${b.branch}`);
  });
  if (bookings.length > 5) {
    console.log(`  ... и ещё ${bookings.length - 5} броней`);
  }
});

// Проверяем есть ли "Новая"
if (allStates.has('Новая')) {
  console.log('\n✅ Статус "Новая" найден!');
  const newBookings = bookingsByState['Новая'];
  console.log(`   Всего новых броней: ${newBookings.length}`);
} else {
  console.log('\n❌ Статус "Новая" НЕ найден');
  console.log('   Возможно, API не поддерживает фильтр по state или все новые брони уже стали активными');
  console.log('   Или в execution 21622 использовался старый фильтр (active: true)');
}

