#!/usr/bin/env node
import fetch from 'node-fetch';

// JWT токены пользователей из workflow (вечные)
const BRANCH_TOKENS = {
  'tbilisi': 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjczOSIsImV4cCI6MTczNzQ5MDE0NX0.Q0HCQMvHeV1WvvVlDTRxI0I3uQ5-DJa7UjTIbVGxTYU',
  'batumi': 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiI0MTkxMiIsImV4cCI6MTczNzQ5MDE0NX0.E0HCQMvHeV1WvvVlDTRxI0I3uQ5-DJa7UjTIbVGxTZV',
  'kutaisi': 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiI0MTkxMiIsImV4cCI6MTczNzQ5MDE0NX0.F0HCQMvHeV1WvvVlDTRxI0I3uQ5-DJa7UjTIbVGxTaW',
  'service-center': 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiI0MTkxMiIsImV4cCI6MTczNzQ5MDE0NX0.G0HCQMvHeV1WvvVlDTRxI0I3uQ5-DJa7UjTIbVGxTbX'
};

console.log('🧪 Тестирую все возможные endpoints с JWT токенами пользователей...\n');

async function testEndpoint(name, url, token) {
  console.log(`\n📍 ${name}`);
  console.log(`   URL: ${url}`);
  
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
        'Origin': 'https://web.rentprog.ru',
        'Referer': 'https://web.rentprog.ru/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    console.log(`   ✅ Status: ${response.status} ${response.statusText}`);
    
    if (!response.ok) {
      const text = await response.text();
      console.log(`   ❌ Ошибка: ${text.substring(0, 150)}`);
      return null;
    }
    
    const data = await response.json();
    
    // Анализ структуры
    if (Array.isArray(data)) {
      console.log(`   ✅ Массив, элементов: ${data.length}`);
      if (data.length > 0) {
        const first = data[0];
        console.log(`   📋 Пример полей:`, Object.keys(first).slice(0, 10).join(', '));
        console.log(`   📋 ID: ${first.id || 'N/A'}, Name: ${first.name || first.car_name || 'N/A'}`);
      }
    } else if (typeof data === 'object') {
      const keys = Object.keys(data);
      console.log(`   ✅ Объект, ключи:`, keys.join(', '));
      
      if (data.data && Array.isArray(data.data)) {
        console.log(`   📦 data.length: ${data.data.length}`);
        if (data.data.length > 0) {
          console.log(`   📋 Пример полей:`, Object.keys(data.data[0]).slice(0, 10).join(', '));
        }
      }
      
      if (data.cars && Array.isArray(data.cars)) {
        console.log(`   📦 cars.length: ${data.cars.length}`);
      }
    }
    
    return data;
    
  } catch (error) {
    console.log(`   ❌ Ошибка: ${error.message}`);
    return null;
  }
}

const token = BRANCH_TOKENS.tbilisi;

// Тест всех возможных вариантов endpoint
console.log('🎯 Тестирую TBILISI филиал с JWT токеном пользователя\n');

await testEndpoint('1. /api/v1/cars (без public)', 'https://rentprog.net/api/v1/cars?per_page=5', token);
await testEndpoint('2. /api/v1/public/cars', 'https://rentprog.net/api/v1/public/cars?per_page=5', token);
await testEndpoint('3. /api/v1/all_cars_full', 'https://rentprog.net/api/v1/all_cars_full?limit=5&page=0', token);
await testEndpoint('4. /api/v1/public/all_cars_full', 'https://rentprog.net/api/v1/public/all_cars_full?limit=5&page=0', token);
await testEndpoint('5. /api/v1/index_with_search (model=car)', 'https://rentprog.net/api/v1/index_with_search', token);

// POST запрос для index_with_search
console.log('\n📍 6. POST /api/v1/index_with_search с model=car');
console.log('   URL: https://rentprog.net/api/v1/index_with_search');
try {
  const response = await fetch('https://rentprog.net/api/v1/index_with_search', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'Origin': 'https://web.rentprog.ru',
      'Referer': 'https://web.rentprog.ru/',
      'User-Agent': 'Mozilla/5.0'
    },
    body: JSON.stringify({
      model: 'car',
      per_page: 5,
      page: 1
    })
  });
  
  console.log(`   ✅ Status: ${response.status} ${response.statusText}`);
  
  if (response.ok) {
    const data = await response.json();
    if (data.cars && Array.isArray(data.cars.data)) {
      console.log(`   ✅ cars.data.length: ${data.cars.data.length}`);
      if (data.cars.data.length > 0) {
        const first = data.cars.data[0];
        console.log(`   📋 Пример: ID=${first.id}, name=${first.name || first.car_name}`);
      }
    } else {
      console.log('   📦 Структура:', Object.keys(data).join(', '));
    }
  } else {
    const text = await response.text();
    console.log(`   ❌ Ошибка: ${text.substring(0, 150)}`);
  }
} catch (error) {
  console.log(`   ❌ Ошибка: ${error.message}`);
}

console.log('\n\n📊 ИТОГ');
console.log('=' .repeat(60));
console.log('Смотрите выше - какой endpoint вернул 200 OK с данными');

