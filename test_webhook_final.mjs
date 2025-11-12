// Финальный тест вебхука n8n для получения HTML маршрутов
import https from 'https';
import fs from 'fs';

const WEBHOOK_URL = 'https://webhook.rentflow.rentals/webhook/starline-routes-html';

// Параметры: Toyota RAV4 EP021EP, 12 ноября 2025
const deviceId = 864107072502972;
const dateFrom = '2025-11-12';
const dateTo = '2025-11-12';

console.log('📤 Отправляю тестовый запрос к вебхуку n8n...');
console.log(`URL: ${WEBHOOK_URL}`);
console.log(`Устройство: Toyota RAV4 EP021EP (${deviceId})`);
console.log(`Период: ${dateFrom} - ${dateTo}`);
console.log('⏳ Ожидаю ответ (это может занять до 3 минут)...\n');

const postData = JSON.stringify({
  deviceId: deviceId,
  dateFrom: dateFrom,
  dateTo: dateTo
});

const options = {
  hostname: 'webhook.rentflow.rentals',
  port: 443,
  path: '/webhook/starline-routes-html',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData)
  },
  timeout: 200000 // 3 минуты 20 секунд
};

const req = https.request(options, (res) => {
  console.log(`\n📥 Статус ответа: ${res.statusCode}`);
  console.log('Content-Type:', res.headers['content-type'] || 'не указан');
  console.log('Content-Disposition:', res.headers['content-disposition'] || 'не указан');
  
  let chunks = [];
  let received = 0;
  const startTime = Date.now();
  
  res.on('data', (chunk) => {
    chunks.push(chunk);
    received += chunk.length;
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    process.stdout.write(`\r📥 Получено: ${(received / 1024).toFixed(1)} KB (${elapsed} сек)`);
  });
  
  res.on('end', () => {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n📥 Загрузка завершена за ${elapsed} секунд\n`);
    
    if (res.statusCode === 200) {
      const fileName = `starline-routes-${deviceId}-${dateFrom}-${dateTo}.html`;
      const html = Buffer.concat(chunks).toString('utf8');
      fs.writeFileSync(fileName, html, 'utf8');
      
      console.log(`✅ HTML файл сохранен: ${fileName}`);
      console.log(`📊 Размер: ${(html.length / 1024).toFixed(2)} KB`);
      console.log(`\n${'='.repeat(80)}`);
      console.log('📄 ПЕРВЫЕ 5000 СИМВОЛОВ HTML:');
      console.log('='.repeat(80));
      console.log(html.substring(0, 5000));
      console.log(`\n${'='.repeat(80)}`);
      console.log('📄 ПОСЛЕДНИЕ 3000 СИМВОЛОВ HTML:');
      console.log('='.repeat(80));
      console.log(html.substring(html.length - 3000));
      console.log(`\n${'='.repeat(80)}`);
      console.log(`\n✅ Файл готов: ${fileName}`);
      console.log(`📂 Полный путь: ${process.cwd()}\\${fileName}`);
    } else {
      const response = Buffer.concat(chunks).toString();
      console.log('\n❌ Ошибка:', res.statusCode);
      console.log('Ответ:', response.substring(0, 2000));
    }
  });
});

req.on('error', (error) => {
  console.error('\n❌ Ошибка запроса:', error.message);
});

req.on('timeout', () => {
  console.error('\n❌ Таймаут запроса (3+ минуты)');
  req.destroy();
});

req.write(postData);
req.end();

