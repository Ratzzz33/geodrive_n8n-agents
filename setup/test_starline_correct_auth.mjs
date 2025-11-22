#!/usr/bin/env node
/**
 * Правильное тестирование авторизации Starline API
 * Используем id.starline.ru для SLID и developer.starline.ru для WebAPI
 */

const APP_ID = '40884';
const APP_SECRET = '55t6wDYPs800o3UCRfjd_kW27f2eI1fL';
const USER_EMAIL = '33pokrov33@gmail.com';
const USER_PASSWORD = '7733Alex';

const SLID_BASE = 'https://id.starline.ru';
const WEBAPI_BASE = 'https://developer.starline.ru';

async function testCorrectAuth() {
  console.log('🧪 Правильное тестирование авторизации Starline API...\n');

  try {
    // Шаг 1: Получение кода приложения (GET с query параметрами)
    console.log('1️⃣ Получаю код приложения (getCode)...\n');
    
    const getCodeUrl = `${SLID_BASE}/apiV3/application/getCode?appId=${APP_ID}&secret=${APP_SECRET}`;
    console.log(`   URL: ${getCodeUrl}\n`);
    
    const getCodeResponse = await fetch(getCodeUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    console.log(`   Статус: ${getCodeResponse.status} ${getCodeResponse.statusText}`);
    
    if (!getCodeResponse.ok) {
      const errorText = await getCodeResponse.text();
      console.log(`   ❌ Ошибка: ${errorText.substring(0, 300)}`);
      throw new Error(`Failed to get code: ${getCodeResponse.status}`);
    }

    const codeData = await getCodeResponse.json();
    console.log(`   ✅ Код получен:`, JSON.stringify(codeData, null, 2));
    
    if (!codeData.code && !codeData.desc?.code) {
      throw new Error(`No code in response: ${JSON.stringify(codeData)}`);
    }

    const code = codeData.code || codeData.desc?.code;

    // Шаг 2: Получение токена приложения (GET с query параметрами)
    console.log('\n2️⃣ Получаю токен приложения (getToken)...\n');
    
    const getTokenUrl = `${SLID_BASE}/apiV3/application/getToken?appId=${APP_ID}&secret=${APP_SECRET}&code=${code}`;
    console.log(`   URL: ${getTokenUrl.replace(APP_SECRET, '***')}\n`);
    
    const getTokenResponse = await fetch(getTokenUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
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
    console.log(`   🎯 slid_token: ${slidToken.substring(0, 20)}...\n`);

    // Шаг 3: Авторизация пользователя в SLID
    console.log('3️⃣ Авторизую пользователя в SLID...\n');
    
    const userLoginUrl = `${SLID_BASE}/apiV3/user/login`;
    console.log(`   URL: ${userLoginUrl}\n`);
    
    const userLoginResponse = await fetch(userLoginUrl, {
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
    console.log(`   🎯 user_token: ${userToken.substring(0, 20)}...\n`);

    // Шаг 4: Авторизация в WebAPI (получение slnet_token)
    console.log('4️⃣ Авторизуюсь в WebAPI (получение slnet_token)...\n');
    
    const webApiAuthUrl = `${WEBAPI_BASE}/json/v2/auth.slid`;
    console.log(`   URL: ${webApiAuthUrl}\n`);
    
    const webApiAuthResponse = await fetch(webApiAuthUrl, {
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

async function testWithToken(token) {
  console.log(`5️⃣ Тестирую запросы с токеном...\n`);
  
  // Тест 1: Получение списка устройств (с cookie)
  console.log('   📱 Получаю список устройств (с cookie slnet_token)...\n');
  
  const devicesResponse = await fetch(`${WEBAPI_BASE}/json/v1/devices`, {
    method: 'GET',
    headers: {
      'Cookie': `slnet_token=${token}`,
      'Content-Type': 'application/json'
    }
  });

  console.log(`   Статус: ${devicesResponse.status} ${devicesResponse.statusText}`);
  
  if (!devicesResponse.ok) {
    const errorText = await devicesResponse.text();
    console.log(`   ❌ Ошибка: ${errorText.substring(0, 300)}`);
    
    // Пробуем с Bearer токеном
    console.log('\n   Пробую с Bearer токеном...\n');
    const devicesResponseBearer = await fetch(`${WEBAPI_BASE}/json/v1/devices`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log(`   Статус (Bearer): ${devicesResponseBearer.status} ${devicesResponseBearer.statusText}`);
    if (devicesResponseBearer.ok) {
      const devicesData = await devicesResponseBearer.json();
      console.log(`   ✅ Устройства получены (Bearer):`, JSON.stringify(devicesData, null, 2).substring(0, 1000));
      await testDeviceData(token, devicesData);
      return;
    }
  } else {
    const devicesData = await devicesResponse.json();
    console.log(`   ✅ Устройства получены (cookie):`, JSON.stringify(devicesData, null, 2).substring(0, 1000));
    await testDeviceData(token, devicesData);
  }
  
  console.log('\n✅ Тестирование завершено!\n');
}

async function testDeviceData(token, devicesData) {
  // Определяем структуру ответа
  let devices = [];
  if (Array.isArray(devicesData)) {
    devices = devicesData;
  } else if (devicesData.devices && Array.isArray(devicesData.devices)) {
    devices = devicesData.devices;
  } else if (devicesData.data && Array.isArray(devicesData.data)) {
    devices = devicesData.data;
  }

  if (devices.length > 0) {
    const deviceId = devices[0].device_id || devices[0].id;
    console.log(`\n   📊 Получаю данные устройства ${deviceId}...\n`);
    
    const deviceDataResponse = await fetch(`${WEBAPI_BASE}/json/v1/device/${deviceId}/data`, {
      method: 'GET',
      headers: {
        'Cookie': `slnet_token=${token}`,
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

testCorrectAuth();

