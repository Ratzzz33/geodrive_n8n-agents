import https from 'https';

const WEBHOOK_URL = 'https://n8n.rentflow.rentals/webhook/service-center-webhook';

console.log('\n🧪 Тест вебхука Service Center Processor...\n');

// Тестовый вебхук: booking_create
const testWebhook = {
  event: 'booking_create',
  payload: {
    id: 999999,
    created_from_api: true,
    active: true,
    state: 'Новая',
    start_date: '05-11-2025 10:00',
    end_date: '08-11-2025 10:00',
    days: 3,
    price: 150.0,
    rental_cost: 450.0,
    total: 450.0,
    deposit: 100.0
  }
};

console.log('📥 Отправка тестового вебхука:');
console.log(JSON.stringify(testWebhook, null, 2));
console.log('');

const payload = JSON.stringify(testWebhook);

const url = new URL(WEBHOOK_URL);
const options = {
  hostname: url.hostname,
  port: 443,
  path: url.pathname,
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload)
  }
};

const startTime = Date.now();

const req = https.request(options, (res) => {
  const endTime = Date.now();
  
  console.log(`📊 Status: ${res.statusCode} (${endTime - startTime}ms)\n`);
  
  let body = '';
  res.on('data', chunk => body += chunk);
  
  res.on('end', () => {
    if (body) {
      console.log(`📄 Response:`);
      try {
        const json = JSON.parse(body);
        console.log(JSON.stringify(json, null, 2));
      } catch {
        console.log(body);
      }
      console.log('');
    }
    
    if (res.statusCode === 200) {
      console.log('✅ Вебхук успешно обработан!\n');
      
      console.log('💡 Проверьте в n8n:');
      console.log('   https://n8n.rentflow.rentals/workflow/PbDKuU06H7s2Oem8/executions\n');
      
      console.log('💡 Проверьте в БД:');
      console.log('   SELECT * FROM events WHERE company_id = 11163 ORDER BY ts DESC LIMIT 1;');
      console.log('   SELECT * FROM external_refs WHERE external_id = \'999999\' AND system = \'rentprog\';\n');
    } else {
      console.log('❌ Ошибка обработки вебхука\n');
    }
  });
});

req.on('error', (e) => {
  console.error(`❌ Ошибка запроса: ${e.message}\n`);
});

req.write(payload);
req.end();


