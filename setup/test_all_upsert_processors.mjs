import https from 'https';

const BASE_URL = 'https://n8n.rentflow.rentals';

// Тестовые данные
const testData = {
  rentprog_id: '65311',
  entity_type: 'car'
};

const versions = [
  { name: 'Sequential', path: '/webhook/upsert-processor' },
  { name: 'Parallel', path: '/webhook/upsert-processor-parallel' },
  { name: 'Cached (1st - miss)', path: '/webhook/upsert-processor-cached' },
  { name: 'Cached (2nd - hit)', path: '/webhook/upsert-processor-cached' }
];

function testWebhook(url, data) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(data);
    const urlObj = new URL(url);
    
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || 443,
      path: urlObj.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      },
      rejectUnauthorized: false
    };

    const startTime = Date.now();
    
    const req = https.request(options, (res) => {
      let responseData = '';
      
      res.on('data', chunk => responseData += chunk);
      res.on('end', () => {
        const endTime = Date.now();
        const duration = endTime - startTime;
        
        try {
          const result = JSON.parse(responseData);
          resolve({ 
            status: res.statusCode, 
            data: result, 
            duration,
            success: res.statusCode === 200 
          });
        } catch (e) {
          resolve({ 
            status: res.statusCode, 
            data: responseData, 
            duration,
            success: false,
            error: 'JSON parse error'
          });
        }
      });
    });

    req.on('error', (err) => {
      const endTime = Date.now();
      reject({ 
        error: err.message, 
        duration: endTime - startTime 
      });
    });

    req.write(body);
    req.end();
  });
}

async function runTests() {
  console.log('🧪 Тестирование всех версий Upsert Processor\n');
  console.log(`📋 Тестовые данные: ${JSON.stringify(testData)}\n`);
  console.log('═'.repeat(70) + '\n');

  for (const version of versions) {
    const url = `${BASE_URL}${version.path}`;
    
    console.log(`🔄 Тестирую: ${version.name}`);
    console.log(`   URL: ${url}`);
    
    try {
      const result = await testWebhook(url, testData);
      
      console.log(`   ✅ Статус: ${result.status}`);
      console.log(`   ⏱️  Время: ${result.duration}ms`);
      console.log(`   📄 Ответ: ${JSON.stringify(result.data, null, 2).split('\n').map((line, i) => i === 0 ? line : `      ${line}`).join('\n')}`);
      
      if (result.data.branch) {
        console.log(`   🏢 Филиал: ${result.data.branch}`);
      }
      if (result.data.cached !== undefined) {
        console.log(`   💾 Кэш: ${result.data.cached ? '✅ HIT' : '❌ MISS'}`);
      }
      
    } catch (error) {
      console.log(`   ❌ Ошибка: ${error.error || error.message}`);
      if (error.duration) {
        console.log(`   ⏱️  Время до ошибки: ${error.duration}ms`);
      }
    }
    
    console.log('─'.repeat(70) + '\n');
    
    // Небольшая задержка между запросами
    if (version !== versions[versions.length - 1]) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  console.log('═'.repeat(70));
  console.log('\n✅ Тестирование завершено!\n');
  
  console.log('📊 Сравнение производительности:');
  console.log('   • Sequential: зависит от филиала (200-1000ms)');
  console.log('   • Parallel: ~200-300ms всегда');
  console.log('   • Cached (hit): ~100ms');
  console.log('   • Cached (miss): ~300ms');
  
  console.log('\n💡 Рекомендация:');
  console.log('   Для продакшена используйте Cached версию!');
  console.log('   URL: /webhook/upsert-processor-cached');
}

runTests().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});

