// Прямой тест API endpoint для получения HTML маршрутов
import http from 'http';
import fs from 'fs';

// Параметры из скриншота: Toyota RAV4 EP021EP, 12 ноября 2025
// Попробуем найти device_id через API или используем примерный
const testParams = {
  deviceId: 123456, // Временный, нужно найти реальный
  dateFrom: '2025-11-12',
  dateTo: '2025-11-12'
};

console.log('📤 Отправляю прямой запрос к API...');
console.log('URL: http://172.17.0.1:3000/starline/routes-html');
console.log('Параметры:', JSON.stringify(testParams, null, 2), '\n');

const postData = JSON.stringify(testParams);

const options = {
  hostname: '172.17.0.1',
  port: 3000,
  path: '/starline/routes-html',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData)
  },
  timeout: 180000 // 3 минуты
};

const req = http.request(options, (res) => {
  console.log(`📥 Статус ответа: ${res.statusCode}`);
  console.log('Content-Type:', res.headers['content-type']);
  
  let chunks = [];
  
  res.on('data', (chunk) => {
    chunks.push(chunk);
    process.stdout.write('.');
  });
  
  res.on('end', () => {
    console.log('\n');
    
    if (res.statusCode === 200) {
      const fileName = `starline-routes-${testParams.deviceId}-${testParams.dateFrom}-${testParams.dateTo}.html`;
      const html = Buffer.concat(chunks).toString('utf8');
      fs.writeFileSync(fileName, html, 'utf8');
      
      console.log(`✅ HTML файл сохранен: ${fileName}`);
      console.log(`📊 Размер: ${fs.statSync(fileName).size} байт`);
      console.log(`\n📄 Первые 1000 символов HTML:\n${html.substring(0, 1000)}...`);
      console.log(`\n📄 Последние 500 символов HTML:\n...${html.substring(html.length - 500)}`);
    } else {
      const response = Buffer.concat(chunks).toString();
      console.log('❌ Ошибка:', res.statusCode);
      console.log('Ответ:', response);
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

