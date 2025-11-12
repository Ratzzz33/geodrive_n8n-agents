// Тестовый скрипт для получения HTML маршрутов Starline
import https from 'https';
import http from 'http';
import fs from 'fs';

const WEBHOOK_URL = 'https://webhook.rentflow.rentals/webhook/starline-routes-html';

// Параметры из скриншота: Toyota RAV4 EP021EP, 12 ноября 2025
// Нужно найти device_id, попробуем несколько вариантов
const testParams = {
  deviceId: 123456, // Временный, нужно найти реальный
  dateFrom: '2025-11-12',
  dateTo: '2025-11-12'
};

console.log('📤 Отправляю запрос к вебхуку...');
console.log('URL:', WEBHOOK_URL);
console.log('Параметры:', JSON.stringify(testParams, null, 2));

const postData = JSON.stringify(testParams);

const options = {
  hostname: 'webhook.rentflow.rentals',
  port: 443,
  path: '/webhook/starline-routes-html',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData)
  },
  timeout: 180000 // 3 минуты
};

const req = https.request(options, (res) => {
  console.log(`\n📥 Статус ответа: ${res.statusCode}`);
  console.log('Headers:', res.headers);
  
  let data = '';
  let chunks = [];
  
  res.on('data', (chunk) => {
    chunks.push(chunk);
    data += chunk;
  });
  
  res.on('end', () => {
    if (res.statusCode === 200) {
      // Сохраняем HTML файл
      const fileName = `starline-routes-${testParams.deviceId}-${testParams.dateFrom}-${testParams.dateTo}.html`;
      fs.writeFileSync(fileName, Buffer.concat(chunks));
      console.log(`\n✅ HTML файл сохранен: ${fileName}`);
      console.log(`📊 Размер: ${fs.statSync(fileName).size} байт`);
    } else {
      console.log('\n❌ Ошибка:', res.statusCode);
      console.log('Ответ:', data);
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Ошибка запроса:', error);
});

req.on('timeout', () => {
  console.error('❌ Таймаут запроса');
  req.destroy();
});

req.write(postData);
req.end();

