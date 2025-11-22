#!/usr/bin/env node
/**
 * Тестирование правильного endpoint для получения устройств
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
  // Полный процесс авторизации
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

  const webApiResponse = await fetch(`${WEBAPI_BASE}/json/v2/auth.slid`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ slid_token: slidToken })
  });
  const cookies = webApiResponse.headers.get('set-cookie');
  const slnetMatch = cookies.match(/slnet=([^;]+)/);
  return slnetMatch[1];
}

async function testDevicesEndpoints() {
  console.log('🧪 Тестирование endpoints для получения устройств...\n');

  try {
    const slnetToken = await getSlnetToken();
    console.log(`✅ Токен получен: ${slnetToken.substring(0, 20)}...\n`);

    const endpoints = [
      '/json/v1/devices',
      '/json/v2/devices',
      '/json/v3/devices',
      '/json/v1/user/devices',
      '/json/v2/user/devices',
    ];

    for (const endpoint of endpoints) {
      console.log(`Пробую: ${endpoint}`);
      try {
        const response = await fetch(`${WEBAPI_BASE}${endpoint}`, {
          method: 'GET',
          headers: {
            'Cookie': `slnet=${slnetToken}`,
            'Content-Type': 'application/json'
          }
        });

        const data = await response.json();
        console.log(`   Статус: ${response.status}`);
        console.log(`   Ответ:`, JSON.stringify(data, null, 2).substring(0, 500));
        
        if (data.devices || Array.isArray(data)) {
          console.log(`   ✅ РАБОТАЕТ! Найдено устройств: ${data.devices?.length || data.length}\n`);
          return endpoint;
        }
      } catch (error) {
        console.log(`   ❌ Ошибка: ${error.message}\n`);
      }
    }

    console.log('❌ Не удалось найти рабочий endpoint\n');

  } catch (error) {
    console.error('❌ Ошибка:', error.message);
  }
}

testDevicesEndpoints();

