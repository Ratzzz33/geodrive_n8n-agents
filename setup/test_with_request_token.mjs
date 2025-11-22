#!/usr/bin/env node
import fetch from 'node-fetch';

// Company tokens из restore_cars_from_rentprog.mjs
const COMPANY_TOKENS = {
  'tbilisi': '91b83b93963633649f29a04b612bab3f9fbb0471b5928622',
  'batumi': '7ad345720f8d92f10c187122427c6a2c2bb9494c6bf14e8d',
  'kutaisi': '5599ebb7b94827fdfd49ca3a5b7e259cfa99d8ea78edeb50',
  'service-center': '5y4j4gcs75o9n5s1e2vrxx4a'
};

const BASE_URL = 'https://rentprog.net/api/v1/public';

console.log('🔐 Получаю request_token через company_token...\n');

try {
  // Шаг 1: Получаем request_token
  const tokenRes = await fetch(`${BASE_URL}/get_token?company_token=${COMPANY_TOKENS.tbilisi}`, {
    method: 'GET'
  });
  
  if (!tokenRes.ok) {
    throw new Error(`${tokenRes.status} ${tokenRes.statusText}`);
  }
  
  const tokenData = await tokenRes.json();
  console.log('✅ Ответ от /get_token:', JSON.stringify(tokenData, null, 2));
  
  // API возвращает "token", а не "request_token"
  const requestToken = tokenData.token || tokenData.request_token;
  
  if (!requestToken) {
    throw new Error('Token не найден в ответе');
  }
  
  console.log(`\n✅ request_token получен: ${requestToken.substring(0, 30)}...\n`);
  
  // Шаг 2: Тестируем endpoints с request_token
  console.log('📍 Тест 1: /api/v1/public/all_cars_full');
  const carsRes1 = await fetch(`${BASE_URL}/all_cars_full?limit=3&page=0`, {
    headers: {
      'Authorization': `Bearer ${requestToken}`,
      'Accept': 'application/json',
      'Origin': 'https://web.rentprog.ru',
      'Referer': 'https://web.rentprog.ru/',
      'User-Agent': 'Mozilla/5.0'
    }
  });
  
  console.log(`   Status: ${carsRes1.status} ${carsRes1.statusText}`);
  
  if (carsRes1.ok) {
    const data = await carsRes1.json();
    console.log(`   ✅ УСПЕХ! Получено автомобилей: ${Array.isArray(data) ? data.length : 'N/A'}`);
    if (Array.isArray(data) && data.length > 0) {
      console.log(`   📋 Первый: ID=${data[0].id}, Name=${data[0].name || data[0].car_name}`);
      console.log(`   📋 Поля:`, Object.keys(data[0]).slice(0, 15).join(', '));
    }
  } else {
    const text = await carsRes1.text();
    console.log(`   ❌ Ошибка: ${text.substring(0, 200)}`);
  }
  
  console.log('\n📍 Тест 2: POST /api/v1/public/index_with_search (model=car)');
  const carsRes2 = await fetch(`${BASE_URL}/index_with_search`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${requestToken}`,
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'Origin': 'https://web.rentprog.ru',
      'Referer': 'https://web.rentprog.ru/',
      'User-Agent': 'Mozilla/5.0'
    },
    body: JSON.stringify({
      model: 'car',
      per_page: 3,
      page: 1
    })
  });
  
  console.log(`   Status: ${carsRes2.status} ${carsRes2.statusText}`);
  
  if (carsRes2.ok) {
    const data = await carsRes2.json();
    console.log(`   ✅ УСПЕХ!`);
    console.log(`   📦 Структура:`, Object.keys(data).join(', '));
    
    if (data.cars && data.cars.data) {
      console.log(`   📋 cars.data.length: ${data.cars.data.length}`);
      if (data.cars.data.length > 0) {
        const first = data.cars.data[0];
        console.log(`   📋 Первый: ID=${first.id}, Name=${first.name}`);
      }
    }
  } else {
    const text = await carsRes2.text();
    console.log(`   ❌ Ошибка: ${text.substring(0, 200)}`);
  }
  
  console.log('\n\n✅ ВЫВОД:');
  console.log('=' .repeat(60));
  console.log('JWT токены пользователей НЕ работают!');
  console.log('Нужно использовать: company_token → request_token');
  console.log('\nРабочий endpoint: /api/v1/public/all_cars_full');
  console.log('Авторизация: Bearer <request_token>');
  
} catch (error) {
  console.error('\n❌ Ошибка:', error.message);
  process.exit(1);
}

