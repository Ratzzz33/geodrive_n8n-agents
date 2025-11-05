import https from 'https';

const data = JSON.stringify({
  event: 'car_update',
  payload: '{"mileage"=>[100, 200], "id"=>12345, "created_from_api"=>false}'
});

const options = {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data)
  }
};

console.log('🚀 Отправка тестового вебхука...\n');
console.log('URL: https://webhook.rentflow.rentals/webhook/rentprog-webhook');
console.log('Payload:', data, '\n');

const req = https.request('https://webhook.rentflow.rentals/webhook/rentprog-webhook', options, (res) => {
  console.log(`✅ Статус: ${res.statusCode}\n`);
  
  let responseData = '';
  res.on('data', chunk => responseData += chunk);
  res.on('end', () => {
    console.log('Ответ:', responseData);
    console.log('\n💬 Проверьте Telegram - должно прийти уведомление о неизвестном формате!');
  });
});

req.on('error', (err) => {
  console.error('❌ Ошибка:', err.message);
});

req.write(data);
req.end();

