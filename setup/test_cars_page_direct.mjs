#!/usr/bin/env node
import fetch from 'node-fetch';

// JWT токены пользователей (из workflow)
const BRANCH_TOKENS = {
  'tbilisi': 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjczOSIsImV4cCI6MTczNzQ5MDE0NX0.Q0HCQMvHeV1WvvVlDTRxI0I3uQ5-DJa7UjTIbVGxTYU'
};

console.log('🧪 Делаю HTTP запрос к странице /cars как браузер...\n');

async function testPageRequest() {
  const token = BRANCH_TOKENS.tbilisi;
  
  console.log('📍 GET https://web.rentprog.ru/cars');
  
  try {
    const response = await fetch('https://web.rentprog.ru/cars', {
      method: 'GET',
      headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cookie': `auth_token=${token}`,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://web.rentprog.ru/dashboard'
      }
    });
    
    console.log(`   Status: ${response.status} ${response.statusText}`);
    console.log(`   Content-Type: ${response.headers.get('content-type')}`);
    
    const html = await response.text();
    console.log(`   Размер ответа: ${html.length} байт`);
    
    // Проверяем, есть ли в HTML данные или это редирект на логин
    if (html.includes('signin') || html.includes('login')) {
      console.log('\n❌ Редирект на страницу логина - токен не подходит для Cookie');
    } else if (html.includes('cars') || html.includes('car_name')) {
      console.log('\n✅ Страница загружена! Ищем данные...');
      
      // Ищем embedded JSON данные
      if (html.includes('window.__INITIAL_STATE__') || html.includes('window.__DATA__')) {
        console.log('   📦 Найдены embedded данные в HTML');
      } else {
        console.log('   ⚠️  Данные загружаются через отдельный API запрос (AJAX)');
        console.log('   💡 Нужно найти endpoint, который вызывает страница');
      }
    }
    
    // Сохраняем HTML для анализа
    const fs = await import('fs');
    fs.writeFileSync('setup/cars_page.html', html, 'utf8');
    console.log('\n📄 HTML сохранен в setup/cars_page.html');
    
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
  }
}

// Тест 2: Пробуем найти API endpoint, который использует страница
async function testAPIEndpoints() {
  const token = BRANCH_TOKENS.tbilisi;
  
  console.log('\n\n📍 Пробую различные API endpoints, которые могут использоваться страницей:\n');
  
  const endpoints = [
    { url: 'https://web.rentprog.ru/api/cars', method: 'GET' },
    { url: 'https://web.rentprog.ru/api/cars/list', method: 'GET' },
    { url: 'https://rentprog.net/api/v1/cars', method: 'GET' },
    { url: 'https://rentprog.net/api/v1/search_cars', method: 'POST', body: { page: 1, per_page: 10 } },
  ];
  
  for (const endpoint of endpoints) {
    console.log(`   ${endpoint.method} ${endpoint.url}`);
    
    try {
      const options = {
        method: endpoint.method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'Origin': 'https://web.rentprog.ru',
          'Referer': 'https://web.rentprog.ru/cars'
        }
      };
      
      if (endpoint.body) {
        options.body = JSON.stringify(endpoint.body);
      }
      
      const response = await fetch(endpoint.url, options);
      console.log(`      → ${response.status} ${response.statusText}`);
      
      if (response.ok) {
        const data = await response.json();
        console.log(`      ✅ РАБОТАЕТ! Получено данных:`, Array.isArray(data) ? data.length : Object.keys(data).join(', '));
        
        if (Array.isArray(data) && data.length > 0) {
          console.log(`      📋 Первый элемент:`, Object.keys(data[0]).slice(0, 10).join(', '));
        }
        
        return { endpoint: endpoint.url, method: endpoint.method, data };
      }
      
    } catch (error) {
      console.log(`      ❌ ${error.message}`);
    }
  }
}

await testPageRequest();
await testAPIEndpoints();

console.log('\n\n💡 ВЫВОД:');
console.log('Нужно найти, какой API endpoint использует страница /cars');
console.log('Для этого лучше всего открыть страницу в браузере и посмотреть Network tab');

