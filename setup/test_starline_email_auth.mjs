#!/usr/bin/env node
/**
 * Тестирование авторизации Starline через email/password напрямую
 */

const USER_EMAIL = '33pokrov33@gmail.com';
const USER_PASSWORD = '7733Alex';
const APP_ID = '40884';
const APP_SECRET = '55t6wDYPs800o3UCRfjd_kW27f2eI1fL';

const SLID_BASE = 'https://id.starline.ru';
const WEBAPI_BASE = 'https://developer.starline.ru';

async function testEmailAuth() {
  console.log('🧪 Тестирование авторизации через email/password...\n');

  try {
    // Вариант 1: Прямая авторизация пользователя в SLID без app token
    console.log('1️⃣ Пробую прямую авторизацию пользователя в SLID...\n');
    
    const directLoginResponse = await fetch(`${SLID_BASE}/apiV3/user/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        login: USER_EMAIL,
        password: USER_PASSWORD
      })
    });

    console.log(`   Статус: ${directLoginResponse.status} ${directLoginResponse.statusText}`);
    const directLoginData = await directLoginResponse.json();
    console.log(`   Ответ:`, JSON.stringify(directLoginData, null, 2));
    
    if (directLoginData.user_token) {
      console.log(`   ✅ user_token получен напрямую!\n`);
      await continueWithUserToken(directLoginData.user_token);
      return;
    }

    // Вариант 2: Авторизация в WebAPI напрямую с email/password
    console.log('\n2️⃣ Пробую авторизацию в WebAPI напрямую...\n');
    
    const webApiDirectResponse = await fetch(`${WEBAPI_BASE}/json/v1/auth`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        login: USER_EMAIL,
        password: USER_PASSWORD
      })
    });

    console.log(`   Статус: ${webApiDirectResponse.status} ${webApiDirectResponse.statusText}`);
    const webApiDirectData = await webApiDirectResponse.json();
    console.log(`   Ответ:`, JSON.stringify(webApiDirectData, null, 2));
    
    if (webApiDirectData.slnet_token || webApiDirectData.token) {
      const token = webApiDirectData.slnet_token || webApiDirectData.token;
      console.log(`   ✅ Токен получен напрямую: ${token.substring(0, 20)}...\n`);
      await testWithToken(token);
      return;
    }

    // Вариант 3: Проверяем, может быть appId/secret нужно использовать по-другому
    console.log('\n3️⃣ Пробую разные варианты getCode...\n');
    
    // Вариант 3.1: с заглавной S
    const variants = [
      { param: 'secret', value: APP_SECRET },
      { param: 'Secret', value: APP_SECRET },
      { param: 'appSecret', value: APP_SECRET },
      { param: 'AppSecret', value: APP_SECRET },
    ];

    for (const variant of variants) {
      const url = `${SLID_BASE}/apiV3/application/getCode?appId=${APP_ID}&${variant.param}=${variant.value}`;
      console.log(`   Пробую: ${variant.param}`);
      
      try {
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          }
        });

        const data = await response.json();
        console.log(`      Статус: ${response.status}, Ответ:`, JSON.stringify(data, null, 2).substring(0, 200));
        
        if (data.desc && data.desc.code) {
          console.log(`   ✅ Код получен с параметром ${variant.param}!\n`);
          await continueWithCode(data.desc.code);
          return;
        }
      } catch (error) {
        console.log(`      Ошибка: ${error.message}`);
      }
    }

    console.log('\n❌ Все варианты не сработали.\n');
    console.log('💡 Рекомендации:');
    console.log('   1. Проверьте appId и secret в личном кабинете my.starline.ru');
    console.log('   2. Убедитесь, что заявка на доступ к API одобрена');
    console.log('   3. Возможно, нужно использовать другой формат credentials\n');

  } catch (error) {
    console.error('\n❌ Ошибка при тестировании:');
    console.error(error.message);
    if (error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }
  }
}

async function continueWithCode(code) {
  console.log(`\n4️⃣ Продолжаю с кодом: ${code}...\n`);
  
  const getTokenUrl = `${SLID_BASE}/apiV3/application/getToken?appId=${APP_ID}&secret=${APP_SECRET}&code=${code}`;
  const tokenResponse = await fetch(getTokenUrl, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json'
    }
  });

  const tokenData = await tokenResponse.json();
  console.log(`   Токен приложения:`, JSON.stringify(tokenData, null, 2));
  
  if (tokenData.slid_token) {
    await continueWithSlidToken(tokenData.slid_token);
  }
}

async function continueWithSlidToken(slidToken) {
  console.log(`\n5️⃣ Авторизую пользователя с slid_token...\n`);
  
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

  const loginData = await loginResponse.json();
  console.log(`   Ответ:`, JSON.stringify(loginData, null, 2));
  
  if (loginData.user_token) {
    await continueWithUserToken(loginData.user_token);
  }
}

async function continueWithUserToken(userToken) {
  console.log(`\n6️⃣ Получаю WebAPI токен...\n`);
  
  const webApiResponse = await fetch(`${WEBAPI_BASE}/json/v2/auth.slid`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      slid_token: userToken
    })
  });

  const webApiData = await webApiResponse.json();
  console.log(`   Ответ:`, JSON.stringify(webApiData, null, 2));
  
  const slnetToken = webApiData.slnet_token || webApiData.token;
  if (slnetToken) {
    await testWithToken(slnetToken);
  }
}

async function testWithToken(token) {
  console.log(`\n7️⃣ Тестирую запрос к API...\n`);
  
  const devicesResponse = await fetch(`${WEBAPI_BASE}/json/v1/devices`, {
    method: 'GET',
    headers: {
      'Cookie': `slnet_token=${token}`,
      'Content-Type': 'application/json'
    }
  });

  const devicesData = await devicesResponse.json();
  console.log(`   ✅ Устройства:`, JSON.stringify(devicesData, null, 2).substring(0, 1000));
}

testEmailAuth();

