import https from 'https';

const WEBHOOK_URL = 'https://n8n.rentflow.rentals/webhook/upsert-processor';

const testData = {
  rentprog_id: '501190',
  entity_type: 'booking'
};

console.log('🧪 Тестирование Sequential Upsert Processor\n');
console.log('═'.repeat(70));
console.log(`📋 Данные теста:`);
console.log(`   Тип: ${testData.entity_type}`);
console.log(`   RentProg ID: ${testData.rentprog_id}`);
console.log(`   URL: ${WEBHOOK_URL}`);
console.log('═'.repeat(70) + '\n');

const body = JSON.stringify(testData);
const url = new URL(WEBHOOK_URL);

const options = {
  hostname: url.hostname,
  port: url.port || 443,
  path: url.pathname,
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body)
  },
  rejectUnauthorized: false
};

console.log('🔄 Отправка запроса...\n');

const startTime = Date.now();

const req = https.request(options, (res) => {
  let responseData = '';
  
  res.on('data', chunk => responseData += chunk);
  res.on('end', () => {
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    console.log('📥 РЕЗУЛЬТАТ:\n');
    console.log('─'.repeat(70));
    console.log(`✅ Статус: ${res.statusCode}`);
    console.log(`⏱️  Время выполнения: ${duration}ms`);
    console.log('─'.repeat(70) + '\n');
    
    try {
      const result = JSON.parse(responseData);
      console.log('📄 Ответ (JSON):');
      console.log(JSON.stringify(result, null, 2));
      
      console.log('\n📊 Анализ:');
      if (result.ok) {
        console.log('   ✅ Обработка успешна');
        if (result.branch) {
          console.log(`   🏢 Филиал: ${result.branch}`);
        }
        if (result.processed !== undefined) {
          console.log(`   📝 Processed: ${result.processed}`);
        }
      } else {
        console.log('   ❌ Обработка неудачна');
        if (result.error) {
          console.log(`   ⚠️  Ошибка: ${result.error}`);
        }
      }
      
    } catch (e) {
      console.log('📄 Ответ (текст):');
      console.log(responseData);
      console.log('\n⚠️  Ответ не в формате JSON');
    }
    
    console.log('\n' + '═'.repeat(70));
    console.log('\n💡 Следующие шаги:');
    console.log('   1. Проверьте execution в n8n UI');
    console.log('   2. Проверьте БД: SELECT * FROM external_refs WHERE external_id = \'501190\'');
    console.log('   3. Если ошибка - проверьте логи workflow\n');
  });
});

req.on('error', (err) => {
  const endTime = Date.now();
  const duration = endTime - startTime;
  
  console.log('❌ ОШИБКА ЗАПРОСА:\n');
  console.log('─'.repeat(70));
  console.log(`Ошибка: ${err.message}`);
  console.log(`Время до ошибки: ${duration}ms`);
  console.log('─'.repeat(70) + '\n');
});

req.write(body);
req.end();

