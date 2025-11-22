#!/usr/bin/env node
/**
 * Полное тестирование авторизации Starline API с реальными credentials
 */

const APP_ID = '40884';
const APP_SECRET = '55t6wDYPs800o3UCRfjd_kW27f2eI1fL';
const USER_EMAIL = '33pokrov33@gmail.com';
const USER_PASSWORD = '7733Alex';

const API_BASE = 'https://developer.starline.ru';

async function testFullAuth() {
  console.log('🧪 Полное тестирование авторизации Starline API...\n');

  try {
    // Шаг 1: Получение кода приложения (getCode)
    console.log('1️⃣ Получаю код приложения (getCode)...\n');
    
    const getCodeResponse = await fetch(`${API_BASE}/apiV3/application/getCode`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        appId: APP_ID,
        appSecret: APP_SECRET
      })
    });

    console.log(`   Статус: ${getCodeResponse.status} ${getCodeResponse.statusText}`);
    
    if (!getCodeResponse.ok) {
      const errorText = await getCodeResponse.text();
      console.log(`   ❌ Ошибка: ${errorText.substring(0, 300)}`);
      
      // Пробуем GET вместо POST
      console.log('\n   Пробую GET метод...\n');
      const getCodeResponseGET = await fetch(`${API_BASE}/apiV3/application/getCode?appId=${APP_ID}&appSecret=${APP_SECRET}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      console.log(`   Статус GET: ${getCodeResponseGET.status} ${getCodeResponseGET.statusText}`);
      if (getCodeResponseGET.ok) {
        const codeData = await getCodeResponseGET.json();
        console.log(`   ✅ Код получен (GET):`, JSON.stringify(codeData, null, 2));
        return await continueWithCode(codeData.code);
      }
      
      throw new Error(`Failed to get code: ${getCodeResponse.status}`);
    }

    const codeData = await getCodeResponse.json();
    console.log(`   ✅ Код получен:`, JSON.stringify(codeData, null, 2));
    
    if (!codeData.code) {
      throw new Error(`No code in response: ${JSON.stringify(codeData)}`);
    }

    // Шаг 2: Получение токена приложения (getToken)
    console.log('\n2️⃣ Получаю токен приложения (getToken)...\n');
    
    const getTokenResponse = await fetch(`${API_BASE}/apiV3/application/getToken`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        appId: APP_ID,
        appSecret: APP_SECRET,
        code: codeData.code
      })
    });

    console.log(`   Статус: ${getTokenResponse.status} ${getTokenResponse.statusText}`);
    
    if (!getTokenResponse.ok) {
      const errorText = await getTokenResponse.text();
      console.log(`   ❌ Ошибка: ${errorText.substring(0, 300)}`);
      throw new Error(`Failed to get app token: ${getTokenResponse.status}`);
    }

    const appTokenData = await getTokenResponse.json();
    console.log(`   ✅ Токен приложения получен:`, JSON.stringify(appTokenData, null, 2));
    
    if (!appTokenData.slid_token) {
      throw new Error(`No slid_token in response: ${JSON.stringify(appTokenData)}`);
    }

    const slidToken = appTokenData.slid_token;

    // Шаг 3: Авторизация пользователя в SLID
    console.log('\n3️⃣ Авторизую пользователя в SLID...\n');
    
    const userLoginResponse = await fetch(`${API_BASE}/apiV3/user/login`, {
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

    console.log(`   Статус: ${userLoginResponse.status} ${userLoginResponse.statusText}`);
    
    if (!userLoginResponse.ok) {
      const errorText = await userLoginResponse.text();
      console.log(`   ❌ Ошибка: ${errorText.substring(0, 300)}`);
      throw new Error(`Failed to login user: ${userLoginResponse.status}`);
    }

    const userLoginData = await userLoginResponse.json();
    console.log(`   ✅ Пользователь авторизован:`, JSON.stringify(userLoginData, null, 2));
    
    if (!userLoginData.user_token) {
      throw new Error(`No user_token in response: ${JSON.stringify(userLoginData)}`);
    }

    const userToken = userLoginData.user_token;

    // Шаг 4: Авторизация в WebAPI (получение slnet_token)
    console.log('\n4️⃣ Авторизуюсь в WebAPI (получение slnet_token)...\n');
    
    const webApiAuthResponse = await fetch(`${API_BASE}/json/v2/auth.slid`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        slid_token: userToken
      })
    });

    console.log(`   Статус: ${webApiAuthResponse.status} ${webApiAuthResponse.statusText}`);
    
    if (!webApiAuthResponse.ok) {
      const errorText = await webApiAuthResponse.text();
      console.log(`   ❌ Ошибка: ${errorText.substring(0, 300)}`);
      throw new Error(`Failed to auth in WebAPI: ${webApiAuthResponse.status}`);
    }

    const webApiAuthData = await webApiAuthResponse.json();
    console.log(`   ✅ Авторизация в WebAPI успешна:`, JSON.stringify(webApiAuthData, null, 2));
    
    // Проверяем разные возможные поля для токена
    const slnetToken = webApiAuthData.slnet_token || webApiAuthData.token || webApiAuthData.access_token;
    
    if (!slnetToken) {
      console.log(`   ⚠️  Не найден slnet_token, пробую использовать user_token напрямую...`);
      // Пробуем использовать user_token напрямую
      await testWithToken(userToken);
      return;
    }

    console.log(`\n   🎯 Получен slnet_token: ${slnetToken.substring(0, 20)}...\n`);

    // Шаг 5: Тестирование запросов с полученным токеном
    await testWithToken(slnetToken);

  } catch (error) {
    console.error('\n❌ Ошибка при тестировании:');
    console.error(error.message);
    if (error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }
    process.exit(1);
  }
}

async function continueWithCode(code) {
  console.log(`\n2️⃣ Продолжаю с кодом: ${code}...\n`);
  
  const getTokenResponse = await fetch(`${API_BASE}/apiV3/application/getToken`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      appId: APP_ID,
      appSecret: APP_SECRET,
      code: code
    })
  });

  if (!getTokenResponse.ok) {
    throw new Error(`Failed to get app token: ${getTokenResponse.status}`);
  }

  const appTokenData = await getTokenResponse.json();
  console.log(`   ✅ Токен приложения:`, JSON.stringify(appTokenData, null, 2));
  
  if (appTokenData.slid_token) {
    // Продолжаем с авторизацией пользователя
    const userLoginResponse = await fetch(`${API_BASE}/apiV3/user/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${appTokenData.slid_token}`
      },
      body: JSON.stringify({
        login: USER_EMAIL,
        password: USER_PASSWORD
      })
    });

    if (userLoginResponse.ok) {
      const userLoginData = await userLoginResponse.json();
      if (userLoginData.user_token) {
        await testWithToken(userLoginData.user_token);
      }
    }
  }
}

async function testWithToken(token) {
  console.log(`\n5️⃣ Тестирую запросы с токеном...\n`);
  
  // Тест 1: Получение списка устройств
  console.log('   📱 Получаю список устройств...\n');
  
  const devicesResponse = await fetch(`${API_BASE}/json/v1/devices`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });

  console.log(`   Статус: ${devicesResponse.status} ${devicesResponse.statusText}`);
  
  if (!devicesResponse.ok) {
    const errorText = await devicesResponse.text();
    console.log(`   ❌ Ошибка: ${errorText.substring(0, 300)}`);
    
    // Пробуем с cookie вместо Bearer
    console.log('\n   Пробую с cookie...\n');
    const devicesResponseCookie = await fetch(`${API_BASE}/json/v1/devices`, {
      method: 'GET',
      headers: {
        'Cookie': `slnet_token=${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log(`   Статус (cookie): ${devicesResponseCookie.status} ${devicesResponseCookie.statusText}`);
    if (devicesResponseCookie.ok) {
      const devicesData = await devicesResponseCookie.json();
      console.log(`   ✅ Устройства получены (cookie):`, JSON.stringify(devicesData, null, 2).substring(0, 1000));
      return;
    }
  } else {
    const devicesData = await devicesResponse.json();
    console.log(`   ✅ Устройства получены:`, JSON.stringify(devicesData, null, 2).substring(0, 1000));
    
    // Тест 2: Получение данных первого устройства
    if (devicesData.devices && devicesData.devices.length > 0) {
      const deviceId = devicesData.devices[0].device_id || devicesData.devices[0].id;
      console.log(`\n   📊 Получаю данные устройства ${deviceId}...\n`);
      
      const deviceDataResponse = await fetch(`${API_BASE}/json/v1/device/${deviceId}/data`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      console.log(`   Статус: ${deviceDataResponse.status} ${deviceDataResponse.statusText}`);
      
      if (deviceDataResponse.ok) {
        const deviceData = await deviceDataResponse.json();
        console.log(`   ✅ Данные устройства получены:`, JSON.stringify(deviceData, null, 2).substring(0, 1000));
      } else {
        const errorText = await deviceDataResponse.text();
        console.log(`   ❌ Ошибка: ${errorText.substring(0, 300)}`);
      }
    }
  }
  
  console.log('\n✅ Тестирование завершено!\n');
}

testFullAuth();

