import https from 'https';

const data = JSON.stringify({
  event: 'client_create',
  payload: {
    id: 999999,
    name: 'Dynamic Test Client',
    phone: '+995555222222',
    email: 'new@dynamic.test',
    company_id: 11163,
    // Новые поля которых нет в БД
    whatsapp: '+995555333333',
    telegram: '@dynamictest',
    passport_expiry: '2030-12-31',
    preferred_language: 'en',
    notes: 'This is a test client with new fields',
    loyalty_points: 100,
    vip_status: true
  },
});

const options = {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data),
    'User-Agent': 'rentprog_webhook/1.0',
  },
};

console.log('\n🧪 Тест динамического создания схемы (CREATE)\n');
console.log('📥 URL: https://n8n.rentflow.rentals/webhook/service-center-webhook');
console.log('📦 Payload с новыми полями:');
console.log('   - whatsapp');
console.log('   - telegram');
console.log('   - passport_expiry');
console.log('   - preferred_language');
console.log('   - notes');
console.log('   - loyalty_points');
console.log('   - vip_status\n');

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
    console.log('   1. БД: SELECT * FROM external_refs WHERE external_id = \'999999\';');
    console.log('   2. БД: SELECT column_name, data_type FROM information_schema.columns');
    console.log('      WHERE table_name = \'clients\'');
    console.log('      AND column_name IN (\'whatsapp\', \'telegram\', \'passport_expiry\',');
    console.log('                          \'preferred_language\', \'notes\', \'loyalty_points\', \'vip_status\');');
    console.log('   3. БД: SELECT * FROM clients WHERE id = (');
    console.log('      SELECT entity_id FROM external_refs');
    console.log('      WHERE system = \'rentprog\' AND external_id = \'999999\');');
    console.log('   4. Все новые колонки должны быть созданы автоматически!\n');
  });
});

req.on('error', (err) => {
  console.error('❌ Ошибка:', err.message);
});

req.write(data);
req.end();

