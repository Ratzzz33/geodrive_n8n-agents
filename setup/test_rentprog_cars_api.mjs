#!/usr/bin/env node

const TBILISI_TOKEN = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxNjA0NiIsInNjcCI6InVzZXIiLCJhdWQiOm51bGwsImlhdCI6MTc2MjQ1OTY2MCwiZXhwIjoxNzY1MDUxNjYwLCJqdGkiOiIxOTFjMDY4ZS1jOGNhLTQ4OWEtODk0OS1iMjJkMmUzODE2ZDIifQ.G4_I4D96Flv4rP3JwjwDPpEHaH6ShSb0YRRQG8PasXk';

console.log('🧪 Тестирую RentProg API для получения автомобилей...\n');

try {
  const response = await fetch('https://rentprog.net/api/v1/public/cars?per_page=100&page=1', {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${TBILISI_TOKEN}`,
      'Accept': 'application/json',
      'Origin': 'https://web.rentprog.ru',
      'Referer': 'https://web.rentprog.ru/'
    }
  });
  
  if (!response.ok) {
    console.error(`❌ HTTP Error: ${response.status} ${response.statusText}`);
    process.exit(1);
  }
  
  const data = await response.json();
  
  console.log('✅ API Response OK!\n');
  console.log('📊 СТРУКТУРА ОТВЕТА:\n');
  console.log(JSON.stringify(data, null, 2).substring(0, 1000) + '...\n');
  
  // Проверяем структуру данных
  // RentProg API /all_cars_full возвращает массив напрямую
  const cars = Array.isArray(data) ? data : (data.data || data.cars?.data || []);
  
  if (cars.length > 0) {
    console.log(`🚗 Получено автомобилей: ${cars.length}\n`);
    
    console.log('📋 ПРИМЕР АВТОМОБИЛЯ:\n');
    const car = cars[0];
      console.log(JSON.stringify(car, null, 2));
      
      console.log('\n🔑 КЛЮЧЕВЫЕ ПОЛЯ:\n');
      console.log(`ID: ${car.id}`);
      console.log(`Model: ${car.model}`);
      console.log(`Code: ${car.code}`);
      console.log(`Plate: ${car.plate}`);
      console.log(`VIN: ${car.vin}`);
      console.log(`Status: ${car.status}`);
      console.log(`Active: ${car.active}`);
      console.log(`Can Rent: ${car.can_rent}`);
      console.log(`Mileage: ${car.mileage}`);
      console.log(`Price: ${car.price}`);
  } else {
    console.log('⚠️ Автомобили не найдены');
    console.log('Total в ответе:', data.total || 0);
  }
  
} catch (error) {
  console.error('❌ Ошибка:', error.message);
  process.exit(1);
}

