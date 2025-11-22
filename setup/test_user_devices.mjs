#!/usr/bin/env node
/**
 * Тестирование получения устройств через user_id
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

async function getSlnetToken() {
  const secretHash1 = md5(APP_SECRET);
  const codeResponse = await fetch(`${SLID_BASE}/apiV3/application/getCode/?appId=${APP_ID}&secret=${secretHash1}`);
  const codeData = await codeResponse.json();
  const appCode = codeData.desc.code;

  const secretHash2 = md5(APP_SECRET + appCode);
  const tokenResponse = await fetch(`${SLID_BASE}/apiV3/application/getToken/?appId=${APP_ID}&secret=${secretHash2}`);
  const tokenData = await tokenResponse.json();
  const appToken = tokenData.desc.token;

  const passwordHash = sha1(USER_PASSWORD);
  const formData = new URLSearchParams();
  formData.append('login', USER_EMAIL);
  formData.append('pass', passwordHash);
  const loginResponse = await fetch(`${SLID_BASE}/apiV3/user/login/?token=${appToken}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: formData.toString()
  });
  const loginData = await loginResponse.json();
  const slidToken = loginData.desc.user_token;
  const userId = loginData.desc.id;

  const webApiResponse = await fetch(`${WEBAPI_BASE}/json/v2/auth.slid`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ slid_token: slidToken })
  });
  const cookies = webApiResponse.headers.get('set-cookie');
  const slnetMatch = cookies.match(/slnet=([^;]+)/);
  
  return { slnetToken: slnetMatch[1], userId };
}

async function testUserDevices() {
  console.log('🧪 Тестирование получения устройств через user_id...\n');

  try {
    const { slnetToken, userId } = await getSlnetToken();
    console.log(`✅ Токен получен: ${slnetToken.substring(0, 20)}...`);
    console.log(`✅ User ID: ${userId}\n`);

    // Вариант 1: /json/v1/user/{user_id}/devices
    console.log('1️⃣ Пробую: /json/v1/user/{user_id}/devices\n');
    try {
      const response1 = await fetch(`${WEBAPI_BASE}/json/v1/user/${userId}/devices`, {
        method: 'GET',
        headers: {
          'Cookie': `slnet=${slnetToken}`,
          'Content-Type': 'application/json'
        }
      });

      const data1 = await response1.json();
      console.log(`   Статус: ${response1.status}`);
      console.log(`   Ответ:`, JSON.stringify(data1, null, 2).substring(0, 1000));
      
      if (data1.devices || Array.isArray(data1)) {
        console.log(`   ✅ РАБОТАЕТ!\n`);
        return;
      }
    } catch (error) {
      console.log(`   ❌ Ошибка: ${error.message}\n`);
    }

    // Вариант 2: /json/v2/user/{user_id}/devices
    console.log('2️⃣ Пробую: /json/v2/user/{user_id}/devices\n');
    try {
      const response2 = await fetch(`${WEBAPI_BASE}/json/v2/user/${userId}/devices`, {
        method: 'GET',
        headers: {
          'Cookie': `slnet=${slnetToken}`,
          'Content-Type': 'application/json'
        }
      });

      const data2 = await response2.json();
      console.log(`   Статус: ${response2.status}`);
      console.log(`   Ответ:`, JSON.stringify(data2, null, 2).substring(0, 1000));
      
      if (data2.devices || Array.isArray(data2)) {
        console.log(`   ✅ РАБОТАЕТ!\n`);
        return;
      }
    } catch (error) {
      console.log(`   ❌ Ошибка: ${error.message}\n`);
    }

    // Вариант 3: Проверяем user_info для получения списка устройств
    console.log('3️⃣ Пробую: /json/v2/user/{user_id}/user_info\n');
    try {
      const response3 = await fetch(`${WEBAPI_BASE}/json/v2/user/${userId}/user_info`, {
        method: 'GET',
        headers: {
          'Cookie': `slnet=${slnetToken}`,
          'Content-Type': 'application/json'
        }
      });

      const data3 = await response3.json();
      console.log(`   Статус: ${response3.status}`);
      console.log(`   Ответ:`, JSON.stringify(data3, null, 2).substring(0, 1000));
      
      if (data3.devices || data3.data) {
        console.log(`   ✅ РАБОТАЕТ!\n`);
        return;
      }
    } catch (error) {
      console.log(`   ❌ Ошибка: ${error.message}\n`);
    }

    console.log('❌ Не удалось найти рабочий endpoint\n');

  } catch (error) {
    console.error('❌ Ошибка:', error.message);
  }
}

testUserDevices();

