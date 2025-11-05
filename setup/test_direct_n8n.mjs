import http from 'http';

// Прямой доступ к n8n на порту 5678 (минуя Nginx)
const DIRECT_URL = 'http://46.224.17.15:5678/webhook/upsert-processor';

console.log('\n🔬 Тест ПРЯМОГО доступа к n8n (минуя Nginx)...\n');
console.log(`📍 URL: ${DIRECT_URL}\n`);

const payload = JSON.stringify({
  entity_type: 'car',
  rentprog_id: '37471'
});

const options = {
  hostname: '46.224.17.15',
  port: 5678,
  path: '/webhook/upsert-processor',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload)
  }
};

const startTime = Date.now();

const req = http.request(options, (res) => {
  const endTime = Date.now();
  console.log(`📊 Status: ${res.statusCode} (${endTime - startTime}ms)\n`);
  
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
    
    console.log('💡 Если ответ получен, проверьте Executions:\n');
    console.log('   node setup/check_executions.mjs\n');
  });
});

req.on('error', (e) => {
  console.error(`❌ Ошибка: ${e.message}\n`);
});

req.write(payload);
req.end();

