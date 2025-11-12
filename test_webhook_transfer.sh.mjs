// Тест вебхука n8n для получения HTML маршрутов через transfer.sh
import https from 'https';

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
    
    const response = Buffer.concat(chunks).toString('utf8');
    
    if (res.statusCode === 200) {
      try {
        const json = JSON.parse(response);
        console.log(`${'='.repeat(80)}`);
        console.log('✅ УСПЕХ! Ответ от вебхука:');
        console.log('='.repeat(80));
        console.log(JSON.stringify(json, null, 2));
        console.log('='.repeat(80));
        
        if (json.ok && json.url) {
          console.log(`\n🔗 Ссылка на файл: ${json.url}`);
          console.log(`📄 Имя файла: ${json.fileName || 'не указано'}`);
          console.log(`📅 Период: ${json.dateFrom} - ${json.dateTo}`);
          console.log(`\n💡 Файл доступен 7 дней на transfer.sh`);
          console.log(`\n🌐 Откройте ссылку в браузере для просмотра HTML`);
        } else {
          console.log('\n⚠️ Ответ не содержит ссылку на файл');
        }
      } catch (e) {
        console.log('\n📄 Ответ (не JSON):');
        console.log(response.substring(0, 2000));
      }
    } else {
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

