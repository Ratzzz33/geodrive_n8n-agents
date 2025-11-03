import https from 'https';

const webhookData = {
  event: "booking_update",
  payload: '{"responsible"=>[nil, "Байбаков Данияр"], "responsible_id"=>[nil, 16003], "id"=>506289, "created_from_api"=>false, "updated_from_api"=>false, "user_id"=>14857}'
};

const payload = JSON.stringify(webhookData);

const options = {
  hostname: 'webhook.rentflow.rentals',
  port: 443,
  path: '/',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload),
    'User-Agent': 'rentprog_webhook/1.0'
  }
};

console.log('📤 Отправка тестового booking_update вебхука...');
console.log('');

const req = https.request(options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    console.log('✅ Ответ получен:', res.statusCode);
    console.log('');
    if (data) {
      try {
        const response = JSON.parse(data);
        console.log('📦 Ответ:', JSON.stringify(response, null, 2));
      } catch (e) {
        console.log('📦 Ответ:', data);
      }
    }
    console.log('');
    console.log('💡 Проверьте:');
    console.log('   1. Execution в n8n UI');
    console.log('   2. Данные в БД (таблица events)');
    console.log('   3. НЕ должно быть Telegram уведомления (известный формат)');
  });
});

req.on('error', (error) => {
  console.error('❌ Ошибка запроса:', error.message);
});

req.write(payload);
req.end();

