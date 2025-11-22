#!/usr/bin/env node
/**
 * Тестирование прямого доступа к Starline WebAPI
 * Возможно, appId и secret можно использовать напрямую
 */

const APP_ID = '40884';
const APP_SECRET = '55t6wDYPs800o3UCRfjd_kW27f2eI1fL';
const USER_EMAIL = '33pokrov33@gmail.com';
const USER_PASSWORD = '7733Alex';

const WEBAPI_BASE = 'https://developer.starline.ru';

async function testDirectAccess() {
  console.log('🧪 Тестирование прямого доступа к Starline WebAPI...\n');

  try {
    // Вариант 1: Прямая авторизация в WebAPI с appId и secret
    console.log('1️⃣ Пробую прямую авторизацию в WebAPI...\n');
    
    const directAuthResponse = await fetch(`${WEBAPI_BASE}/json/v1/auth`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        appId: APP_ID,
        appSecret: APP_SECRET
      })
    });

    console.log(`   Статус: ${directAuthResponse.status} ${directAuthResponse.statusText}`);
    
    if (directAuthResponse.ok) {
      const authData = await directAuthResponse.json();
      console.log(`   ✅ Авторизация успешна:`, JSON.stringify(authData, null, 2));
      
      const token = authData.token || authData.access_token || authData.slnet_token;
      if (token) {
        await testWithToken(token);
        return;
      }
    } else {
      const errorText = await directAuthResponse.text();
      console.log(`   ❌ Ошибка: ${errorText.substring(0, 300)}`);
    }

    // Вариант 2: Авторизация с email и password
    console.log('\n2️⃣ Пробую авторизацию с email и password...\n');
    
    const emailAuthResponse = await fetch(`${WEBAPI_BASE}/json/v1/auth`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        login: USER_EMAIL,
        password: USER_PASSWORD
      })
    });

    console.log(`   Статус: ${emailAuthResponse.status} ${emailAuthResponse.statusText}`);
    
    if (emailAuthResponse.ok) {
      const authData = await emailAuthResponse.json();
      console.log(`   ✅ Авторизация успешна:`, JSON.stringify(authData, null, 2));
      
      const token = authData.token || authData.access_token || authData.slnet_token;
      if (token) {
        await testWithToken(token);
        return;
      }
    } else {
      const errorText = await emailAuthResponse.text();
      console.log(`   ❌ Ошибка: ${errorText.substring(0, 300)}`);
    }

    // Вариант 3: Использование appId и secret в заголовках
    console.log('\n3️⃣ Пробую с appId и secret в заголовках...\n');
    
    const headerAuthResponse = await fetch(`${WEBAPI_BASE}/json/v1/devices`, {
      method: 'GET',
      headers: {
        'X-AppId': APP_ID,
        'X-AppSecret': APP_SECRET,
        'Content-Type': 'application/json'
      }
    });

    console.log(`   Статус: ${headerAuthResponse.status} ${headerAuthResponse.statusText}`);
    
    if (headerAuthResponse.ok) {
      const devicesData = await headerAuthResponse.json();
      console.log(`   ✅ Устройства получены:`, JSON.stringify(devicesData, null, 2).substring(0, 1000));
      return;
    } else {
      const errorText = await headerAuthResponse.text();
      console.log(`   ❌ Ошибка: ${errorText.substring(0, 300)}`);
    }

    console.log('\n❌ Все варианты не сработали. Проверьте credentials.\n');

  } catch (error) {
    console.error('\n❌ Ошибка при тестировании:');
    console.error(error.message);
    if (error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }
  }
}

async function testWithToken(token) {
  console.log(`\n4️⃣ Тестирую запросы с токеном...\n`);
  
  const devicesResponse = await fetch(`${WEBAPI_BASE}/json/v1/devices`, {
    method: 'GET',
    headers: {
      'Cookie': `slnet_token=${token}`,
      'Content-Type': 'application/json'
    }
  });

  console.log(`   Статус: ${devicesResponse.status} ${devicesResponse.statusText}`);
  
  if (devicesResponse.ok) {
    const devicesData = await devicesResponse.json();
    console.log(`   ✅ Устройства получены:`, JSON.stringify(devicesData, null, 2).substring(0, 1000));
  } else {
    const errorText = await devicesResponse.text();
    console.log(`   ❌ Ошибка: ${errorText.substring(0, 300)}`);
  }
}

testDirectAccess();

