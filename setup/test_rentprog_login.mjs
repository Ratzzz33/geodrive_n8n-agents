/**
 * Тест авторизации в RentProg UI и определение селекторов
 * Запуск: node setup/test_rentprog_login.mjs
 * 
 * ВАЖНО: Требует установки playwright:
 * npm install playwright
 */

import { chromium } from 'playwright';
import fs from 'fs';

// Credentials (из файла config/rentprog-ui-credentials.example.json)
const credentials = {
  'service-center': {
    login: 'sofia2020eliseeva@gmail.com',
    password: 'x2tn7hks',
  },
  'tbilisi': {
    login: 'eliseevaleksei32@gmail.com',
    password: 'a0babuz0',
  },
  'kutaisi': {
    login: 'geodrivekutaisi2@gmail.com',
    password: '8fia8mor',
  },
  'batumi': {
    login: 'ceo@geodrive.rent',
    password: 'a6wumobt',
  },
};

/**
 * Тест авторизации для одного филиала
 */
async function testBranchLogin(branch) {
  console.log(`\n🧪 Testing login for: ${branch}`);
  
  const creds = credentials[branch];
  const browser = await chromium.launch({ headless: false }); // headless: false для отладки
  const page = await browser.newPage();
  
  try {
    // 1. Открыть страницу входа
    const loginUrl = `https://web.rentprog.ru/${branch}/login`;
    console.log(`📄 Opening: ${loginUrl}`);
    await page.goto(loginUrl, { waitUntil: 'networkidle' });
    await page.screenshot({ path: `screenshots/${branch}_login_page.png` });
    
    // 2. Попробовать разные селекторы для email
    const emailSelectors = [
      'input[name="email"]',
      'input[type="email"]',
      'input[placeholder*="email" i]',
      'input[placeholder*="логин" i]',
      '#email',
      '.email-input',
    ];
    
    let emailSelector = null;
    for (const selector of emailSelectors) {
      try {
        await page.fill(selector, creds.login, { timeout: 2000 });
        emailSelector = selector;
        console.log(`✅ Email selector found: ${selector}`);
        break;
      } catch (e) {
        console.log(`   ❌ Not found: ${selector}`);
      }
    }
    
    if (!emailSelector) {
      throw new Error('Email input not found with any selector');
    }
    
    // 3. Попробовать разные селекторы для password
    const passwordSelectors = [
      'input[type="password"]',
      'input[name="password"]',
      '#password',
      '.password-input',
    ];
    
    let passwordSelector = null;
    for (const selector of passwordSelectors) {
      try {
        await page.fill(selector, creds.password, { timeout: 2000 });
        passwordSelector = selector;
        console.log(`✅ Password selector found: ${selector}`);
        break;
      } catch (e) {
        console.log(`   ❌ Not found: ${selector}`);
      }
    }
    
    if (!passwordSelector) {
      throw new Error('Password input not found with any selector');
    }
    
    // 4. Найти и нажать кнопку входа
    const submitSelectors = [
      'button[type="submit"]',
      'input[type="submit"]',
      'button:has-text("Вход")',
      'button:has-text("Войти")',
      '.login-button',
    ];
    
    let submitSelector = null;
    for (const selector of submitSelectors) {
      try {
        const button = page.locator(selector).first();
        await button.click({ timeout: 2000 });
        submitSelector = selector;
        console.log(`✅ Submit button found: ${selector}`);
        break;
      } catch (e) {
        console.log(`   ❌ Not found: ${selector}`);
      }
    }
    
    if (!submitSelector) {
      throw new Error('Submit button not found with any selector');
    }
    
    // 5. Дождаться навигации
    await page.waitForNavigation({ timeout: 10000 });
    const currentUrl = page.url();
    console.log(`📍 Current URL after login: ${currentUrl}`);
    
    // 6. Проверить успешность авторизации
    if (currentUrl.includes('/login')) {
      throw new Error('Login failed - still on login page');
    }
    
    await page.screenshot({ path: `screenshots/${branch}_after_login.png` });
    console.log(`✅ Login successful for ${branch}!`);
    
    // 7. Перейти на страницу События
    console.log(`\n📄 Testing Events page...`);
    await page.goto(`https://web.rentprog.ru/${branch}/events`, { waitUntil: 'networkidle' });
    await page.screenshot({ path: `screenshots/${branch}_events_page.png` });
    
    // 8. Проверить таблицу событий
    const tableSelectors = [
      'table tbody tr',
      '.events-table tbody tr',
      '[data-testid="events-table"] tbody tr',
    ];
    
    let eventsRows = [];
    for (const selector of tableSelectors) {
      try {
        const rows = await page.locator(selector).all();
        if (rows.length > 0) {
          eventsRows = rows;
          console.log(`✅ Events table found: ${selector} (${rows.length} rows)`);
          break;
        }
      } catch (e) {
        console.log(`   ❌ Not found: ${selector}`);
      }
    }
    
    if (eventsRows.length > 0) {
      // Проверить структуру первой строки
      const firstRow = eventsRows[0];
      const cells = await firstRow.locator('td').all();
      
      console.log(`   Cells in first row: ${cells.length}`);
      
      if (cells.length >= 2) {
        const dateText = await cells[0].textContent();
        const descText = await cells[1].textContent();
        console.log(`   Date: "${dateText?.trim()}"`);
        console.log(`   Description: "${descText?.trim().slice(0, 60)}..."`);
      }
    } else {
      console.log(`   ⚠️ No events found in table`);
    }
    
    // 9. Сохранить результаты
    const result = {
      branch,
      selectors: {
        email: emailSelector,
        password: passwordSelector,
        submit: submitSelector,
        eventsTable: eventsRows.length > 0 ? tableSelectors.find(s => eventsRows.length > 0) : null,
      },
      urls: {
        login: loginUrl,
        afterLogin: currentUrl,
        events: `https://web.rentprog.ru/${branch}/events`,
      },
      success: true,
    };
    
    return result;
    
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
    await page.screenshot({ path: `screenshots/${branch}_error.png` });
    
    return {
      branch,
      success: false,
      error: error.message,
    };
    
  } finally {
    await browser.close();
  }
}

/**
 * Главная функция
 */
async function main() {
  console.log('🚀 Starting RentProg login tests...\n');
  
  // Создать папку для скриншотов
  if (!fs.existsSync('screenshots')) {
    fs.mkdirSync('screenshots');
  }
  
  const results = {};
  
  // Тестировать каждый филиал
  for (const branch of Object.keys(credentials)) {
    const result = await testBranchLogin(branch);
    results[branch] = result;
    
    // Задержка между тестами
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  // Сохранить результаты
  const reportPath = 'screenshots/login_test_results.json';
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
  
  console.log(`\n📊 Test Results:`);
  console.log(JSON.stringify(results, null, 2));
  console.log(`\n✅ Results saved to: ${reportPath}`);
  
  // Подсчитать успешные/неудачные
  const successful = Object.values(results).filter(r => r.success).length;
  const failed = Object.values(results).filter(r => !r.success).length;
  
  console.log(`\n📈 Summary: ${successful} successful, ${failed} failed`);
  
  if (failed > 0) {
    process.exit(1);
  }
}

main().catch(console.error);

