#!/usr/bin/env node
/**
 * Правильное тестирование авторизации Starline API
 * Согласно официальным скриптам из GitLab
 */

import crypto from 'crypto';

const APP_ID = '40884';
const APP_SECRET = '55t6wDYPs800o3UCRfjd_kW27f2eI1fL';
const USER_EMAIL = '33pokrov33@gmail.com';
const USER_PASSWORD = '7733Alex';

const SLID_BASE = 'https://id.starline.ru';
const WEBAPI_BASE = 'https://developer.starline.ru';

function md5(text) {
  return crypto.createHash('md5').update(text).digest('hex');
}

function sha1(text) {
  return crypto.createHash('sha1').update(text).digest('hex');
}

async function testCorrectAuth() {
  console.log('🧪 Правильное тестирование авторизации Starline API...\n');
  console.log('📚 Используя официальные скрипты из GitLab\n');

  try {
    // Шаг 1: Получение кода приложения
    console.log('1️⃣ Получаю код приложения (getCode)...\n');
    console.log('   URL: https://id.starline.ru/apiV3/application/getCode/\n');
    console.log('   ⚠️  ВАЖНО: secret = MD5(app_secret)\n');
    
    const secretHash = md5(APP_SECRET);
    const getCodeUrl = `${SLID_BASE}/apiV3/application/getCode/?appId=${APP_ID}&secret=${secretHash}`;
    console.log(`   Запрос: GET ${getCodeUrl.replace(secretHash, '***')}\n`);
    
    const getCodeResponse = await fetch(getCodeUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    console.log(`   Статус: ${getCodeResponse.status} ${getCodeResponse.statusText}`);
    const codeData = await getCodeResponse.json();
    console.log(`   Ответ:`, JSON.stringify(codeData, null, 2));
    
    if (codeData.state !== 1) {
      throw new Error(`Ошибка получения кода: ${JSON.stringify(codeData)}`);
    }

    const appCode = codeData.desc.code;
    console.log(`   ✅ Код получен: ${appCode}\n`);

    // Шаг 2: Получение токена приложения
    console.log('2️⃣ Получаю токен приложения (getToken)...\n');
    console.log('   URL: https://id.starline.ru/apiV3/application/getToken/\n');
    console.log('   ⚠️  ВАЖНО: secret = MD5(app_secret + app_code)\n');
    
    const tokenSecretHash = md5(APP_SECRET + appCode);
    const getTokenUrl = `${SLID_BASE}/apiV3/application/getToken/?appId=${APP_ID}&secret=${tokenSecretHash}`;
    console.log(`   Запрос: GET ${getTokenUrl.replace(tokenSecretHash, '***')}\n`);
    
    const getTokenResponse = await fetch(getTokenUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    console.log(`   Статус: ${getTokenResponse.status} ${getTokenResponse.statusText}`);
    const tokenData = await getTokenResponse.json();
    console.log(`   Ответ:`, JSON.stringify(tokenData, null, 2));
    
    if (tokenData.state !== 1) {
      throw new Error(`Ошибка получения токена: ${JSON.stringify(tokenData)}`);
    }

    const appToken = tokenData.desc.token;
    console.log(`   ✅ Токен приложения получен: ${appToken.substring(0, 20)}...\n`);

    // Шаг 3: Авторизация пользователя
    console.log('3️⃣ Авторизую пользователя (login)...\n');
    console.log('   URL: https://id.starline.ru/apiV3/user/login/\n');
    console.log('   ⚠️  ВАЖНО: pass = SHA1(password), используется form-data, не JSON!\n');
    
    const passwordHash = sha1(USER_PASSWORD);
    const loginUrl = `${SLID_BASE}/apiV3/user/login/?token=${appToken}`;
    
    // Используем form-data (URLSearchParams)
    const formData = new URLSearchParams();
    formData.append('login', USER_EMAIL);
    formData.append('pass', passwordHash);
    
    console.log(`   Запрос: POST ${loginUrl.replace(appToken, '***')}\n`);
    console.log(`   Body (form-data): login=${USER_EMAIL}, pass=${passwordHash.substring(0, 10)}...\n`);
    
    const loginResponse = await fetch(loginUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: formData.toString()
    });

    console.log(`   Статус: ${loginResponse.status} ${loginResponse.statusText}`);
    const loginData = await loginResponse.json();
    console.log(`   Ответ:`, JSON.stringify(loginData, null, 2));
    
    if (loginData.state !== 1) {
      throw new Error(`Ошибка авторизации пользователя: ${JSON.stringify(loginData)}`);
    }

    const slidToken = loginData.desc.user_token;
    console.log(`   ✅ user_token получен: ${slidToken.substring(0, 20)}...\n`);

    // Шаг 4: Получение WebAPI токена
    console.log('4️⃣ Получаю WebAPI токен (auth.slid)...\n');
    console.log('   URL: https://developer.starline.ru/json/v2/auth.slid\n');
    console.log('   ⚠️  ВАЖНО: токен возвращается в cookie "slnet", не в JSON!\n');
    
    const webApiResponse = await fetch(`${WEBAPI_BASE}/json/v2/auth.slid`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        slid_token: slidToken
      })
    });

    console.log(`   Статус: ${webApiResponse.status} ${webApiResponse.statusText}`);
    
    // Получаем cookie из заголовков
    const cookies = webApiResponse.headers.get('set-cookie');
    console.log(`   Cookies: ${cookies}`);
    
    const webApiData = await webApiResponse.json();
    console.log(`   JSON ответ:`, JSON.stringify(webApiData, null, 2));
    
    // Извлекаем slnet токен из cookie
    let slnetToken = null;
    if (cookies) {
      const slnetMatch = cookies.match(/slnet=([^;]+)/);
      if (slnetMatch) {
        slnetToken = slnetMatch[1];
        console.log(`   ✅ slnet_token из cookie: ${slnetToken.substring(0, 20)}...\n`);
      }
    }
    
    if (!slnetToken) {
      throw new Error('slnet токен не найден в cookie');
    }

    // Шаг 5: Тестирование запросов
    console.log('5️⃣ Тестирую запрос к API...\n');
    
    const devicesResponse = await fetch(`${WEBAPI_BASE}/json/v1/devices`, {
      method: 'GET',
      headers: {
        'Cookie': `slnet=${slnetToken}`,
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
    process.exit(1);
  }
}

testCorrectAuth();

