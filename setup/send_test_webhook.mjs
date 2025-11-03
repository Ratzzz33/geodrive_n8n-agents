import https from 'https';

const webhookData = {
  event: "car_update",
  payload: '{"clean_state"=>[false, true], "mileage"=>[101191, 102035], "id"=>65311, "created_from_api"=>false, "updated_from_api"=>false}'
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

console.log('📤 Отправка тестового вебхука...');
console.log('   URL: https://webhook.rentflow.rentals/webhook/rentprog-webhook');
console.log('   Event:', webhookData.event);
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
    console.log('💡 Проверьте Telegram alert chat через несколько секунд!');
  });
});

req.on('error', (error) => {
  console.error('❌ Ошибка запроса:', error.message);
});

req.write(payload);
req.end();

