/**
 * Тестовый скрипт для проверки пагинации /all_bookings
 */

const TOKENS = {
  'tbilisi': 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxNjA0NiIsInNjcCI6InVzZXIiLCJhdWQiOm51bGwsImlhdCI6MTc2MjQ5MDExMywiZXhwIjoxNzY1MDgyMTEzLCJqdGkiOiI0MmUxNzQ5Zi02MjEyLTRmOTMtOGM0Zi02ZWMwODUzYmUwYWQifQ.20oXaXcgK_hdofbUK3RGdQuPa0pGWtZTV4b42-A8oY4',
};

const BASE_URL = 'https://rentprog.net/api/v1/public';

async function getRequestToken(branch) {
  // Используем company token напрямую для получения request token
  const companyTokens = {
    'tbilisi': '91b83b93963633649f29a04b612bab3f9fbb0471b5928622',
  };
  
  const companyToken = companyTokens[branch];
  const authUrl = `${BASE_URL}/get_token?company_token=${companyToken}`;
  
  const response = await fetch(authUrl);
  const data = await response.json();
  return data.token;
}

async function testPagination(branch) {
  console.log(`\n🔍 Тестирование пагинации для филиала: ${branch}`);
  console.log('='.repeat(60));
  
  const token = await getRequestToken(branch);
  console.log('✓ Токен получен');
  
  let page = 1;
  const perPage = 50;
  let totalFetched = 0;
  let allBookings = [];
  
  while (page <= 10) { // Ограничим 10 страницами для теста
    const url = `${BASE_URL}/all_bookings?page=${page}&per_page=${perPage}`;
    console.log(`\n📄 Страница ${page}: ${url}`);
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json'
      }
    });
    
    if (!response.ok) {
      console.error(`❌ Ошибка ${response.status}: ${response.statusText}`);
      break;
    }
    
    const data = await response.json();
    console.log(`   Тип ответа: ${Array.isArray(data) ? 'Array' : typeof data}`);
    console.log(`   Ключи: ${typeof data === 'object' ? Object.keys(data).join(', ') : 'N/A'}`);
    
    let items = [];
    if (Array.isArray(data)) {
      items = data;
    } else if (data && typeof data === 'object' && 'data' in data && Array.isArray(data.data)) {
      items = data.data;
    } else if (data && typeof data === 'object' && 'bookings' in data && Array.isArray(data.bookings)) {
      items = data.bookings;
    }
    
    console.log(`   Получено записей: ${items.length}`);
    
    if (items.length === 0) {
      console.log(`   ✓ Страница пуста, завершение`);
      break;
    }
    
    allBookings.push(...items);
    totalFetched += items.length;
    
    console.log(`   Всего собрано: ${totalFetched} бронирований`);
    
    // Показываем первые 3 ID для проверки
    if (items.length > 0) {
      const ids = items.slice(0, 3).map(b => b.id || b.booking_id || 'N/A').join(', ');
      console.log(`   Первые ID: ${ids}`);
    }
    
    // Если получили меньше запрошенного, значит последняя страница
    if (items.length < perPage) {
      console.log(`   ✓ Последняя страница (получено ${items.length} из ${perPage})`);
      break;
    }
    
    page++;
    
    // Задержка между запросами
    if (page <= 10) {
      await new Promise(resolve => setTimeout(resolve, 1500));
    }
  }
  
  console.log(`\n📊 ИТОГО:`);
  console.log(`   Обработано страниц: ${page}`);
  console.log(`   Всего бронирований: ${totalFetched}`);
  console.log(`   Уникальных ID: ${new Set(allBookings.map(b => b.id || b.booking_id)).size}`);
  
  return { total: totalFetched, pages: page };
}

async function main() {
  console.log('🧪 ТЕСТ ПАГИНАЦИИ /all_bookings');
  console.log('='.repeat(60));
  
  const result = await testPagination('tbilisi');
  
  console.log(`\n✅ Тест завершен`);
  console.log(`   Если собрано только 10 записей - API игнорирует per_page`);
  console.log(`   Если собрано больше - пагинация работает`);
}

main().catch(console.error);

