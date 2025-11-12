// Упрощенный тест - проверка доступности и быстрый запрос
import http from 'http';

const deviceId = 864107072502972; // Toyota RAV4 EP021EP
const dateFrom = '2025-11-12';
const dateTo = '2025-11-12';

console.log('📤 Быстрый тест API...');
console.log(`device_id: ${deviceId}`);
console.log(`Период: ${dateFrom} - ${dateTo}\n`);

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
  timeout: 60000 // 1 минута для быстрого теста
}, (res) => {
  console.log(`📥 Статус: ${res.statusCode}`);
  
  let data = '';
  res.on('data', (chunk) => { data += chunk.toString(); });
  res.on('end', () => {
    if (res.statusCode === 200) {
      const fs = require('fs');
      const fileName = `starline-routes-${deviceId}-${dateFrom}-${dateTo}.html`;
      fs.writeFileSync(fileName, data, 'utf8');
      console.log(`\n✅ HTML сохранен: ${fileName}`);
      console.log(`📊 Размер: ${(data.length / 1024).toFixed(2)} KB`);
      console.log(`\n📄 HTML (первые 3000 символов):\n${data.substring(0, 3000)}`);
    } else {
      console.log('\n❌ Ошибка:', res.statusCode);
      console.log('Ответ:', data.substring(0, 500));
    }
  });
});

req.on('error', (e) => console.error('❌ Ошибка:', e.message));
req.on('timeout', () => { console.error('❌ Таймаут (1 минута)'); req.destroy(); });

req.write(postData);
req.end();

