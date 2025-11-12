// Финальный тест с логированием
import http from 'http';
import fs from 'fs';

const deviceId = 864107072502972; // Toyota RAV4 EP021EP
const dateFrom = '2025-11-12';
const dateTo = '2025-11-12';

console.log('📤 Тестовый запрос к API...');
console.log(`Устройство: Toyota RAV4 EP021EP (${deviceId})`);
console.log(`Период: ${dateFrom} - ${dateTo}`);
console.log('⏳ Ожидаю ответ (максимум 2 минуты)...\n');

const postData = JSON.stringify({ deviceId, dateFrom, dateTo });

const req = http.request({
  hostname: '172.17.0.1',
  port: 3000,
  path: '/starline/routes-html',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData)
  },
  timeout: 130000 // 2 минуты 10 секунд
}, (res) => {
  console.log(`\n📥 Статус: ${res.statusCode}`);
  console.log('Content-Type:', res.headers['content-type'] || 'не указан');
  
  let chunks = [];
  let received = 0;
  
  res.on('data', (chunk) => {
    chunks.push(chunk);
    received += chunk.length;
    if (received % 10000 === 0) {
      process.stdout.write(`\r📥 Получено: ${(received / 1024).toFixed(1)} KB`);
    }
  });
  
  res.on('end', () => {
    console.log(`\n📥 Всего получено: ${(received / 1024).toFixed(2)} KB\n`);
    
    if (res.statusCode === 200) {
      const fileName = `starline-routes-${deviceId}-${dateFrom}-${dateTo}.html`;
      const html = Buffer.concat(chunks).toString('utf8');
      fs.writeFileSync(fileName, html, 'utf8');
      
      console.log(`✅ HTML файл сохранен: ${fileName}`);
      console.log(`📊 Размер: ${(html.length / 1024).toFixed(2)} KB`);
      console.log(`\n📄 Первые 4000 символов HTML:\n${'='.repeat(80)}`);
      console.log(html.substring(0, 4000));
      console.log(`\n${'='.repeat(80)}`);
      console.log(`\n📄 Последние 2000 символов HTML:\n${'='.repeat(80)}`);
      console.log(html.substring(html.length - 2000));
      console.log(`\n${'='.repeat(80)}`);
    } else {
      const response = Buffer.concat(chunks).toString();
      console.log('❌ Ошибка:', res.statusCode);
      console.log('Ответ:', response.substring(0, 2000));
    }
  });
});

req.on('error', (error) => {
  console.error('\n❌ Ошибка запроса:', error.message);
});

req.on('timeout', () => {
  console.error('\n❌ Таймаут запроса (2 минуты)');
  req.destroy();
});

req.write(postData);
req.end();

