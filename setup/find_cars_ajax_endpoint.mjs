import puppeteer from 'puppeteer';

const LOGIN_CREDENTIALS = {
  email: 'eliseevaleksei32@gmail.com',
  password: 'a0babuz0'
};

async function findCarsEndpoint() {
  console.log('🚀 Запускаю браузер для перехвата AJAX запросов...\n');
  
  const browser = await puppeteer.launch({ 
    headless: false,
    args: ['--no-sandbox']
  });
  
  const page = await browser.newPage();
  
  // Массив для сохранения запросов
  const apiRequests = [];
  
  // Перехватываем все запросы
  page.on('request', request => {
    const url = request.url();
    if (url.includes('/api/') || url.includes('rentprog')) {
      apiRequests.push({
        method: request.method(),
        url: url,
        headers: request.headers(),
        postData: request.postData()
      });
    }
  });
  
  try {
    // 1. Логин
    console.log('1️⃣  Переход на страницу логина...');
    await page.goto('https://web.rentprog.ru/signin', { waitUntil: 'networkidle2' });
    
    console.log('2️⃣  Ввод логина и пароля...');
    await page.type('input[type="email"]', LOGIN_CREDENTIALS.email);
    await page.type('input[type="password"]', LOGIN_CREDENTIALS.password);
    
    console.log('3️⃣  Нажатие кнопки входа...');
    await page.click('button[type="submit"]');
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 });
    
    console.log('✅ Успешный логин!\n');
    
    // 2. Переход на страницу /cars
    console.log('4️⃣  Переход на страницу /cars...');
    apiRequests.length = 0; // Очищаем массив перед переходом
    
    await page.goto('https://web.rentprog.ru/cars', { waitUntil: 'networkidle2', timeout: 30000 });
    
    console.log('✅ Страница загружена!\n');
    
    // Ждем еще немного для AJAX запросов
    await page.waitForTimeout(3000);
    
    // 3. Выводим все API запросы
    console.log('📡 ПЕРЕХВАЧЕННЫЕ API ЗАПРОСЫ:\n');
    console.log('='.repeat(80));
    
    apiRequests.forEach((req, index) => {
      console.log(`\n${index + 1}. ${req.method} ${req.url}`);
      
      if (req.postData) {
        console.log(`   Body: ${req.postData.substring(0, 200)}`);
      }
      
      if (req.headers['authorization']) {
        console.log(`   Auth: ${req.headers['authorization'].substring(0, 50)}...`);
      }
    });
    
    console.log('\n' + '='.repeat(80));
    
    // 4. Ищем самый вероятный endpoint для машин
    const carsEndpoint = apiRequests.find(req => 
      (req.url.includes('cars') || req.url.includes('search') || req.url.includes('index')) &&
      req.method === 'POST'
    );
    
    if (carsEndpoint) {
      console.log('\n\n✅ НАЙДЕН ENDPOINT ДЛЯ МАШИН:');
      console.log(`   URL: ${carsEndpoint.url}`);
      console.log(`   Method: ${carsEndpoint.method}`);
      if (carsEndpoint.postData) {
        console.log(`   Body: ${carsEndpoint.postData}`);
      }
    }
    
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
  } finally {
    console.log('\n\n⏳ Закрываю браузер через 5 секунд...');
    await page.waitForTimeout(5000);
    await browser.close();
  }
}

findCarsEndpoint();

