/**
 * Проверка статуса Maserati напрямую из Starline API
 */

import { chromium } from 'playwright';

const BASE_URL = 'https://starline-online.ru';
const USERNAME = '79538811003';
const PASSWORD = 'GD5566';

async function main() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  try {
    console.log('🔍 Логин в Starline...');
    await page.goto(BASE_URL);
    await page.waitForTimeout(2000);
    
    // Логин
    await page.fill('input[name="user_name"]', USERNAME);
    await page.fill('input[type="password"]', PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(5000);
    
    console.log('✅ Залогинились\n');
    
    // Перехватываем API запросы
    page.on('response', async (response) => {
      const url = response.url();
      
      if (url.includes('/user/data') || url.includes('/device')) {
        try {
          const json = await response.json();
          
          // Ищем Maserati
          let devices = [];
          if (json.answer?.devices) {
            devices = json.answer.devices;
          } else if (json.answer) {
            devices = Object.values(json.answer);
          }
          
          devices.forEach(device => {
            if (device.alias?.includes('Maserati') || device.alias?.includes('686')) {
              console.log('========== MASERATI НАЙДЕН ==========');
              console.log('Alias:', device.alias);
              console.log('Device ID:', device.device_id);
              console.log('');
              console.log('STATUS:', device.status, device.status === 0 ? '(offline)' : device.status === 1 ? '(online)' : '(unknown)');
              console.log('GPS Level:', device.gps_lvl);
              console.log('GSM Level:', device.gsm_lvl);
              console.log('');
              console.log('Position:');
              console.log('  lat:', device.pos?.y);
              console.log('  lng:', device.pos?.x);
              console.log('  sat_qty:', device.pos?.sat_qty);
              console.log('  speed (s):', device.pos?.s);
              console.log('');
              console.log('Car State:');
              console.log('  ignition (ign):', device.car_state?.ign);
              console.log('  engine running (run):', device.car_state?.run);
              console.log('');
              console.log('Full device object:');
              console.log(JSON.stringify(device, null, 2));
              console.log('===================================\n');
            }
          });
        } catch (e) {
          // Не JSON ответ
        }
      }
    });
    
    // Ждём загрузки данных
    await page.waitForTimeout(10000);
    
    console.log('\n✅ Проверка завершена. Смотрите выше данные по Maserati.');
    
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
  } finally {
    await browser.close();
  }
}

main();

