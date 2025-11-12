// Финальный тест получения HTML маршрутов Starline
import https from 'https';
import fs from 'fs';

// Правильный URL вебхука (без двойного webhook)
const WEBHOOK_URL = 'https://webhook.rentflow.rentals/webhook/starline-routes-html';

// Параметры: нужно найти device_id для Toyota RAV4 EP021EP
// Попробуем сначала получить список устройств через API
const API_URL = 'http://172.17.0.1:3000/starline/match-cars';

console.log('🔍 Ищу device_id для Toyota RAV4 EP021EP...\n');

// Сначала получаем список устройств
const apiReq = https.request({
  hostname: '172.17.0.1',
  port: 3000,
  path: '/starline/match-cars',
  method: 'POST',
  timeout: 10000
}, (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    try {
      const devices = JSON.parse(data);
      const rav4 = devices.matches?.find(d => 
        d.starlineAlias?.includes('RAV4') || 
        d.starlineAlias?.includes('021') ||
        d.starlineAlias?.includes('EP021EP')
      );
      
      if (rav4) {
        console.log(`✅ Найдено устройство: ${rav4.starlineAlias} (device_id: ${rav4.starlineDeviceId})\n`);
        sendWebhookRequest(rav4.starlineDeviceId);
      } else {
        console.log('⚠️ Устройство не найдено, использую device_id: 123456\n');
        sendWebhookRequest(123456);
      }
    } catch (e) {
      console.log('⚠️ Не удалось получить список устройств, использую device_id: 123456\n');
      sendWebhookRequest(123456);
    }
  });
});

apiReq.on('error', () => {
  console.log('⚠️ API недоступен, использую device_id: 123456\n');
  sendWebhookRequest(123456);
});

apiReq.on('timeout', () => {
  console.log('⚠️ Таймаут API, использую device_id: 123456\n');
  apiReq.destroy();
  sendWebhookRequest(123456);
});

apiReq.end();

function sendWebhookRequest(deviceId) {
  const testParams = {
    deviceId: deviceId,
    dateFrom: '2025-11-12',
    dateTo: '2025-11-12'
  };

  console.log('📤 Отправляю запрос к вебхуку...');
  console.log('URL:', WEBHOOK_URL);
  console.log('Параметры:', JSON.stringify(testParams, null, 2), '\n');

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
    console.log(`📥 Статус ответа: ${res.statusCode}`);
    console.log('Content-Type:', res.headers['content-type']);
    
    let chunks = [];
    
    res.on('data', (chunk) => {
      chunks.push(chunk);
    });
    
    res.on('end', () => {
      if (res.statusCode === 200) {
        const fileName = `starline-routes-${deviceId}-${testParams.dateFrom}-${testParams.dateTo}.html`;
        fs.writeFileSync(fileName, Buffer.concat(chunks));
        console.log(`\n✅ HTML файл сохранен: ${fileName}`);
        console.log(`📊 Размер: ${fs.statSync(fileName).size} байт`);
        console.log(`\n📄 Первые 500 символов HTML:\n${fs.readFileSync(fileName, 'utf8').substring(0, 500)}...`);
      } else {
        const response = Buffer.concat(chunks).toString();
        console.log('\n❌ Ошибка:', res.statusCode);
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
}

