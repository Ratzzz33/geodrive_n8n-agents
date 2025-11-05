import https from 'https';

const BATUMI_TOKEN = '7ad345720f8d92f10c187122427c6a2c2bb9494c6bf14e8d';
const BASE_URL = 'https://rentprog.net/api/v1/public';

console.log('\n🔬 Тест /all_cars_full с фильтром по ID...\n');

// Получаем token
console.log('1️⃣ Получение токена...');
https.get(`${BASE_URL}/get_token?company_token=${BATUMI_TOKEN}`, (res) => {
  let tokenData = '';
  res.on('data', chunk => tokenData += chunk);
  res.on('end', () => {
    const requestToken = JSON.parse(tokenData).token;
    console.log(`   ✅ Токен получен\n`);

    // Пробуем варианты запросов
    const tests = [
      { name: '/all_cars_full?id=37471', url: `${BASE_URL}/all_cars_full?id=37471` },
      { name: '/all_cars_full?car_id=37471', url: `${BASE_URL}/all_cars_full?car_id=37471` },
      { name: '/all_cars_full (все, потом фильтр)', url: `${BASE_URL}/all_cars_full?limit=1000` }
    ];

    let currentTest = 0;
    
    function runTest() {
      if (currentTest >= tests.length) {
        console.log('\n📝 Результат: проверьте, какой метод работает!');
        return;
      }

      const test = tests[currentTest];
      console.log(`${currentTest + 2}️⃣  Тест: ${test.name}`);
      
      https.get(test.url, {
        headers: { 'Authorization': `Bearer ${requestToken}` }
      }, (res2) => {
        let data = '';
        res2.on('data', chunk => data += chunk);
        res2.on('end', () => {
          console.log(`   Статус: ${res2.statusCode}`);
          
          if (res2.statusCode === 200) {
            try {
              const json = JSON.parse(data);
              const cars = Array.isArray(json) ? json : (json.data || []);
              
              if (currentTest < 2) {
                // Первые два теста - с фильтром
                if (cars.length > 0) {
                  const car = cars[0];
                  console.log(`   ✅ Машина найдена!`);
                  console.log(`   ID: ${car.id}`);
                  console.log(`   Название: ${car.car_name || 'N/A'}`);
                  console.log(`   Всего в ответе: ${cars.length} машин\n`);
                } else {
                  console.log(`   ❌ Пустой массив\n`);
                }
              } else {
                // Третий тест - загружаем все и ищем
                console.log(`   ✅ Загружено: ${cars.length} машин`);
                const found = cars.find(c => c.id == 37471);
                if (found) {
                  console.log(`   ✅ Машина 37471 найдена в массиве!`);
                  console.log(`   Название: ${found.car_name || 'N/A'}\n`);
                } else {
                  console.log(`   ❌ Машина 37471 НЕ найдена в массиве\n`);
                }
              }
            } catch (e) {
              console.log(`   ❌ Ошибка парсинга JSON: ${e.message}\n`);
            }
          } else {
            console.log(`   ❌ Ошибка ${res2.statusCode}\n`);
          }
          
          currentTest++;
          runTest();
        });
      }).on('error', (e) => {
        console.log(`   ❌ Ошибка запроса: ${e.message}\n`);
        currentTest++;
        runTest();
      });
    }
    
    runTest();
  });
});

