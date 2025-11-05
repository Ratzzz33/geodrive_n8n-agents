import https from 'https';

const url = 'https://n8n.rentflow.rentals/webhook/upsert-processor';
const data = JSON.stringify({
  entity_type: 'car',
  rentprog_id: '37471'
});

console.log('\n🚀 Тестируем с машиной 37471 (известна в БД)...');
console.log(`📍 URL: ${url}`);
console.log(`📦 Payload:`, data);
console.log('');

const startTime = Date.now();

const req = https.request(url, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data)
  }
}, (res) => {
  let responseData = '';
  
  res.on('data', (chunk) => {
    responseData += chunk;
  });
  
  res.on('end', () => {
    const duration = Date.now() - startTime;
    console.log(`✅ Ответ получен! (${duration}ms)\n`);
    console.log(`📊 Status: ${res.statusCode}`);
    console.log(`📄 Body:`, responseData || '(empty)');
    
    if (responseData) {
      try {
        const parsed = JSON.parse(responseData);
        console.log('\n✅ Parsed:');
        console.log(JSON.stringify(parsed, null, 2));
      } catch (e) {
        // not JSON
      }
    }
  });
});

req.on('error', (error) => {
  console.error(`❌ Ошибка запроса: ${error.message}`);
});

req.write(data);
req.end();

