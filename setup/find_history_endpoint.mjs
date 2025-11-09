import fetch from 'node-fetch';

const TOKENS = {
  'tbilisi': 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxNjA0NiIsInNjcCI6InVzZXIiLCJhdWQiOm51bGwsImlhdCI6MTc2MjQ5MDExMywiZXhwIjoxNzY1MDgyMTEzLCJqdGkiOiI0MmUxNzQ5Zi02MjEyLTRmOTMtOGM0Zi02ZWMwODUzYmUwYWQifQ.20oXaXcgK_hdofbUK3RGdQuPa0pGWtZTV4b42-A8oY4'
};

const token = TOKENS.tbilisi;

async function testEndpoint(url, params = {}) {
  const queryString = new URLSearchParams(params).toString();
  const fullUrl = queryString ? `${url}?${queryString}` : url;
  
  console.log(`\n🔍 ${fullUrl}`);
  
  try {
    const response = await fetch(fullUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json, text/plain, */*',
        'Authorization': `Bearer ${token}`,
        'Origin': 'https://web.rentprog.ru',
        'Referer': 'https://web.rentprog.ru/history',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    console.log(`   Status: ${response.status} ${response.statusText}`);
    
    if (response.ok) {
      const data = await response.json();
      console.log(`   ✅ SUCCESS!`);
      
      // Анализируем структуру
      if (Array.isArray(data)) {
        console.log(`   📊 Массив, элементов: ${data.length}`);
        if (data.length > 0) {
          console.log(`   📄 Первый элемент:`);
          console.log(JSON.stringify(data[0], null, 2));
        }
      } else if (data.data && Array.isArray(data.data)) {
        console.log(`   📊 Объект с .data, элементов: ${data.data.length}`);
        if (data.data.length > 0) {
          console.log(`   📄 Первый элемент из .data:`);
          console.log(JSON.stringify(data.data[0], null, 2));
        }
      } else {
        console.log(`   📊 Структура объекта:`, Object.keys(data));
        console.log(JSON.stringify(data, null, 2).substring(0, 1000));
      }
      
      return data;
    }
  } catch (error) {
    console.log(`   ❌ ${error.message}`);
  }
  
  return null;
}

async function main() {
  console.log('🚀 Поиск API endpoint для истории RentProg\n');
  
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  
  const formatDate = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  
  const formatDateTime = (date) => date.toISOString();
  
  console.log('📅 Период: вчера + сегодня');
  console.log(`   От: ${formatDate(yesterday)}`);
  console.log(`   До: ${formatDate(now)}`);
  
  // 1. Проверяем bookings - может там есть история изменений
  console.log('\n' + '='.repeat(60));
  console.log('1️⃣  Проверяем /bookings с последними изменениями');
  await testEndpoint('https://rentprog.net/api/v1/bookings', {
    updated_at_from: formatDateTime(yesterday),
    per_page: 5
  });
  
  // 2. Может быть есть /changes или /updates
  console.log('\n' + '='.repeat(60));
  console.log('2️⃣  Проверяем возможные endpoints для изменений');
  
  const changeEndpoints = [
    'https://rentprog.net/api/v1/changes',
    'https://rentprog.net/api/v1/updates',
    'https://rentprog.net/api/v1/modifications',
    'https://rentprog.net/api/v1/revisions'
  ];
  
  for (const url of changeEndpoints) {
    await testEndpoint(url, { per_page: 5 });
  }
  
  // 3. Может быть версионирование есть
  console.log('\n' + '='.repeat(60));
  console.log('3️⃣  Проверяем endpoints для версий');
  
  const versionEndpoints = [
    'https://rentprog.net/api/v1/versions',
    'https://rentprog.net/api/v1/paper_trail',
    'https://rentprog.net/api/v1/audit_trail'
  ];
  
  for (const url of versionEndpoints) {
    await testEndpoint(url, { per_page: 5 });
  }
  
  // 4. Может быть есть notifications/alerts
  console.log('\n' + '='.repeat(60));
  console.log('4️⃣  Проверяем notifications/alerts');
  
  const notificationEndpoints = [
    'https://rentprog.net/api/v1/notifications',
    'https://rentprog.net/api/v1/alerts',
    'https://rentprog.net/api/v1/messages'
  ];
  
  for (const url of notificationEndpoints) {
    await testEndpoint(url, { per_page: 5 });
  }
  
  // 5. Может быть timeline/feed
  console.log('\n' + '='.repeat(60));
  console.log('5️⃣  Проверяем timeline/feed/stream');
  
  const timelineEndpoints = [
    'https://rentprog.net/api/v1/timeline',
    'https://rentprog.net/api/v1/feed',
    'https://rentprog.net/api/v1/stream',
    'https://rentprog.net/api/v1/activity_stream'
  ];
  
  for (const url of timelineEndpoints) {
    await testEndpoint(url, { per_page: 5 });
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('✅ Поиск завершен!');
  console.log('\n💡 Если ничего не найдено, значит страница /history');
  console.log('   рендерится на сервере или использует GraphQL/WebSocket');
}

main();

