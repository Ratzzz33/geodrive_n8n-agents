import https from 'https';

const data = JSON.stringify({
  event: 'client_update',
  payload: '{"name"=>["Иван", "Иван Петров"], "id"=>99999, "phone"=>["+79991234567", "+79991234568"], "created_from_api"=>false, "updated_from_api"=>false, "company_id"=>9247}'
});

const options = {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data),
    'User-Agent': 'rentprog_webhook/1.0'
  }
};

console.log('🚀 Отправка тестового client_update вебхука...\n');
console.log('URL: https://webhook.rentflow.rentals/webhook/rentprog-webhook');
console.log('Event: client_update');
console.log('Payload:', data, '\n');

const start = Date.now();

const req = https.request('https://webhook.rentflow.rentals/webhook/rentprog-webhook', options, (res) => {
  const duration = Date.now() - start;
  console.log(`✅ Статус: ${res.statusCode}`);
  console.log(`⏱️  Время ответа: ${duration}ms\n`);
  
  let responseData = '';
  res.on('data', chunk => responseData += chunk);
  res.on('end', () => {
    console.log('Ответ:', responseData);
    console.log('\n💬 Проверьте:');
    console.log('   1. Telegram - должно прийти уведомление о неизвестном формате');
    console.log('   2. n8n UI - должен появиться execution');
    console.log('   3. БД events - должна быть запись с типом "unknown" (т.к. knownEventTypes пуст)');
  });
});

req.on('error', (err) => {
  console.error('❌ Ошибка:', err.message);
});

req.write(data);
req.end();

