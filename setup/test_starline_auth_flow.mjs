#!/usr/bin/env node
/**
 * Тестирование полного процесса авторизации Starline API
 */

const APP_ID = '40884';
const APP_SECRET = '55t6wDYPs800o3UCRfjd_kW27f2eI1fL';

async function testAuthFlow() {
  console.log('🧪 Тестирование процесса авторизации Starline API...\n');

  try {
    // Шаг 1: Получение кода приложения (getCode)
    console.log('1️⃣ Получаю код приложения (getCode)...\n');
    
    const getCodeResponse = await fetch('https://developer.starline.ru/apiV3/application/getCode', {
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
      console.log(`   Ответ: ${errorText.substring(0, 200)}`);
    } else {
      const codeData = await getCodeResponse.json();
      console.log(`   ✅ Код получен:`, JSON.stringify(codeData, null, 2));
      
      // Шаг 2: Получение токена приложения (getToken)
      if (codeData.code) {
        console.log('\n2️⃣ Получаю токен приложения (getToken)...\n');
        
        const getTokenResponse = await fetch('https://developer.starline.ru/apiV3/application/getToken', {
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
          console.log(`   Ответ: ${errorText.substring(0, 200)}`);
        } else {
          const tokenData = await getTokenResponse.json();
          console.log(`   ✅ Токен приложения получен:`, JSON.stringify(tokenData, null, 2));
          
          // Шаг 3: Получение списка устройств
          if (tokenData.access_token || tokenData.slid_token) {
            const accessToken = tokenData.access_token || tokenData.slid_token;
            console.log('\n3️⃣ Получаю список устройств...\n');
            
            const devicesResponse = await fetch('https://developer.starline.ru/json/v1/devices', {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
              }
            });

            console.log(`   Статус: ${devicesResponse.status} ${devicesResponse.statusText}`);
            
            if (!devicesResponse.ok) {
              const errorText = await devicesResponse.text();
              console.log(`   Ответ: ${errorText.substring(0, 200)}`);
            } else {
              const devicesData = await devicesResponse.json();
              console.log(`   ✅ Устройства получены:`, JSON.stringify(devicesData, null, 2).substring(0, 500));
            }
          }
        }
      }
    }

    // Альтернативный вариант: прямой запрос с appId и appSecret
    console.log('\n4️⃣ Пробую прямой запрос с appId и appSecret...\n');
    
    const directResponse = await fetch('https://developer.starline.ru/json/v1/devices', {
      method: 'GET',
      headers: {
        'X-AppId': APP_ID,
        'X-AppSecret': APP_SECRET,
        'Content-Type': 'application/json'
      }
    });

    console.log(`   Статус: ${directResponse.status} ${directResponse.statusText}`);
    if (!directResponse.ok) {
      const errorText = await directResponse.text();
      console.log(`   Ответ: ${errorText.substring(0, 200)}`);
    } else {
      const devicesData = await directResponse.json();
      console.log(`   ✅ Устройства получены:`, JSON.stringify(devicesData, null, 2).substring(0, 500));
    }

  } catch (error) {
    console.error('❌ Ошибка при тестировании:');
    console.error(error.message);
    if (error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }
  }
}

testAuthFlow();

