import https from 'https';

const testPayload = {
  event: 'client_update',
  payload: {
    id: 381296,
    name: ['Old Name', 'New Name Updated'],
    phone: ['+995555000001', '+995555000002'],
    email: ['old@test.com', 'new@test.com'],
    company_id: 11163
  }
};

const data = JSON.stringify(testPayload);

const options = {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data),
    'User-Agent': 'rentprog_webhook/1.0'
  }
};

console.log('🧪 Тест: client_update для Service Center (client ID 381296)\n');
console.log('📥 URL: https://n8n.rentflow.rentals/webhook/service-center-webhook');
console.log('📦 Payload:');
console.log(JSON.stringify(testPayload, null, 2));
console.log('');

const start = Date.now();

const req = https.request('https://n8n.rentflow.rentals/webhook/service-center-webhook', options, (res) => {
  const duration = Date.now() - start;
  console.log(`📊 Status: ${res.statusCode}`);
  console.log(`⏱️  Duration: ${duration}ms\n`);
  
  let responseData = '';
  res.on('data', chunk => responseData += chunk);
  res.on('end', () => {
    try {
      const parsed = JSON.parse(responseData);
      console.log('✅ Response:');
      console.log(JSON.stringify(parsed, null, 2));
    } catch {
      console.log('Response:', responseData);
    }
    
    console.log('\n💡 Проверьте:');
    console.log('   1. n8n UI → executions для Service Center Processor');
    console.log('   2. БД: SELECT * FROM events WHERE company_id = 11163 AND rentprog_id = \'381296\' ORDER BY ts DESC LIMIT 1;');
    console.log('   3. БД: SELECT * FROM external_refs WHERE system = \'rentprog\' AND external_id = \'381296\';');
    console.log('   4. Если клиента нет - должен быть запрос в RentProg → создание в external_refs');
  });
});

req.on('error', (err) => {
  console.error('❌ Ошибка:', err.message);
});

req.write(data);
req.end();

