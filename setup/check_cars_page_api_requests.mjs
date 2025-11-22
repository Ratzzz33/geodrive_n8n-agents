/**
 * Скрипт для проверки API запросов на странице /cars
 * Перехватывает все HTTP запросы и показывает, какие endpoints используются для получения цен
 */

import { chromium } from 'playwright';

const LOGIN_CREDENTIALS = {
  email: 'eliseevaleksei32@gmail.com',
  password: 'a0babuz0'
};

async function checkCarsPageAPIRequests() {
  console.log('🚀 Запускаю браузер для проверки API запросов на странице /cars...\n');
  
  const browser = await chromium.launch({ 
    headless: false
  });
  
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });
  
  const page = await context.newPage();
  
  // Перехватываем все сетевые запросы
  const requests = [];
  const responses = [];
  
  page.on('request', request => {
    const url = request.url();
    if (url.includes('rentprog.net/api') || url.includes('prices') || url.includes('seasons')) {
      requests.push({
        url: url,
        method: request.method(),
        headers: request.headers(),
        postData: request.postData()
      });
      console.log(`📤 REQUEST: ${request.method()} ${url}`);
    }
  });
  
  page.on('response', async response => {
    const url = response.url();
    if (url.includes('rentprog.net/api') || url.includes('prices') || url.includes('seasons')) {
      try {
        const contentType = response.headers()['content-type'] || '';
        if (contentType.includes('application/json')) {
          const data = await response.json();
          responses.push({
            url: url,
            status: response.status(),
            data: data
          });
          console.log(`📥 RESPONSE: ${response.status()} ${url}`);
          
          // Проверяем, есть ли данные о ценах
          if (JSON.stringify(data).includes('price') || JSON.stringify(data).includes('season')) {
            console.log(`   ✅ Содержит данные о ценах/сезонах!`);
            console.log(`   📊 Размер ответа: ${JSON.stringify(data).length} символов`);
          }
        }
      } catch (e) {
        // Игнорируем ошибки парсинга
      }
    }
  });
  
  try {
    // 1. Логин
    console.log('1️⃣  Логин в систему...');
    await page.goto('https://web.rentprog.ru/signin', { waitUntil: 'networkidle2' });
    
    await page.type('input[type="text"]', LOGIN_CREDENTIALS.email);
    await page.type('input[type="password"]', LOGIN_CREDENTIALS.password);
    
    // Ищем кнопку входа
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => 
        b.textContent.trim() === 'Вход' && b.type === 'submit'
      );
      if (btn) btn.click();
    });
    
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 });
    console.log('✅ Успешный логин!\n');
    
    // 2. Переход на страницу /cars
    console.log('2️⃣  Переход на страницу /cars и перехват запросов...');
    await page.goto('https://web.rentprog.ru/cars', { waitUntil: 'networkidle2', timeout: 60000 });
    await page.waitForTimeout(5000); // Ждём, пока все запросы завершатся
    
    console.log('\n3️⃣  АНАЛИЗ ПЕРЕХВАЧЕННЫХ ЗАПРОСОВ:\n');
    console.log('='.repeat(80));
    
    // Фильтруем запросы, связанные с ценами
    const priceRelatedRequests = requests.filter(r => 
      r.url.includes('price') || r.url.includes('season') || r.url.includes('car_data')
    );
    
    const priceRelatedResponses = responses.filter(r => {
      const dataStr = JSON.stringify(r.data);
      return dataStr.includes('price') || dataStr.includes('season') || r.url.includes('car_data');
    });
    
    console.log(`\n📊 Всего API запросов: ${requests.length}`);
    console.log(`💰 Запросов, связанных с ценами: ${priceRelatedRequests.length}`);
    console.log(`📥 Ответов с данными о ценах: ${priceRelatedResponses.length}\n`);
    
    if (priceRelatedRequests.length > 0) {
      console.log('🔍 ЗАПРОСЫ ДЛЯ ПОЛУЧЕНИЯ ЦЕН:\n');
      priceRelatedRequests.forEach((req, idx) => {
        console.log(`${idx + 1}. ${req.method} ${req.url}`);
        if (req.headers['authorization']) {
          console.log(`   Authorization: ${req.headers['authorization'].substring(0, 30)}...`);
        }
      });
    }
    
    if (priceRelatedResponses.length > 0) {
      console.log('\n📦 ОТВЕТЫ С ДАННЫМИ О ЦЕНАХ:\n');
      priceRelatedResponses.forEach((resp, idx) => {
        console.log(`${idx + 1}. ${resp.url} (${resp.status})`);
        
        // Пытаемся найти структуру данных о ценах
        const data = resp.data;
        if (data.data && Array.isArray(data.data)) {
          const firstCar = data.data[0];
          if (firstCar && firstCar.attributes) {
            const attrs = firstCar.attributes;
            if (attrs.prices || attrs.seasons) {
              console.log(`   ✅ Содержит prices/seasons в attributes!`);
              console.log(`   📋 Пример структуры:`);
              console.log(`      - prices: ${attrs.prices ? 'есть' : 'нет'}`);
              console.log(`      - seasons: ${attrs.seasons ? 'есть' : 'нет'}`);
            }
          }
        }
        
        // Проверяем relationships
        if (data.data && Array.isArray(data.data) && data.data[0]?.relationships) {
          const rels = data.data[0].relationships;
          if (rels.prices || rels.seasons) {
            console.log(`   ✅ Содержит prices/seasons в relationships!`);
            if (rels.prices?.data) {
              console.log(`   📊 Количество цен: ${rels.prices.data.length}`);
            }
            if (rels.seasons?.data) {
              console.log(`   📅 Количество сезонов: ${rels.seasons.data.length}`);
            }
          }
        }
        
        // Проверяем включённые данные (included)
        if (data.included && Array.isArray(data.included)) {
          const priceIncluded = data.included.filter(item => item.type === 'price');
          const seasonIncluded = data.included.filter(item => item.type === 'season');
          
          if (priceIncluded.length > 0 || seasonIncluded.length > 0) {
            console.log(`   ✅ Содержит включённые данные (included):`);
            console.log(`      - Цен: ${priceIncluded.length}`);
            console.log(`      - Сезонов: ${seasonIncluded.length}`);
            
            if (priceIncluded.length > 0) {
              console.log(`   📋 Пример цены:`);
              console.log(`      ${JSON.stringify(priceIncluded[0].attributes || {}, null, 6).substring(0, 200)}...`);
            }
          }
        }
        
        console.log('');
      });
    }
    
    // Сохраняем результаты в файл
    const fs = await import('fs');
    fs.writeFileSync(
      'setup/cars_page_api_requests.json',
      JSON.stringify({
        requests: priceRelatedRequests,
        responses: priceRelatedResponses.map(r => ({
          url: r.url,
          status: r.status,
          hasPrices: JSON.stringify(r.data).includes('price'),
          hasSeasons: JSON.stringify(r.data).includes('season')
        }))
      }, null, 2)
    );
    
    console.log('💾 Результаты сохранены в setup/cars_page_api_requests.json\n');
    
    await browser.close();
    
    return {
      success: true,
      priceRequests: priceRelatedRequests.length,
      priceResponses: priceRelatedResponses.length
    };
    
  } catch (error) {
    console.error('❌ Ошибка:', error);
    await browser.close();
    return { success: false, error: error.message };
  }
}

// Запуск
checkCarsPageAPIRequests()
  .then(result => {
    console.log('\n✅ Завершено:', result);
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Критическая ошибка:', error);
    process.exit(1);
  });

