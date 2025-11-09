import fetch from 'node-fetch';

const token = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxNjA0NiIsInNjcCI6InVzZXIiLCJhdWQiOm51bGwsImlhdCI6MTc2MjQ5MDExMywiZXhwIjoxNzY1MDgyMTEzLCJqdGkiOiI0MmUxNzQ5Zi02MjEyLTRmOTMtOGM0Zi02ZWMwODUzYmUwYWQifQ.20oXaXcgK_hdofbUK3RGdQuPa0pGWtZTV4b42-A8oY4';

async function testAjaxEndpoint(url, params = {}) {
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
        'X-Requested-With': 'XMLHttpRequest',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    console.log(`   Status: ${response.status} ${response.statusText}`);
    
    if (response.ok) {
      const contentType = response.headers.get('content-type');
      console.log(`   Content-Type: ${contentType}`);
      
      const data = await response.json();
      console.log(`   ✅ SUCCESS!`);
      
      if (Array.isArray(data)) {
        console.log(`   📊 Массив: ${data.length} элементов`);
        if (data.length > 0) {
          console.log(`\n   📄 Первый элемент:`);
          console.log(JSON.stringify(data[0], null, 2).substring(0, 500));
        }
      } else if (data.data) {
        console.log(`   📊 Объект с .data`);
        console.log(JSON.stringify(data, null, 2).substring(0, 500));
      } else {
        console.log(`   📊 Объект:`, Object.keys(data));
        console.log(JSON.stringify(data, null, 2).substring(0, 500));
      }
      
      return data;
    }
  } catch (error) {
    console.log(`   ❌ ${error.message}`);
  }
  
  return null;
}

async function main() {
  console.log('🚀 Поиск AJAX endpoint для истории операций');
  console.log('=' .repeat(60));
  
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  
  const formatDate = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  
  const startDate = formatDate(yesterday);
  const endDate = formatDate(now);
  
  // Возможные endpoints для Vue.js приложения
  const endpoints = [
    // Попробуем с /public/ prefix
    { url: 'https://rentprog.net/api/v1/public/action_logs', params: {} },
    { url: 'https://rentprog.net/api/v1/public/user_actions', params: {} },
    { url: 'https://rentprog.net/api/v1/public/recent_activities', params: {} },
    
    // Без public
    { url: 'https://rentprog.net/api/v1/action_logs', params: {} },
    { url: 'https://rentprog.net/api/v1/user_actions', params: {} },
    { url: 'https://rentprog.net/api/v1/recent_activities', params: {} },
    
    // С датами
    { url: 'https://rentprog.net/api/v1/action_logs', params: { start_date: startDate, end_date: endDate } },
    { url: 'https://rentprog.net/api/v1/user_actions', params: { from: startDate, to: endDate } },
    
    // Может быть версии
    { url: 'https://rentprog.net/api/v2/activities', params: {} },
    { url: 'https://rentprog.net/api/v2/history', params: {} },
    { url: 'https://rentprog.net/api/v2/logs', params: {} },
    
    // Может быть GraphQL
    { url: 'https://rentprog.net/graphql', params: {} },
    { url: 'https://rentprog.net/api/graphql', params: {} }
  ];
  
  for (const { url, params } of endpoints) {
    await testAjaxEndpoint(url, params);
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('✅ Поиск завершен!');
  console.log('\n💡 Если ничего не найдено:');
  console.log('   Нужно использовать Playwright для открытия страницы');
  console.log('   и перехвата AJAX запросов через DevTools Protocol');
}

main();

