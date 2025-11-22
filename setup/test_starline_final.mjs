#!/usr/bin/env node
/**
 * Финальное тестирование авторизации Starline API с правильными credentials
 */

const APP_ID = '40884';
const APP_SECRET = '55t6wDYPs800o3UCRfjd_kW27f2eI1fL';
const USER_EMAIL = '33pokrov33@gmail.com';
const USER_PASSWORD = '7733Alex';

const SLID_BASE = 'https://id.starline.ru';
const WEBAPI_BASE = 'https://developer.starline.ru';

async function testFinal() {
  console.log('🧪 Финальное тестирование авторизации Starline API...\n');

  try {
    // Вариант 1: GET с параметром secret
    console.log('1️⃣ Вариант 1: GET с параметром secret...\n');
    let code = null;
    
    const getCodeUrl1 = `${SLID_BASE}/apiV3/application/getCode?appId=${APP_ID}&secret=${APP_SECRET}`;
    console.log(`   URL: ${getCodeUrl1.replace(APP_SECRET, '***')}\n`);
    
    const response1 = await fetch(getCodeUrl1, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    console.log(`   Статус: ${response1.status} ${response1.statusText}`);
    const data1 = await response1.json();
    console.log(`   Ответ:`, JSON.stringify(data1, null, 2));
    
    if (data1.desc && data1.desc.code) {
      code = data1.desc.code;
      console.log(`   ✅ Код получен: ${code}\n`);
    } else if (data1.code) {
      code = data1.code;
      console.log(`   ✅ Код получен: ${code}\n`);
    } else {
      console.log(`   ❌ Код не найден\n`);
    }

    // Вариант 2: GET с параметром appSecret
    if (!code) {
      console.log('2️⃣ Вариант 2: GET с параметром appSecret...\n');
      
      const getCodeUrl2 = `${SLID_BASE}/apiV3/application/getCode?appId=${APP_ID}&appSecret=${APP_SECRET}`;
      console.log(`   URL: ${getCodeUrl2.replace(APP_SECRET, '***')}\n`);
      
      const response2 = await fetch(getCodeUrl2, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      console.log(`   Статус: ${response2.status} ${response2.statusText}`);
      const data2 = await response2.json();
      console.log(`   Ответ:`, JSON.stringify(data2, null, 2));
      
      if (data2.desc && data2.desc.code) {
        code = data2.desc.code;
        console.log(`   ✅ Код получен: ${code}\n`);
      } else if (data2.code) {
        code = data2.code;
        console.log(`   ✅ Код получен: ${code}\n`);
      }
    }

    // Вариант 3: POST с JSON body
    if (!code) {
      console.log('3️⃣ Вариант 3: POST с JSON body...\n');
      
      const response3 = await fetch(`${SLID_BASE}/apiV3/application/getCode`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          appId: APP_ID,
          secret: APP_SECRET
        })
      });

      console.log(`   Статус: ${response3.status} ${response3.statusText}`);
      const data3 = await response3.json();
      console.log(`   Ответ:`, JSON.stringify(data3, null, 2));
      
      if (data3.desc && data3.desc.code) {
        code = data3.desc.code;
        console.log(`   ✅ Код получен: ${code}\n`);
      } else if (data3.code) {
        code = data3.code;
        console.log(`   ✅ Код получен: ${code}\n`);
      }
    }

    if (!code) {
      console.log('❌ Не удалось получить код. Проверьте credentials.\n');
      return;
    }

    // Получаем токен приложения
    console.log('4️⃣ Получаю токен приложения...\n');
    
    const getTokenUrl = `${SLID_BASE}/apiV3/application/getToken?appId=${APP_ID}&secret=${APP_SECRET}&code=${code}`;
    console.log(`   URL: ${getTokenUrl.replace(APP_SECRET, '***').replace(code, '***')}\n`);
    
    const tokenResponse = await fetch(getTokenUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    console.log(`   Статус: ${tokenResponse.status} ${tokenResponse.statusText}`);
    const tokenData = await tokenResponse.json();
    console.log(`   Ответ:`, JSON.stringify(tokenData, null, 2));
    
    if (!tokenData.slid_token) {
      console.log('❌ Не удалось получить slid_token.\n');
      return;
    }

    const slidToken = tokenData.slid_token;
    console.log(`   ✅ slid_token получен: ${slidToken.substring(0, 20)}...\n`);

    // Авторизация пользователя
    console.log('5️⃣ Авторизую пользователя...\n');
    
    const loginResponse = await fetch(`${SLID_BASE}/apiV3/user/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${slidToken}`
      },
      body: JSON.stringify({
        login: USER_EMAIL,
        password: USER_PASSWORD
      })
    });

    console.log(`   Статус: ${loginResponse.status} ${loginResponse.statusText}`);
    const loginData = await loginResponse.json();
    console.log(`   Ответ:`, JSON.stringify(loginData, null, 2));
    
    if (!loginData.user_token) {
      console.log('❌ Не удалось получить user_token.\n');
      return;
    }

    const userToken = loginData.user_token;
    console.log(`   ✅ user_token получен: ${userToken.substring(0, 20)}...\n`);

    // Получаем WebAPI токен
    console.log('6️⃣ Получаю WebAPI токен...\n');
    
    const webApiResponse = await fetch(`${WEBAPI_BASE}/json/v2/auth.slid`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        slid_token: userToken
      })
    });

    console.log(`   Статус: ${webApiResponse.status} ${webApiResponse.statusText}`);
    const webApiData = await webApiResponse.json();
    console.log(`   Ответ:`, JSON.stringify(webApiData, null, 2));
    
    const slnetToken = webApiData.slnet_token || webApiData.token || webApiData.access_token;
    
    if (!slnetToken) {
      console.log('❌ Не удалось получить slnet_token.\n');
      return;
    }

    console.log(`   ✅ slnet_token получен: ${slnetToken.substring(0, 20)}...\n`);

    // Тестируем запросы
    console.log('7️⃣ Тестирую запрос к API...\n');
    
    const devicesResponse = await fetch(`${WEBAPI_BASE}/json/v1/devices`, {
      method: 'GET',
      headers: {
        'Cookie': `slnet_token=${slnetToken}`,
        'Content-Type': 'application/json'
      }
    });

    console.log(`   Статус: ${devicesResponse.status} ${devicesResponse.statusText}`);
    const devicesData = await devicesResponse.json();
    console.log(`   ✅ Устройства получены:`, JSON.stringify(devicesData, null, 2).substring(0, 1000));
    
    console.log('\n✅ Все тесты пройдены успешно!\n');

  } catch (error) {
    console.error('\n❌ Ошибка при тестировании:');
    console.error(error.message);
    if (error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }
  }
}

testFinal();

