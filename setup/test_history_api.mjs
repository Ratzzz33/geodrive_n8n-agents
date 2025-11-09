import fetch from 'node-fetch';

const TOKENS = {
  'service-center': 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxNjA0NSIsInNjcCI6InVzZXIiLCJhdWQiOm51bGwsImlhdCI6MTc2MjQ5MDA0MSwiZXhwIjoxNzY1MDgyMDQxLCJqdGkiOiI1ZDkwMDI2MC02NTE2LTQxYjctOTI4Ny1jODAyMjNiN2EwNTMifQ.oLMvW9mftfJ9Oivy2riQjx8uK12Ur6aaFy02sDs6DSc',
  'tbilisi': 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxNjA0NiIsInNjcCI6InVzZXIiLCJhdWQiOm51bGwsImlhdCI6MTc2MjQ5MDExMywiZXhwIjoxNzY1MDgyMTEzLCJqdGkiOiI0MmUxNzQ5Zi02MjEyLTRmOTMtOGM0Zi02ZWMwODUzYmUwYWQifQ.20oXaXcgK_hdofbUK3RGdQuPa0pGWtZTV4b42-A8oY4',
  'batumi': 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxNjA0OCIsInNjcCI6InVzZXIiLCJhdWQiOm51bGwsImlhdCI6MTc2MjQ5MDE1NCwiZXhwIjoxNzY1MDgyMTU0LCJqdGkiOiI0MWUxMjRjOS01MDgxLTQ2NmMtOTUxNS0xNWEwMjE4ZDA1OTEifQ.l2MfCEf1LJLe-kCuF-MKyOMdhAmd3UWfzG7xECMy37o',
  'kutaisi': 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxNjA0OSIsInNjcCI6InVzZXIiLCJhdWQiOm51bGwsImlhdCI6MTc2MjQ5MDIwMiwiZXhwIjoxNzY1MDgyMjAyLCJqdGkiOiIxZWVlMWU2YS1kMTNhLTQwMzEtYjI2Mi04NGRiM2Y0ZmFiMGEifQ.xGIpTLumIwLxpitlLbeclqb9XBedY8jV1wCIuMP69Vs'
};

const branch = 'tbilisi';
const token = TOKENS[branch];

// Возможные endpoints для истории
const endpoints = [
  // Public endpoints
  'https://rentprog.net/api/v1/public/history',
  'https://rentprog.net/api/v1/public/activity_log',
  'https://rentprog.net/api/v1/public/operations',
  'https://rentprog.net/api/v1/public/logs',
  // Возможно используют company_id
  'https://rentprog.net/api/v1/companies/9246/history',
  'https://rentprog.net/api/v1/companies/9246/activity_log',
  // Или другие варианты
  'https://rentprog.net/api/v1/user_activities',
  'https://rentprog.net/api/v1/system_log',
  'https://rentprog.net/api/v1/action_log'
];

async function testEndpoint(url) {
  console.log(`\n🔍 Тестируем: ${url}`);
  
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
  
  // Пробуем разные варианты параметров
  const queryVariants = [
    `?start_date=${startDate}&end_date=${endDate}`,
    `?from=${startDate}&to=${endDate}`,
    `?created_at_from=${startDate}&created_at_to=${endDate}`,
    `?date_from=${startDate}&date_to=${endDate}`,
    `?per_page=50`,
    `?limit=50`,
    `` // без параметров
  ];
  
  for (const query of queryVariants) {
    const fullUrl = `${url}${query}`;
    
    try {
      const response = await fetch(fullUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json, text/plain, */*',
          'Authorization': `Bearer ${token}`,
          'Origin': 'https://web.rentprog.ru',
          'Referer': 'https://web.rentprog.ru/history',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36'
        }
      });
      
      console.log(`   ${query || '(no params)'} → ${response.status} ${response.statusText}`);
      
      if (response.ok) {
        const data = await response.json();
        console.log(`   ✅ SUCCESS! Получено:`, JSON.stringify(data).substring(0, 200));
        
        // Показываем структуру
        if (Array.isArray(data)) {
          console.log(`   📊 Массив, длина: ${data.length}`);
          if (data.length > 0) {
            console.log(`   📄 Первый элемент:`, JSON.stringify(data[0], null, 2).substring(0, 500));
          }
        } else if (data.data) {
          console.log(`   📊 Объект с .data, длина: ${data.data.length || 'N/A'}`);
          if (data.data.length > 0) {
            console.log(`   📄 Первый элемент:`, JSON.stringify(data.data[0], null, 2).substring(0, 500));
          }
        } else {
          console.log(`   📊 Структура:`, Object.keys(data));
        }
        
        return { url: fullUrl, data };
      }
      
    } catch (error) {
      console.log(`   ❌ Ошибка: ${error.message}`);
    }
  }
}

async function main() {
  console.log('🚀 Поиск API endpoint для истории операций RentProg');
  console.log('=' .repeat(60));
  
  for (const endpoint of endpoints) {
    await testEndpoint(endpoint);
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('✅ Тестирование завершено!');
}

main();

