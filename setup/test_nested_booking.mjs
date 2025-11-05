import https from 'https';

const WEBHOOK_URL = 'https://n8n.rentflow.rentals/webhook/service-center-webhook';

console.log('\n🧪 Тестирование обработки вложенных car и client...\n');

const testPayload = {
  event: 'booking_update',
  payload: {
    id: 486033
  }
};

const data = JSON.stringify(testPayload);

const options = {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data)
  }
};

const req = https.request(WEBHOOK_URL, options, (res) => {
  let responseData = '';
  res.on('data', chunk => responseData += chunk);
  res.on('end', () => {
    console.log(`📡 Статус: ${res.statusCode}\n`);
    try {
      const parsed = JSON.parse(responseData);
      console.log('📝 Ответ:', JSON.stringify(parsed, null, 2));
      console.log('\n✅ Webhook отправлен успешно!');
      console.log('\n🔍 Проверь execution в n8n UI:');
      console.log('   https://n8n.rentflow.rentals/workflow/PbDKuU06H7s2Oem8/executions\n');
    } catch (e) {
      console.log('📝 Ответ (raw):', responseData);
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Ошибка:', error.message);
  process.exit(1);
});

req.write(data);
req.end();

