import https from 'https';

const BATUMI_TOKEN = '7ad345720f8d92f10c187122427c6a2c2bb9494c6bf14e8d';
const BASE_URL = 'https://rentprog.net/api/v1/public';

console.log('\n🔬 Прямой тест RentProg API...\n');

// Шаг 1: Получаем request token
console.log('1️⃣ Получение токена для Batumi...');

https.get(`${BASE_URL}/get_token?company_token=${BATUMI_TOKEN}`, (res) => {
  let tokenData = '';
  res.on('data', chunk => tokenData += chunk);
  res.on('end', async () => {
    const tokenJson = JSON.parse(tokenData);
    const requestToken = tokenJson.token;
    console.log(`   ✅ Токен получен: ${requestToken.substring(0, 20)}...`);

    // Шаг 2: Пробуем /cars/37471
    console.log('\n2️⃣ Запрос: GET /cars/37471');
    
    https.get(`${BASE_URL}/cars/37471`, {
      headers: { 'Authorization': `Bearer ${requestToken}` }
    }, (res2) => {
      let carData = '';
      res2.on('data', chunk => carData += chunk);
      res2.on('end', () => {
        console.log(`   Статус: ${res2.statusCode}`);
        
        if (res2.statusCode === 200) {
          const car = JSON.parse(carData);
          console.log(`   ✅ Машина найдена!`);
          console.log(`   ID: ${car.id}`);
          console.log(`   Название: ${car.car_name || 'N/A'}`);
          console.log(`\n   Полный JSON:`);
          console.log(JSON.stringify(car, null, 2).substring(0, 500) + '...');
        } else {
          console.log(`   ❌ Ошибка: ${res2.statusCode}`);
          console.log(`   Body: ${carData}`);
        }
        
        // Шаг 3: Пробуем fallback /car/37471
        console.log('\n3️⃣ Запрос: GET /car/37471 (fallback)');
        
        https.get(`${BASE_URL}/car/37471`, {
          headers: { 'Authorization': `Bearer ${requestToken}` }
        }, (res3) => {
          let carData2 = '';
          res3.on('data', chunk => carData2 += chunk);
          res3.on('end', () => {
            console.log(`   Статус: ${res3.statusCode}`);
            
            if (res3.statusCode === 200) {
              const car = JSON.parse(carData2);
              console.log(`   ✅ Машина найдена через fallback!`);
              console.log(`   ID: ${car.id}`);
              console.log(`   Название: ${car.car_name || 'N/A'}`);
            } else {
              console.log(`   ❌ Ошибка: ${res3.statusCode}`);
              console.log(`   Body: ${carData2}`);
            }
            
            console.log('\n📝 Результат: проверьте, какой endpoint работает!');
          });
        });
      });
    });
  });
});

