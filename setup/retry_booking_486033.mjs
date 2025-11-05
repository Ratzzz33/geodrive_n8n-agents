import https from 'https';

// Точные данные из failed execution #414
const data = JSON.stringify({
  event: 'booking_update',
  payload: {
    location_start: ['Tbilisi Airport', 'Tbilisi Airport PC318'],
    id: 486033,
    created_from_api: true,
    updated_from_api: false,
    user_id: null
  }
});

const options = {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data),
    'User-Agent': 'rentprog_webhook/1.0',
  },
};

console.log('\n🔄 Повторная обработка booking #486033...\n');
console.log('📥 URL: https://n8n.rentflow.rentals/webhook/service-center-webhook');
console.log('📦 Payload:', JSON.parse(data), '\n');

const start = Date.now();

const req = https.request('https://n8n.rentflow.rentals/webhook/service-center-webhook', options, (res) => {
  const duration = Date.now() - start;
  console.log(`📊 Status: ${res.statusCode}`);
  console.log(`⏱️  Duration: ${duration}ms\n`);

  let responseData = '';
  res.on('data', (chunk) => (responseData += chunk));
  res.on('end', () => {
    if (responseData) {
      const response = JSON.parse(responseData);
      console.log('✅ Response:');
      console.log(JSON.stringify(response, null, 2));
    }
    
    console.log('\n💡 Проверьте:');
    console.log('   1. n8n UI → должно быть успешное выполнение');
    console.log('   2. БД: SELECT * FROM external_refs WHERE external_id = \'486033\';');
    console.log('   3. БД: SELECT * FROM bookings WHERE id = (');
    console.log('      SELECT entity_id FROM external_refs');
    console.log('      WHERE system = \'rentprog\' AND external_id = \'486033\');');
    console.log('   4. Бронь должна быть создана с полными данными!\n');
  });
});

req.on('error', (err) => {
  console.error('❌ Ошибка:', err.message);
});

req.write(data);
req.end();

