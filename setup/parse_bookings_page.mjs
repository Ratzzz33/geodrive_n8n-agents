#!/usr/bin/env node
/**
 * Парсинг страницы броней RentProg для анализа структуры данных
 * 
 * Цель: извлечь все поля из таблицы активных и неактивных броней
 * и сравнить с тем, что есть в БД
 */

import { chromium } from 'playwright';
import postgres from 'postgres';

const CONNECTION_STRING = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

// Credentials для авторизации по филиалам
const CREDENTIALS = {
  'tbilisi': { login: 'eliseevaleksei32@gmail.com', password: 'a0babuz0' },
  'batumi': { login: 'ceo@geodrive.rent', password: 'a6wumobt' },
  'kutaisi': { login: 'geodrivekutaisi2@gmail.com', password: '8fia8mor' },
  'service-center': { login: 'sofia2020eliseeva@gmail.com', password: 'x2tn7hks' }
};

async function parseBookingsPage(branch) {
  console.log(`\n🔍 Парсинг броней для филиала: ${branch.toUpperCase()}`);
  
  const creds = CREDENTIALS[branch];
  if (!creds) {
    throw new Error(`Нет credentials для филиала: ${branch}`);
  }
  
  const browser = await chromium.launch({ 
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
  });
  
  const page = await context.newPage();
  
  try {
    // Логин
    console.log(`  🔐 Авторизация...`);
    await page.goto(`https://web.rentprog.ru/${branch}/login`, { 
      waitUntil: 'domcontentloaded',
      timeout: 30000 
    });
    
    // Ждем загрузки формы логина - пробуем несколько раз
    let pageInfo = null;
    for (let attempt = 0; attempt < 5; attempt++) {
      await page.waitForTimeout(2000);
      pageInfo = await page.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll('input'));
      const buttons = Array.from(document.querySelectorAll('button'));
      const forms = Array.from(document.querySelectorAll('form'));
      
      return {
        url: window.location.href,
        title: document.title,
        inputs: inputs.map(inp => ({
          type: inp.type,
          name: inp.name,
          id: inp.id,
          placeholder: inp.placeholder,
          className: inp.className,
          selector: inp.tagName.toLowerCase() + (inp.type ? `[type="${inp.type}"]` : '') + (inp.name ? `[name="${inp.name}"]` : '')
        })),
        buttons: buttons.map(btn => ({
          type: btn.type,
          text: btn.textContent?.trim(),
          className: btn.className
        })),
        forms: forms.length
      };
      });
      
      console.log(`  📋 Попытка ${attempt + 1}: Найдено на странице:`);
      console.log(`     - Input полей: ${pageInfo.inputs.length}`);
      console.log(`     - Кнопок: ${pageInfo.buttons.length}`);
      console.log(`     - Форм: ${pageInfo.forms}`);
      
      if (pageInfo.inputs.length > 0) {
        console.log(`     Input поля:`, pageInfo.inputs.map(i => `${i.type || 'text'}: ${i.name || i.id || 'no-name'}`).join(', '));
        break; // Нашли поля, выходим из цикла
      }
    }
    
    if (!pageInfo || pageInfo.inputs.length === 0) {
      // Делаем скриншот и сохраняем HTML для анализа
      await page.screenshot({ path: 'setup/login_page_debug.png', fullPage: true });
      const html = await page.content();
      const fs = await import('fs');
      fs.writeFileSync('setup/login_page_html.html', html);
      throw new Error('Не найдено input полей на странице логина после 5 попыток. Скриншот и HTML сохранены.');
    }
    
    // Ищем поле email/логин
    const emailInput = pageInfo.inputs.find(i => 
      i.type === 'email' || 
      i.name?.toLowerCase().includes('email') ||
      i.name?.toLowerCase().includes('login') ||
      i.placeholder?.toLowerCase().includes('email') ||
      i.placeholder?.toLowerCase().includes('почта') ||
      i.placeholder?.toLowerCase().includes('логин')
    ) || pageInfo.inputs[0]; // Берем первый input если не нашли
    
    if (!emailInput) {
      await page.screenshot({ path: 'setup/login_page_debug.png', fullPage: true });
      throw new Error('Не найдено ни одного input поля на странице логина');
    }
    
    console.log(`  ✅ Используем поле: ${emailInput.selector || emailInput.name || 'input[0]'}`);
    await page.fill(emailInput.selector || `input[name="${emailInput.name}"]` || 'input[type="email"]', creds.login);
    
    // Ищем поле password
    const passwordInput = pageInfo.inputs.find(i => 
      i.type === 'password' ||
      i.name?.toLowerCase().includes('password') ||
      i.name?.toLowerCase().includes('пароль')
    ) || pageInfo.inputs[1]; // Берем второй input если не нашли
    
    if (!passwordInput) {
      throw new Error('Не найдено поле password');
    }
    
    console.log(`  ✅ Используем поле password: ${passwordInput.selector || passwordInput.name || 'input[1]'}`);
    await page.fill(passwordInput.selector || `input[name="${passwordInput.name}"]` || 'input[type="password"]', creds.password);
    
    // Ищем кнопку отправки
    const submitButton = pageInfo.buttons.find(b => 
      b.type === 'submit' ||
      b.text?.toLowerCase().includes('войти') ||
      b.text?.toLowerCase().includes('login') ||
      b.text?.toLowerCase().includes('вход')
    ) || pageInfo.buttons[0];
    
    if (!submitButton) {
      throw new Error('Не найдена кнопка отправки');
    }
    
    console.log(`  ✅ Найдена кнопка: ${submitButton.text || submitButton.type}`);
    
    // Кликаем на кнопку
    await page.evaluate((btnText) => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const btn = buttons.find(b => 
        b.textContent?.trim().toLowerCase().includes(btnText?.toLowerCase() || 'войти') ||
        b.type === 'submit'
      ) || buttons[0];
      if (btn) btn.click();
    }, submitButton.text);
    
    // Ждем навигации
    await page.waitForTimeout(5000);
    const afterLoginUrl = page.url();
    
    if (afterLoginUrl.includes('/login')) {
      // Пробуем еще раз с прямым кликом
      await page.click('button[type="submit"]').catch(() => {
        // Игнорируем ошибку, пробуем через Enter
        page.keyboard.press('Enter');
      });
      await page.waitForTimeout(3000);
    }
    
    const finalUrl = page.url();
    if (finalUrl.includes('/login')) {
      await page.screenshot({ path: 'setup/login_failed_debug.png', fullPage: true });
      throw new Error('Авторизация не удалась - остались на странице логина');
    }
    console.log(`  ✅ Авторизация успешна: ${finalUrl}`);
    
    // Открываем страницу броней
    console.log(`  📄 Открываем страницу броней...`);
    await page.goto('https://web.rentprog.ru/bookings', { 
      waitUntil: 'networkidle',
      timeout: 60000 
    });
    
    // Ждем загрузки страницы
    await page.waitForTimeout(3000);
    
    // Проверяем, что мы авторизованы (не на странице логина)
    const currentUrl = page.url();
    if (currentUrl.includes('/login')) {
      throw new Error('Не удалось авторизоваться - перенаправление на страницу логина');
    }
    
    console.log(`  ✅ Страница загружена: ${currentUrl}`);
    
    // Пробуем разные селекторы для таблицы
    let tableFound = false;
    const selectors = [
      'table tbody tr',
      'tbody tr',
      'table tr',
      '[role="row"]',
      '.table tbody tr'
    ];
    
    for (const selector of selectors) {
      try {
        await page.waitForSelector(selector, { timeout: 5000 });
        tableFound = true;
        console.log(`  ✅ Таблица найдена по селектору: ${selector}`);
        break;
      } catch (e) {
        // Пробуем следующий селектор
      }
    }
    
    if (!tableFound) {
      // Делаем скриншот для отладки
      await page.screenshot({ path: 'setup/bookings_page_debug.png', fullPage: true });
      console.log(`  ⚠️  Таблица не найдена, скриншот сохранен в setup/bookings_page_debug.png`);
      
      // Пытаемся получить HTML для анализа
      const bodyHtml = await page.evaluate(() => document.body.innerHTML.substring(0, 1000));
      console.log(`  📄 Первые 1000 символов HTML: ${bodyHtml}`);
    }
    
    // Парсим активные брони
    console.log(`  📋 Парсим АКТИВНЫЕ брони...`);
    const activeBookings = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('table tbody tr'));
      const bookings = [];
      
      rows.forEach((row, index) => {
        const cells = row.querySelectorAll('td');
        if (cells.length === 0) return;
        
        const booking = {
          row_index: index,
          // Извлекаем данные из ячеек
          number: cells[0]?.textContent?.trim() || null,
          created: cells[1]?.textContent?.trim() || null,
          client_status: cells[2]?.innerHTML || null, // Может содержать иконки
          payment: cells[3]?.textContent?.trim() || null,
          car_name: cells[4]?.textContent?.trim() || null,
          client_name: cells[5]?.textContent?.trim() || null,
          start_date: cells[6]?.textContent?.trim() || null,
          end_date: cells[7]?.textContent?.trim() || null,
          days: cells[8]?.textContent?.trim() || null,
          issue_location: cells[9]?.textContent?.trim() || null,
          return_location: cells[10]?.textContent?.trim() || null,
          notes: cells[11]?.textContent?.trim() || null,
          responsible: cells[12]?.textContent?.trim() || null,
          // Дополнительные данные из атрибутов
          row_html: row.innerHTML.substring(0, 200), // Первые 200 символов для анализа
        };
        
        // Пытаемся найти ссылку на детальную страницу брони
        const link = row.querySelector('a[href*="/bookings/"]');
        if (link) {
          booking.detail_url = link.href;
          booking.booking_id = link.href.match(/\/bookings\/(\d+)/)?.[1] || null;
        }
        
        bookings.push(booking);
      });
      
      return bookings;
    });
    
    console.log(`  ✅ Найдено активных броней: ${activeBookings.length}`);
    
    // Переключаемся на неактивные брони
    console.log(`  📋 Переключаемся на НЕАКТИВНЫЕ брони...`);
    const inactiveTab = await page.$('text=НЕАКТИВНЫЕ БРОНИ');
    if (inactiveTab) {
      await inactiveTab.click();
      await page.waitForTimeout(2000); // Ждем загрузки
      await page.waitForSelector('table tbody tr', { timeout: 10000 });
      
      const inactiveBookings = await page.evaluate(() => {
        const rows = Array.from(document.querySelectorAll('table tbody tr'));
        const bookings = [];
        
        rows.forEach((row, index) => {
          const cells = row.querySelectorAll('td');
          if (cells.length === 0) return;
          
          const booking = {
            row_index: index,
            number: cells[0]?.textContent?.trim() || null,
            created: cells[1]?.textContent?.trim() || null,
            status_icon: cells[2]?.innerHTML || null, // Иконка статуса
            client_status: cells[3]?.innerHTML || null,
            payment: cells[4]?.textContent?.trim() || null,
            car_name: cells[5]?.textContent?.trim() || null,
            client_name: cells[6]?.textContent?.trim() || null,
            start_date: cells[7]?.textContent?.trim() || null,
            end_date: cells[8]?.textContent?.trim() || null,
            days: cells[9]?.textContent?.trim() || null,
            issue_location: cells[10]?.textContent?.trim() || null,
            return_location: cells[11]?.textContent?.trim() || null,
            notes: cells[12]?.textContent?.trim() || null,
            responsible: cells[13]?.textContent?.trim() || null,
            row_html: row.innerHTML.substring(0, 200),
          };
          
          const link = row.querySelector('a[href*="/bookings/"]');
          if (link) {
            booking.detail_url = link.href;
            booking.booking_id = link.href.match(/\/bookings\/(\d+)/)?.[1] || null;
          }
          
          bookings.push(booking);
        });
        
        return bookings;
      });
      
      console.log(`  ✅ Найдено неактивных броней: ${inactiveBookings.length}`);
      
      return {
        branch,
        active: activeBookings,
        inactive: inactiveBookings,
        total: activeBookings.length + inactiveBookings.length
      };
    } else {
      console.log(`  ⚠️  Вкладка "НЕАКТИВНЫЕ БРОНИ" не найдена`);
      return {
        branch,
        active: activeBookings,
        inactive: [],
        total: activeBookings.length
      };
    }
    
  } catch (error) {
    console.error(`  ❌ Ошибка при парсинге:`, error.message);
    return {
      branch,
      active: [],
      inactive: [],
      total: 0,
      error: error.message
    };
  } finally {
    await browser.close();
  }
}

async function getDbFields() {
  const sql = postgres(CONNECTION_STRING, {
    max: 1,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    // Получаем структуру таблицы bookings
    const columns = await sql`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'bookings'
      ORDER BY ordinal_position;
    `;
    
    return columns.map(col => ({
      name: col.column_name,
      type: col.data_type,
      nullable: col.is_nullable === 'YES'
    }));
  } finally {
    await sql.end();
  }
}

async function main() {
  console.log('🚀 Начало парсинга страницы броней RentProg\n');
  
  // Получаем структуру БД
  console.log('📊 Анализ структуры БД...');
  const dbFields = await getDbFields();
  console.log(`  ✅ Найдено полей в БД: ${dbFields.length}`);
  console.log(`  Поля: ${dbFields.map(f => f.name).join(', ')}\n`);
  
  // Парсим для одного филиала (tbilisi) для начала
  const result = await parseBookingsPage('tbilisi');
  
  // Анализируем найденные поля
  console.log('\n📋 АНАЛИЗ НАЙДЕННЫХ ДАННЫХ:\n');
  
  if (result.active.length > 0) {
    const firstActive = result.active[0];
    console.log('АКТИВНЫЕ БРОНИ - поля из первой строки:');
    Object.keys(firstActive).forEach(key => {
      const value = firstActive[key];
      const inDb = dbFields.some(f => f.name === key || f.name.includes(key.toLowerCase()));
      const marker = inDb ? '✅' : '❌ НОВОЕ';
      console.log(`  ${marker} ${key}: ${value ? (typeof value === 'string' && value.length > 50 ? value.substring(0, 50) + '...' : value) : 'null'}`);
    });
  }
  
  if (result.inactive.length > 0) {
    const firstInactive = result.inactive[0];
    console.log('\nНЕАКТИВНЫЕ БРОНИ - поля из первой строки:');
    Object.keys(firstInactive).forEach(key => {
      const value = firstInactive[key];
      const inDb = dbFields.some(f => f.name === key || f.name.includes(key.toLowerCase()));
      const marker = inDb ? '✅' : '❌ НОВОЕ';
      console.log(`  ${marker} ${key}: ${value ? (typeof value === 'string' && value.length > 50 ? value.substring(0, 50) + '...' : value) : 'null'}`);
    });
  }
  
  // Сохраняем результаты в JSON для анализа
  const fs = await import('fs');
  fs.writeFileSync(
    'setup/bookings_parse_result.json',
    JSON.stringify({ dbFields, parseResult: result }, null, 2)
  );
  console.log('\n💾 Результаты сохранены в setup/bookings_parse_result.json');
  
  // Формируем список новых полей
  const allFields = new Set();
  result.active.forEach(b => Object.keys(b).forEach(k => allFields.add(k)));
  result.inactive.forEach(b => Object.keys(b).forEach(k => allFields.add(k)));
  
  const dbFieldNames = new Set(dbFields.map(f => f.name.toLowerCase()));
  const newFields = Array.from(allFields).filter(f => 
    !dbFieldNames.has(f.toLowerCase()) && 
    !dbFieldNames.has(f.replace(/_/g, '').toLowerCase())
  );
  
  console.log('\n📝 СПИСОК НОВЫХ/НЕИЗВЕСТНЫХ ПОЛЕЙ:');
  if (newFields.length > 0) {
    newFields.forEach(field => {
      console.log(`  ❌ ${field}`);
    });
  } else {
    console.log('  ✅ Все поля найдены в БД');
  }
  
  console.log(`\n✅ Парсинг завершен. Всего броней: ${result.total}`);
}

main().catch(console.error);

