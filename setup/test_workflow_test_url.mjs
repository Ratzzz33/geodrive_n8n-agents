import https from 'https';

// Используем TEST URL вместо production
const TEST_URL = 'https://n8n.rentflow.rentals/webhook-test/upsert-processor';

console.log('\n🧪 Тест через TEST webhook URL (не production)...\n');
console.log(`📍 URL: ${TEST_URL}\n`);

const payload = JSON.stringify({
  entity_type: 'car',
  rentprog_id: '37471'
});

const options = {
  hostname: 'n8n.rentflow.rentals',
  port: 443,
  path: '/webhook-test/upsert-processor',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload)
  }
};

const req = https.request(options, (res) => {
  console.log(`📊 Status: ${res.statusCode}\n`);
  
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => {
    console.log(`📄 Body: ${body || '(empty)'}\n`);
    
    if (body) {
      try {
        const json = JSON.parse(body);
        console.log(`✅ Parsed:\n${JSON.stringify(json, null, 2)}\n`);
      } catch (e) {
        console.log(`⚠️  Not JSON\n`);
      }
    }
    
    console.log('💡 Теперь проверьте Executions в n8n UI:');
    console.log('   https://n8n.rentflow.rentals/workflow/fijJpRlLjgpxSJE7/executions\n');
  });
});

req.on('error', (e) => {
  console.error(`❌ Ошибка: ${e.message}\n`);
});

req.write(payload);
req.end();

