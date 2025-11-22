#!/usr/bin/env node
import fetch from 'node-fetch';

const BRANCH_TOKENS = {
  'tbilisi': 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjczOSIsImV4cCI6MTczNzQ5MDE0NX0.Q0HCQMvHeV1WvvVlDTRxI0I3uQ5-DJa7UjTIbVGxTYU',
  'batumi': 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiI0MTkxMiIsImV4cCI6MTczNzQ5MDE0NX0.E0HCQMvHeV1WvvVlDTRxI0I3uQ5-DJa7UjTIbVGxTZV',
  'kutaisi': 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiI0MTkxMiIsImV4cCI6MTczNzQ5MDE0NX0.F0HCQMvHeV1WvvVlDTRxI0I3uQ5-DJa7UjTIbVGxTaW',
  'service-center': 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiI0MTkxMiIsImV4cCI6MTczNzQ5MDE0NX0.G0HCQMvHeV1WvvVlDTRxI0I3uQ5-DJa7UjTIbVGxTbX'
};

// Company tokens из restore_cars_from_rentprog.mjs (правильные!)
const COMPANY_TOKENS = {
  'tbilisi': '91b83b93963633649f29a04b612bab3f9fbb0471b5928622',
  'batumi': '7ad345720f8d92f10c187122427c6a2c2bb9494c6bf14e8d',
  'kutaisi': '5599ebb7b94827fdfd49ca3a5b7e259cfa99d8ea78edeb50',
  'service-center': '5y4j4gcs75o9n5s1e2vrxx4a'
};

console.log('🧪 Тестирую разные варианты API для получения автомобилей...\n');

async function testEndpoint(name, url, options) {
  console.log(`\n📍 Тест: ${name}`);
  console.log(`   URL: ${url}`);
  console.log(`   Method: ${options.method || 'GET'}`);
  console.log(`   Headers:`, Object.keys(options.headers || {}).join(', '));
  
  try {
    const response = await fetch(url, options);
    console.log(`   Status: ${response.status} ${response.statusText}`);
    
    if (!response.ok) {
      const text = await response.text();
      console.log(`   ❌ Ошибка: ${text.substring(0, 200)}`);
      return null;
    }
    
    const data = await response.json();
    console.log(`   ✅ Успех!`);
    
    // Анализ структуры ответа
    if (Array.isArray(data)) {
      console.log(`   📦 Тип: Массив, длина: ${data.length}`);
      if (data.length > 0) {
        console.log(`   📋 Пример полей:`, Object.keys(data[0]).slice(0, 5).join(', '));
      }
    } else if (data.data) {
      console.log(`   📦 Тип: Объект с data`);
      console.log(`   📋 data.length:`, Array.isArray(data.data) ? data.data.length : 'не массив');
    } else if (data.cars) {
      console.log(`   📦 Тип: Объект с cars`);
      console.log(`   📋 cars.length:`, Array.isArray(data.cars) ? data.cars.length : 'не массив');
    } else {
      console.log(`   📦 Тип: Объект`);
      console.log(`   📋 Ключи:`, Object.keys(data).join(', '));
    }
    
    return data;
    
  } catch (error) {
    console.log(`   ❌ Ошибка: ${error.message}`);
    return null;
  }
}

// Тест 1: Публичный endpoint с JWT токеном (как в workflow)
await testEndpoint(
  '1. /api/v1/public/cars с JWT (как в workflow)',
  'https://rentprog.net/api/v1/public/cars?per_page=10&page=1',
  {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${BRANCH_TOKENS.tbilisi}`,
      'Accept': 'application/json',
      'Origin': 'https://web.rentprog.ru',
      'Referer': 'https://web.rentprog.ru/',
      'User-Agent': 'Mozilla/5.0'
    }
  }
);

// Тест 2: all_cars_full с JWT токеном
await testEndpoint(
  '2. /api/v1/public/all_cars_full с JWT',
  'https://rentprog.net/api/v1/public/all_cars_full?limit=10&page=0',
  {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${BRANCH_TOKENS.tbilisi}`,
      'Accept': 'application/json',
      'Origin': 'https://web.rentprog.ru',
      'Referer': 'https://web.rentprog.ru/',
      'User-Agent': 'Mozilla/5.0'
    }
  }
);

// Тест 3: Получение request_token через company_token
console.log('\n\n🔐 Тест 3: Двухэтапная авторизация (company_token → request_token)');
try {
  console.log('   Шаг 1: Получаю request_token...');
  const tokenRes = await fetch(
    `https://rentprog.net/api/v1/public/get_token?company_token=${COMPANY_TOKENS.tbilisi}`,
    { method: 'GET' }
  );
  
  if (!tokenRes.ok) {
    throw new Error(`${tokenRes.status} ${tokenRes.statusText}`);
  }
  
  const tokenData = await tokenRes.json();
  
  if (!tokenData.request_token) {
    console.log('   Полный ответ:', JSON.stringify(tokenData));
    throw new Error('request_token не найден в ответе');
  }
  
  console.log(`   ✅ request_token получен: ${tokenData.request_token.substring(0, 20)}...`);
  
  // Тест 4: all_cars_full с request_token
  await testEndpoint(
    '4. /api/v1/public/all_cars_full с request_token',
    'https://rentprog.net/api/v1/public/all_cars_full?limit=10&page=0',
    {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${tokenData.request_token}`,
        'Accept': 'application/json',
        'Origin': 'https://web.rentprog.ru',
        'Referer': 'https://web.rentprog.ru/',
        'User-Agent': 'Mozilla/5.0'
      }
    }
  );
  
  // Тест 5: /cars с request_token
  await testEndpoint(
    '5. /api/v1/public/cars с request_token',
    'https://rentprog.net/api/v1/public/cars?per_page=10&page=1',
    {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${tokenData.request_token}`,
        'Accept': 'application/json',
        'Origin': 'https://web.rentprog.ru',
        'Referer': 'https://web.rentprog.ru/',
        'User-Agent': 'Mozilla/5.0'
      }
    }
  );
  
} catch (error) {
  console.log(`   ❌ Ошибка получения request_token: ${error.message}`);
}

console.log('\n\n📊 ИТОГИ ТЕСТИРОВАНИЯ');
console.log('=' .repeat(60));
console.log('Смотрите результаты выше, чтобы определить:');
console.log('1. Какой endpoint работает');
console.log('2. Какой тип авторизации нужен (JWT vs request_token)');
console.log('3. Какая структура данных возвращается');

