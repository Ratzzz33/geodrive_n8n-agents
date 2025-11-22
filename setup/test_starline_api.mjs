#!/usr/bin/env node
/**
 * Тестирование Starline API - получение токена и выполнение запросов
 */

const APP_ID = '40884';
const APP_SECRET = '55t6wDYPs800o3UCRfjd_kW27f2eI1fL';
const API_BASE = 'https://developer.starline.ru';

async function testStarlineAPI() {
  console.log('🧪 Тестирование Starline API...\n');

  try {
    // Шаг 1: Получение токена
    console.log('1️⃣ Получаю токен доступа...\n');
    
    const tokenResponse = await fetch(`${API_BASE}/oauth/v1/access_token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        appId: APP_ID,
        appSecret: APP_SECRET
      })
    });

    console.log(`   Статус: ${tokenResponse.status} ${tokenResponse.statusText}`);
    
    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error(`   ❌ Ошибка: ${errorText}`);
      throw new Error(`Failed to get token: ${tokenResponse.status} - ${errorText}`);
    }

    const tokenData = await tokenResponse.json();
    console.log(`   ✅ Токен получен:`);
    console.log(`      access_token: ${tokenData.access_token?.substring(0, 20)}...`);
    console.log(`      expires_in: ${tokenData.expires_in} сек`);
    console.log(`      refresh_token: ${tokenData.refresh_token ? 'есть' : 'нет'}\n`);

    const accessToken = tokenData.access_token;

    // Шаг 2: Получение списка устройств
    console.log('2️⃣ Получаю список устройств...\n');
    
    const devicesResponse = await fetch(`${API_BASE}/json/v1/devices`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    console.log(`   Статус: ${devicesResponse.status} ${devicesResponse.statusText}`);
    
    if (!devicesResponse.ok) {
      const errorText = await devicesResponse.text();
      console.error(`   ❌ Ошибка: ${errorText}`);
      throw new Error(`Failed to get devices: ${devicesResponse.status} - ${errorText}`);
    }

    const devicesData = await devicesResponse.json();
    console.log(`   ✅ Устройства получены:`);
    
    // Проверяем структуру ответа
    let devices = [];
    if (Array.isArray(devicesData)) {
      devices = devicesData;
    } else if (devicesData.devices && Array.isArray(devicesData.devices)) {
      devices = devicesData.devices;
    } else if (devicesData.data && Array.isArray(devicesData.data)) {
      devices = devicesData.data;
    } else {
      console.log(`   ⚠️  Неожиданная структура ответа:`, JSON.stringify(devicesData, null, 2).substring(0, 500));
    }

    console.log(`      Найдено устройств: ${devices.length}`);
    if (devices.length > 0) {
      console.log(`      Первое устройство:`);
      const firstDevice = devices[0];
      console.log(`         device_id: ${firstDevice.device_id || firstDevice.id}`);
      console.log(`         alias: ${firstDevice.alias || firstDevice.name}`);
      console.log(`         imei: ${firstDevice.imei || 'не указан'}\n`);
    }

    // Шаг 3: Получение данных первого устройства
    if (devices.length > 0) {
      const deviceId = devices[0].device_id || devices[0].id;
      console.log(`3️⃣ Получаю данные устройства ${deviceId}...\n`);
      
      const deviceDataResponse = await fetch(`${API_BASE}/json/v1/device/${deviceId}/data`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      console.log(`   Статус: ${deviceDataResponse.status} ${deviceDataResponse.statusText}`);
      
      if (!deviceDataResponse.ok) {
        const errorText = await deviceDataResponse.text();
        console.error(`   ❌ Ошибка: ${errorText}`);
        console.log(`   ⚠️  Продолжаю тестирование...\n`);
      } else {
        const deviceData = await deviceDataResponse.json();
        console.log(`   ✅ Данные устройства получены:`);
        console.log(`      Структура ответа:`, Object.keys(deviceData).join(', '));
        
        if (deviceData.position) {
          console.log(`      Позиция: lat=${deviceData.position.lat}, lng=${deviceData.position.lng}`);
        }
        if (deviceData.status) {
          console.log(`      Статус:`, JSON.stringify(deviceData.status, null, 2).substring(0, 200));
        }
        if (deviceData.sensors) {
          console.log(`      Датчики:`, JSON.stringify(deviceData.sensors, null, 2).substring(0, 200));
        }
        console.log('');
      }
    }

    // Шаг 4: Проверка структуры ответа токена
    console.log('4️⃣ Анализ структуры ответов...\n');
    console.log(`   Структура ответа токена:`, JSON.stringify(Object.keys(tokenData), null, 2));
    console.log(`   Полный ответ токена:`, JSON.stringify(tokenData, null, 2));
    console.log('');

    console.log('✅ Все тесты пройдены успешно!\n');

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

