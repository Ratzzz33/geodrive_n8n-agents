import https from 'https';

const url = 'https://n8n.rentflow.rentals/webhook/upsert-processor';
const data = JSON.stringify({
  entity_type: 'booking',
  rentprog_id: '501190'
});

console.log('\n🚀 Тестируем исправленный Upsert Processor workflow...');
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
    console.log(`📄 Body:`);
    
    try {
      const parsed = JSON.parse(responseData);
      console.log(JSON.stringify(parsed, null, 2));
      
      if (parsed.ok) {
        console.log('\n✅ Бронь найдена и сохранена!');
        console.log(`   • Branch: ${parsed.branch}`);
        console.log(`   • Entity ID: ${parsed.entityId}`);
      } else {
        console.log('\n❌ Бронь не найдена ни в одном филиале');
        console.log('   Проверьте Telegram alert chat!');
      }
    } catch (e) {
      console.log(responseData);
    }
  });
});

req.on('error', (error) => {
  console.error(`❌ Ошибка запроса: ${error.message}`);
});

req.write(data);
req.end();

