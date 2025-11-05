import https from 'https';

// Тестируем прямой доступ к RentProg API
const branches = ['tbilisi', 'batumi', 'kutaisi', 'service-center'];
const bookingId = '501190';

console.log('🔍 Тестирование прямого доступа к RentProg API\n');
console.log('═'.repeat(70));
console.log(`Ищем booking ${bookingId} в каждом филиале...\n`);

async function testBranch(branch) {
  return new Promise((resolve) => {
    const url = `https://rentprog.net/api/v1/public/bookings/${bookingId}`;
    const urlObj = new URL(url);
    
    const options = {
      hostname: urlObj.hostname,
      port: 443,
      path: `${urlObj.pathname}?branch=${branch}`,
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'n8n-test'
      },
      rejectUnauthorized: false
    };

    console.log(`🔄 ${branch}...`);
    console.log(`   URL: ${url}?branch=${branch}`);

    const startTime = Date.now();

    const req = https.request(options, (res) => {
      let responseData = '';
      
      res.on('data', chunk => responseData += chunk);
      res.on('end', () => {
        const duration = Date.now() - startTime;
        
        if (res.statusCode === 200) {
          try {
            const data = JSON.parse(responseData);
            console.log(`   ✅ НАЙДЕНО! (${duration}ms)`);
            console.log(`   Данные: ${JSON.stringify(data).substring(0, 100)}...`);
            resolve({ branch, found: true, data, duration, status: res.statusCode });
          } catch (e) {
            console.log(`   ⚠️  200 но не JSON (${duration}ms)`);
            console.log(`   Ответ: ${responseData.substring(0, 100)}`);
            resolve({ branch, found: false, error: 'Invalid JSON', duration, status: res.statusCode });
          }
        } else if (res.statusCode === 404) {
          console.log(`   ❌ Не найдено (${duration}ms)`);
          resolve({ branch, found: false, error: '404 Not Found', duration, status: res.statusCode });
        } else if (res.statusCode === 401 || res.statusCode === 403) {
          console.log(`   🔒 Ошибка доступа: ${res.statusCode} (${duration}ms)`);
          console.log(`   Нужна аутентификация!`);
          resolve({ branch, found: false, error: `Auth error ${res.statusCode}`, duration, status: res.statusCode });
        } else {
          console.log(`   ⚠️  Ошибка: ${res.statusCode} (${duration}ms)`);
          console.log(`   Ответ: ${responseData.substring(0, 100)}`);
          resolve({ branch, found: false, error: `HTTP ${res.statusCode}`, duration, status: res.statusCode });
        }
      });
    });

    req.on('error', (err) => {
      const duration = Date.now() - startTime;
      console.log(`   ❌ Ошибка соединения (${duration}ms): ${err.message}`);
      resolve({ branch, found: false, error: err.message, duration });
    });

    req.end();
  });
}

async function main() {
  const results = [];
  
  for (const branch of branches) {
    const result = await testBranch(branch);
    results.push(result);
    console.log('');
    
    // Небольшая задержка между запросами
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log('═'.repeat(70));
  console.log('\n📊 ИТОГОВЫЙ РЕЗУЛЬТАТ:\n');

  const found = results.find(r => r.found);
  
  if (found) {
    console.log(`✅ Бронь найдена в филиале: ${found.branch.toUpperCase()}`);
    console.log(`   Время поиска: ${found.duration}ms`);
    console.log(`   Данные: ${JSON.stringify(found.data, null, 2).substring(0, 200)}...`);
  } else {
    console.log('❌ Бронь НЕ НАЙДЕНА ни в одном филиале!');
    console.log('\n🔍 Детали по филиалам:');
    results.forEach(r => {
      console.log(`   • ${r.branch}: ${r.error} (status: ${r.status || 'N/A'})`);
    });
    
    console.log('\n⚠️  ВОЗМОЖНЫЕ ПРИЧИНЫ:');
    const hasAuthError = results.some(r => r.status === 401 || r.status === 403);
    if (hasAuthError) {
      console.log('   1. ❌ Нет токенов аутентификации в запросах');
      console.log('      Решение: n8n должен использовать RentProg credentials');
    }
    console.log('   2. ❌ API endpoint требует другой формат');
    console.log('   3. ❌ Бронь действительно не существует');
    console.log('   4. ❌ Нужен другой branch parameter');
  }

  console.log('\n💡 СЛЕДУЮЩИЙ ШАГ:');
  console.log('   Проверим, использует ли n8n RentProg credentials...\n');
}

main();

