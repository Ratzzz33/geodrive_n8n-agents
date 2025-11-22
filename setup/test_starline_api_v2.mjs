#!/usr/bin/env node
/**
 * Тестирование Starline API - проверка правильных endpoints
 */

const APP_ID = '40884';
const APP_SECRET = '55t6wDYPs800o3UCRfjd_kW27f2eI1fL';

async function testStarlineAPI() {
  console.log('🧪 Тестирование Starline API...\n');

  try {
    // Шаг 1: Получение OpenAPI спецификации
    console.log('1️⃣ Получаю OpenAPI спецификацию...\n');
    
    const specResponse = await fetch('https://developer.starline.ru/spec/openapi.json');
    if (!specResponse.ok) {
      throw new Error(`Failed to get spec: ${specResponse.status}`);
    }
    
    const spec = await specResponse.json();
    console.log(`   ✅ Спецификация получена\n`);

    // Ищем endpoints для получения токена
    const paths = spec.paths || {};
    const tokenEndpoints = Object.keys(paths).filter(path => 
      path.includes('token') || path.includes('auth') || path.includes('oauth')
    );
    
    console.log('2️⃣ Найденные endpoints для токена/авторизации:\n');
    tokenEndpoints.forEach(path => {
      const methods = Object.keys(paths[path]);
      console.log(`   ${path}: ${methods.join(', ')}`);
    });
    console.log('');

    // Шаг 2: Пробуем разные варианты получения токена
    const endpointsToTry = [
      'https://developer.starline.ru/oauth/v1/access_token',
      'https://developer.starline.ru/apiV3/application/getToken',
      'https://developer.starline.ru/json/v1/auth',
      'https://developer.starline.ru/json/v2/auth.slid',
    ];

    console.log('3️⃣ Пробую разные endpoints для получения токена...\n');

    for (const endpoint of endpointsToTry) {
      console.log(`   Пробую: ${endpoint}`);
      
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            appId: APP_ID,
            appSecret: APP_SECRET
          })
        });

        console.log(`      Статус: ${response.status} ${response.statusText}`);
        
        if (response.ok) {
          const data = await response.json();
          console.log(`      ✅ УСПЕХ! Ответ:`, JSON.stringify(data, null, 2).substring(0, 300));
          console.log(`\n   🎯 Правильный endpoint: ${endpoint}\n`);
          return { endpoint, data };
        } else {
          const errorText = await response.text();
          console.log(`      ❌ Ошибка: ${errorText.substring(0, 100)}`);
        }
      } catch (error) {
        console.log(`      ❌ Исключение: ${error.message}`);
      }
      console.log('');
    }

    // Шаг 3: Проверяем структуру SLID endpoints из спецификации
    console.log('4️⃣ Проверяю SLID endpoints из спецификации...\n');
    
    if (paths['/apiV3/application/getToken']) {
      const getTokenPath = paths['/apiV3/application/getToken'];
      console.log('   Найден /apiV3/application/getToken:');
      console.log('   Методы:', Object.keys(getTokenPath));
      
      if (getTokenPath.post) {
        console.log('   POST параметры:', JSON.stringify(getTokenPath.post.requestBody, null, 2).substring(0, 500));
      }
    }

    if (paths['/apiV3/application/getCode']) {
      const getCodePath = paths['/apiV3/application/getCode'];
      console.log('\n   Найден /apiV3/application/getCode:');
      console.log('   Методы:', Object.keys(getCodePath));
    }

    console.log('\n❌ Не удалось найти рабочий endpoint для получения токена');
    console.log('   Проверьте документацию: https://developer.starline.ru');

  } catch (error) {
    console.error('❌ Ошибка при тестировании API:');
    console.error(error.message);
    if (error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }
    process.exit(1);
  }
}

testStarlineAPI();

