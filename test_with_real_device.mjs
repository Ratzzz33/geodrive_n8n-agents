// Тест с реальным device_id для Toyota RAV4 EP021EP
import http from 'http';
import fs from 'fs';

// device_id для Toyota RAV4 EP021EP
const deviceId = 864107072502972;
const dateFrom = '2025-11-12';
const dateTo = '2025-11-12';

console.log('📤 Отправляю запрос к API...');
console.log('Устройство: Toyota RAV4 EP021EP');
console.log(`device_id: ${deviceId}`);
console.log(`Период: ${dateFrom} - ${dateTo}\n`);

const postData = JSON.stringify({
  deviceId: deviceId,
  dateFrom: dateFrom,
  dateTo: dateTo
});

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

console.log('⏳ Ожидаю ответ (это может занять до 3 минут)...\n');

const req = http.request(options, (res) => {
  console.log(`📥 Статус: ${res.statusCode}`);
  console.log('Content-Type:', res.headers['content-type']);
  
  let chunks = [];
  let totalSize = 0;
  
  res.on('data', (chunk) => {
    chunks.push(chunk);
    totalSize += chunk.length;
    process.stdout.write(`\r📥 Получено: ${(totalSize / 1024).toFixed(2)} KB`);
  });
  
  res.on('end', () => {
    console.log('\n');
    
    if (res.statusCode === 200) {
      const fileName = `starline-routes-${deviceId}-${dateFrom}-${dateTo}.html`;
      const html = Buffer.concat(chunks).toString('utf8');
      fs.writeFileSync(fileName, html, 'utf8');
      
      console.log(`✅ HTML файл сохранен: ${fileName}`);
      console.log(`📊 Размер: ${(fs.statSync(fileName).size / 1024).toFixed(2)} KB`);
      console.log(`\n📄 Первые 2000 символов HTML:\n${html.substring(0, 2000)}...`);
      console.log(`\n📄 Последние 1000 символов HTML:\n...${html.substring(html.length - 1000)}`);
    } else {
      const response = Buffer.concat(chunks).toString();
      console.log('❌ Ошибка:', res.statusCode);
      console.log('Ответ:', response.substring(0, 1000));
    }
  });
});

req.on('error', (error) => {
  console.error('\n❌ Ошибка запроса:', error.message);
});

req.on('timeout', () => {
  console.error('\n❌ Таймаут запроса (3 минуты)');
  req.destroy();
});

req.write(postData);
req.end();

