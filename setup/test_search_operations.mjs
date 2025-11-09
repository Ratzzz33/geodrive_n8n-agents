import fetch from 'node-fetch';

const TOKENS = {
  'service-center': 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxNjA0NSIsInNjcCI6InVzZXIiLCJhdWQiOm51bGwsImlhdCI6MTc2MjQ5MDA0MSwiZXhwIjoxNzY1MDgyMDQxLCJqdGkiOiI1ZDkwMDI2MC02NTE2LTQxYjctOTI4Ny1jODAyMjNiN2EwNTMifQ.oLMvW9mftfJ9Oivy2riQjx8uK12Ur6aaFy02sDs6DSc',
  'tbilisi': 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxNjA0NiIsInNjcCI6InVzZXIiLCJhdWQiOm51bGwsImlhdCI6MTc2MjQ5MDExMywiZXhwIjoxNzY1MDgyMTEzLCJqdGkiOiI0MmUxNzQ5Zi02MjEyLTRmOTMtOGM0Zi02ZWMwODUzYmUwYWQifQ.20oXaXcgK_hdofbUK3RGdQuPa0pGWtZTV4b42-A8oY4',
  'batumi': 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxNjA0OCIsInNjcCI6InVzZXIiLCJhdWQiOm51bGwsImlhdCI6MTc2MjQ5MDE1NCwiZXhwIjoxNzY1MDgyMTU0LCJqdGkiOiI0MWUxMjRjOS01MDgxLTQ2NmMtOTUxNS0xNWEwMjE4ZDA1OTEifQ.l2MfCEf1LJLe-kCuF-MKyOMdhAmd3UWfzG7xECMy37o',
  'kutaisi': 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxNjA0OSIsInNjcCI6InVzZXIiLCJhdWQiOm51bGwsImlhdCI6MTc2MjQ5MDIwMiwiZXhwIjoxNzY1MDgyMjAyLCJqdGkiOiIxZWVlMWU2YS1kMTNhLTQwMzEtYjI2Mi04NGRiM2Y0ZmFiMGEifQ.xGIpTLumIwLxpitlLbeclqb9XBedY8jV1wCIuMP69Vs'
};

async function fetchOperations(token, page = 1) {
  const url = "https://rentprog.net/api/v1/search_operations";
  
  const body = JSON.stringify({
    page: page,
    per_page: 50,
    sort_by: "id",
    direction: "desc",
    search: null
  });
  
  console.log(`\n📄 Запрос страницы ${page}...`);
  
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Accept": "application/json, text/plain, */*",
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
      "Origin": "https://web.rentprog.ru",
      "Referer": "https://web.rentprog.ru/",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36"
    },
    body
  });
  
  console.log(`   Status: ${response.status} ${response.statusText}`);
  
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Ошибка: ${response.status} - ${text}`);
  }
  
  const data = await response.json();
  return data;
}

async function main() {
  console.log('🚀 Тестируем search_operations API');
  console.log('=' .repeat(60));
  
  const branch = 'tbilisi';
  const token = TOKENS[branch];
  
  try {
    // Получаем первую страницу
    const page1 = await fetchOperations(token, 1);
    
    console.log('\n✅ SUCCESS!');
    console.log(`\n📊 Статистика:`);
    console.log(`   Всего операций: ${page1.total_operations || 'N/A'}`);
    console.log(`   На странице: ${page1.operations?.data?.length || 0}`);
    
    if (page1.operations?.data?.length > 0) {
      console.log(`\n📄 Первые 3 операции:\n`);
      
      for (let i = 0; i < Math.min(3, page1.operations.data.length); i++) {
        const op = page1.operations.data[i];
        const attr = op.attributes || op;
        
        console.log(`${i + 1}. ID: ${attr.id || op.id}`);
        console.log(`   Описание: ${attr.description || 'N/A'}`);
        console.log(`   Дата: ${attr.created_at || attr.date || 'N/A'}`);
        console.log(`   Тип: ${attr.operation_type || attr.type || 'N/A'}`);
        console.log(`   Пользователь: ${attr.user_name || attr.user || 'N/A'}`);
        console.log('');
      }
      
      console.log('📄 Пример полной записи (первая операция):');
      console.log(JSON.stringify(page1.operations.data[0], null, 2).substring(0, 1000));
    }
    
    // Проверяем пагинацию
    if (page1.total_operations > 50) {
      const totalPages = Math.ceil(page1.total_operations / 50);
      console.log(`\n📚 Доступно страниц: ${totalPages}`);
      console.log(`   За 3 минуты можем загрузить: 3 страницы (150 операций)`);
      
      // Получаем вторую страницу для теста
      console.log('\n🔄 Тестируем вторую страницу...');
      const page2 = await fetchOperations(token, 2);
      console.log(`   ✅ Страница 2: ${page2.operations?.data?.length || 0} операций`);
      
      if (page2.operations?.data?.length > 0) {
        const op = page2.operations.data[0];
        const attr = op.attributes || op;
        console.log(`   Первая операция: ${attr.description || 'N/A'}`);
      }
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ Тестирование завершено успешно!');
    console.log('\n📝 Готово для интеграции в workflow');
    
  } catch (error) {
    console.error('\n❌ Ошибка:', error.message);
    throw error;
  }
}

main();

