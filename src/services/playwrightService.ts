// @ts-nocheck
/// <reference lib="dom" />
import express from 'express';

import { chromium } from 'playwright';



const app = express();

app.use(express.json({ limit: '10mb' }));



// Credentials для каждого филиала

const CREDENTIALS = {

  tbilisi: { login: 'eliseevaleksei32@gmail.com', password: 'a0babuz0' },

  batumi: { login: 'ceo@geodrive.rent', password: 'a6wumobt' },

  kutaisi: { login: 'geodrivekutaisi2@gmail.com', password: '8fia8mor' },

  'service-center': { login: 'sofia2020eliseeva@gmail.com', password: 'x2tn7hks' }

};



// Парсинг русской даты

function parseDateFromRussian(dateStr: string): Date {

  const monthMap: Record<string, number> = {

    'янв': 0, 'февр': 1, 'мар': 2, 'апр': 3, 'май': 4, 'июн': 5,

    'июл': 6, 'авг': 7, 'сент': 8, 'окт': 9, 'нояб': 10, 'дек': 11

  };

  

  const match = dateStr.match(/(\d{2})\s+(\w+)\.\s+(\d{2})\s+(\d{2}):(\d{2})/);

  if (!match) return new Date();

  

  const [, day, monthRu, year, hour, minute] = match;

  const month = monthMap[monthRu.toLowerCase()] ?? 0;

  const fullYear = 2000 + parseInt(year, 10);

  

  return new Date(fullYear, month, parseInt(day, 10), parseInt(hour, 10), parseInt(minute, 10));

}



// Endpoint 1: Парсинг событий RentProg

app.post('/scrape-events', async (req, res) => {

  const { branch } = req.body;

  

  if (!branch || !CREDENTIALS[branch as keyof typeof CREDENTIALS]) {

    return res.status(400).json({ success: false, error: 'Invalid branch' });

  }

  

  const creds = CREDENTIALS[branch as keyof typeof CREDENTIALS];

  let browser;

  

  try {

    browser = await chromium.launch({

      headless: true,

      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']

    });

    

    const page = await browser.newPage();

    

    // Логин

    await page.goto(`https://web.rentprog.ru/${branch}/login`);

    await page.fill('[name="email"]', creds.login);

    await page.fill('[name="password"]', creds.password);

    await page.click('button[type="submit"]');

    await page.waitForNavigation();

    

    // Переход на страницу событий

    await page.goto(`https://web.rentprog.ru/${branch}/events`);

    await page.waitForLoadState('networkidle');

    

    // Парсинг событий за последние 5 минут

    const now = new Date();

    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);

    

    const rows = await page.locator('table tbody tr').all();

    const events = [];

    

    for (const row of rows) {

      const dateText = await row.locator('td:nth-child(1)').textContent();

      const descriptionText = await row.locator('td:nth-child(2)').textContent();

      

      if (!dateText || !descriptionText) continue;

      

      const eventDate = parseDateFromRussian(dateText);

      if (eventDate >= fiveMinutesAgo) {

        events.push({

          timestamp: eventDate.toISOString(),

          rawDescription: descriptionText.trim(),

          branch

        });

      }

    }

    

    await browser.close();

    

    res.json({ success: true, events });

  } catch (error: any) {

    if (browser) await browser.close();

    res.status(500).json({ success: false, error: error.message });

  }

});



// Endpoint 2: Парсинг кассы сотрудника

app.post('/scrape-employee-cash', async (req, res) => {

  const { employeeName, employeeId, branch } = req.body;

  

  if (!branch || !CREDENTIALS[branch as keyof typeof CREDENTIALS]) {

    return res.status(400).json({ success: false, error: 'Invalid branch' });

  }

  

  const creds = CREDENTIALS[branch as keyof typeof CREDENTIALS];

  let browser;

  

  try {

    browser = await chromium.launch({

      headless: true,

      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']

    });

    

    const page = await browser.newPage();

    

    // Логин

    await page.goto(`https://web.rentprog.ru/${branch}/login`);

    await page.fill('[name="email"]', creds.login);

    await page.fill('[name="password"]', creds.password);

    await page.click('button[type="submit"]');

    await page.waitForNavigation();

    

    // Переход на страницу сотрудников

    await page.goto(`https://web.rentprog.ru/${branch}/company/employees`);

    await page.waitForLoadState('networkidle');

    

    // Клик по сотруднику

    await page.click(`text="${employeeName}"`);

    await page.waitForLoadState('networkidle');

    

    // Парсинг кассы

    const cashGel = await page.locator('[data-field="cash-gel"]').textContent();

    const cashUsd = await page.locator('[data-field="cash-usd"]').textContent();

    const cashEur = await page.locator('[data-field="cash-eur"]').textContent();

    

    await browser.close();

    

    res.json({

      success: true,

      employeeId,

      employeeName,

      branch,

      realCash: {

        gel: parseFloat(cashGel || '0') || 0,

        usd: parseFloat(cashUsd || '0') || 0,

        eur: parseFloat(cashEur || '0') || 0

      }

    });

  } catch (error: any) {

    if (browser) await browser.close();

    res.status(500).json({ success: false, error: error.message });

  }

});



// Endpoint 3: Парсинг кассы компании

app.post('/scrape-company-cash', async (req, res) => {

  const { branch } = req.body;

  

  if (!branch || !CREDENTIALS[branch as keyof typeof CREDENTIALS]) {

    return res.status(400).json({ success: false, error: 'Invalid branch' });

  }

  

  const creds = CREDENTIALS[branch as keyof typeof CREDENTIALS];

  let browser;

  

  try {

    browser = await chromium.launch({

      headless: true,

      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']

    });

    

    const page = await browser.newPage();

    

    // Логин

    await page.goto(`https://web.rentprog.ru/${branch}/login`);

    await page.fill('[name="email"]', creds.login);

    await page.fill('[name="password"]', creds.password);

    await page.click('button[type="submit"]');

    await page.waitForNavigation();

    

    // Переход на страницу кассы

    await page.goto(`https://web.rentprog.ru/${branch}/company/cash`);

    await page.waitForLoadState('networkidle');

    

    // Парсинг платежей за последние 5 минут

    const now = new Date();

    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);

    

    const rows = await page.locator('table tbody tr').all();

    const payments = [];

    

    for (const row of rows) {

      try {

        const dateText = await row.locator('td:nth-child(1)').textContent();

        const employeeText = await row.locator('td:nth-child(2)').textContent();

        const typeText = await row.locator('td:nth-child(3)').textContent();

        const methodText = await row.locator('td:nth-child(4)').textContent();

        const amountText = await row.locator('td:nth-child(5)').textContent();

        const currencyText = await row.locator('td:nth-child(6)').textContent();

        const commentText = await row.locator('td:nth-child(7)').textContent();

        

        if (!dateText) continue;

        

        const paymentDate = parseDateFromRussian(dateText);

        if (paymentDate >= fiveMinutesAgo) {

          const amount = parseFloat((amountText || '0').replace(/[^0-9.-]/g, ''));

          

          payments.push({

            branch,

            paymentDate: paymentDate.toISOString(),

            employeeName: employeeText?.trim() || 'unknown',

            paymentType: typeText?.trim() || 'unknown',

            paymentMethod: methodText?.trim() || 'unknown',

            amount: amount || 0,

            currency: currencyText?.trim() || 'GEL',

            comment: commentText?.trim() || '',

            rawData: {

              date: dateText,

              employee: employeeText,

              type: typeText,

              method: methodText,

              amount: amountText,

              currency: currencyText,

              comment: commentText

            }

          });

        }

      } catch (rowError) {

        console.log(`Error parsing row: ${rowError}`);

      }

    }

    

    await browser.close();

    

    res.json({ success: true, payments });

  } catch (error: any) {

    if (browser) await browser.close();

    res.status(500).json({ success: false, error: error.message });

  }

});



// Endpoint 4: Парсинг курсов валют

app.post('/scrape-exchange-rates', async (req, res) => {

  const { branch } = req.body;

  

  if (!branch || !CREDENTIALS[branch as keyof typeof CREDENTIALS]) {

    return res.status(400).json({ success: false, error: 'Invalid branch' });

  }

  

  const creds = CREDENTIALS[branch as keyof typeof CREDENTIALS];

  let browser;

  

  try {

    browser = await chromium.launch({

      headless: true,

      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']

    });

    

    const page = await browser.newPage();

    

    // Логин

    await page.goto('https://web.rentprog.ru/signin');

    await page.fill('input[type="text"]', creds.login);

    await page.fill('input[type="password"]', creds.password);

    await page.click('button[type="submit"]');

    await page.waitForNavigation();

    

    // Переход на страницу профиля компании

    await page.goto('https://web.rentprog.ru/company_profile');

    await page.waitForLoadState('networkidle');

    

    // Ждём загрузки expansion panels

    await page.waitForSelector('.v-expansion-panel-header', { timeout: 10000 });

    

    // Парсинг курсов валют

    const rates = await page.evaluate(async () => {

      const result: Record<string, number> = {};

      

      // Находим все кнопки с курсами

      const buttons = Array.from(document.querySelectorAll('.v-expansion-panel-header'))

        .filter((btn: any) => btn.textContent?.includes('GEL <->'));

      

      for (const button of buttons as any[]) {

        const text = button.textContent?.trim() || '';

        let currency: string | null = null;

        

        if (text.includes('₽')) currency = 'rub';

        if (text.includes('€')) currency = 'eur';

        if (text.includes('$')) currency = 'usd';

        

        if (!currency) continue;

        

        // Кликаем на кнопку чтобы раскрыть панель

        (button as HTMLElement).click();

        

        // Ждём 100ms для раскрытия

        await new Promise(resolve => setTimeout(resolve, 100));

        

        // Ищем input в раскрытой панели

        const panel = (button as any).parentElement;

        const content = panel?.querySelector('.v-expansion-panel-content');

        const input = content?.querySelector('input[type="text"], input[type="number"]') as HTMLInputElement;

        

        if (input && input.value) {

          result[`gel_to_${currency}`] = parseFloat(input.value);

        }

      }

      

      // Вычисляем обратные курсы

      if (result.gel_to_rub) result.rub_to_gel = 1 / result.gel_to_rub;

      if (result.gel_to_eur) result.eur_to_gel = 1 / result.gel_to_eur;

      if (result.gel_to_usd) result.usd_to_gel = 1 / result.gel_to_usd;

      

      return result;

    });

    

    await browser.close();

    

    if (!rates || Object.keys(rates).length === 0) {

      return res.status(500).json({ 

        success: false, 

        error: 'No exchange rates found' 

      });

    }

    

    res.json({

      success: true,

      branch,

      rates,

      timestamp: new Date().toISOString()

    });

    

  } catch (error: any) {

    if (browser) await browser.close();

    res.status(500).json({ success: false, error: error.message });

  }

});



// Endpoint 5: Парсинг броней (активных и неактивных)

app.post('/scrape-bookings', async (req, res) => {

  const { branch } = req.body;

  

  if (!branch || !CREDENTIALS[branch as keyof typeof CREDENTIALS]) {

    return res.status(400).json({ success: false, error: 'Invalid branch' });

  }

  

  const creds = CREDENTIALS[branch as keyof typeof CREDENTIALS];

  let browser;

  

  try {

    browser = await chromium.launch({

      headless: true,

      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']

    });

    

    const page = await browser.newPage();

    

    // Логин

    await page.goto(`https://web.rentprog.ru/${branch}/login`);

    await page.fill('[name="email"]', creds.login);

    await page.fill('[name="password"]', creds.password);

    await page.click('button[type="submit"]');

    await page.waitForNavigation();

    

    // Переход на страницу броней

    await page.goto('https://web.rentprog.ru/bookings');

    await page.waitForLoadState('networkidle');

    await page.waitForTimeout(2000);

    

    // Парсим активные брони

    const activeBookings = await page.evaluate(() => {

      // @ts-ignore - код выполняется в браузере

      const rows = Array.from(document.querySelectorAll('table tbody tr'));

      const bookings: any[] = [];

      

      rows.forEach((row: any) => {

        // @ts-ignore - код выполняется в браузере

        const cells = (row as any).querySelectorAll('td');

        if (cells.length < 14) return;

        

        const booking: any = {

          number: cells[0]?.textContent?.trim() || null,

          created: cells[1]?.textContent?.trim() || null,

          status_icon_html: cells[2]?.innerHTML || null,

          client_status_html: cells[3]?.innerHTML || null,

          payment: cells[4]?.textContent?.trim() || null,

          car_name: cells[5]?.textContent?.trim() || null,

          client_name: cells[6]?.textContent?.trim() || null,

          start_date: cells[7]?.textContent?.trim() || null,

          end_date: cells[8]?.textContent?.trim() || null,

          days: cells[9]?.textContent?.trim() || null,

          issue_location: cells[10]?.textContent?.trim() || null,

          return_location: cells[11]?.textContent?.trim() || null,

          notes: cells[12]?.textContent?.trim() || null,

          responsible_html: cells[13]?.innerHTML || null,

          responsible: cells[13]?.textContent?.trim() || null,

        };

        

        // Извлекаем payment status и color

        const paymentBtn = cells[4]?.querySelector('button');

        if (paymentBtn) {

          const classes = paymentBtn.className;

          booking.payment_color = classes.match(/(success|error|warning|disabled|outlined)/)?.[1] || null;

          booking.payment_is_elevated = classes.includes('v-btn--is-elevated');

          booking.payment_is_disabled = classes.includes('v-btn--disabled');

        }

        

        // Извлекаем client category и color

        const clientStatusBtn = cells[3]?.querySelector('button');

        if (clientStatusBtn) {

          const icon = clientStatusBtn.querySelector('i');

          if (icon) {

            const iconName = icon.className.match(/mdi-([a-z0-9-]+)/)?.[1] || null;

            booking.client_status_icon = iconName;

            const textColor = icon.className.match(/(light-blue|green|primary|success|error|warning)--text/)?.[1] || null;

            booking.client_status_color = textColor;

            

            // Определяем категорию клиента

            if (iconName === 'new-box') booking.client_category = 'new';

            else if (iconName === 'alpha-a-circle-outline') booking.client_category = 'A';

            else if (iconName === 'account-remove-outline') booking.client_category = 'blocked';

            else if (iconName === 'cancel') booking.client_category = 'cancelled';

            else booking.client_category = null;

          }

        }

        

        // Извлекаем booking status icon и color

        const statusIcon = cells[2]?.querySelector('i');

        if (statusIcon) {

          const iconName = statusIcon.className.match(/mdi-([a-z0-9-]+)/)?.[1] || null;

          booking.booking_status_icon = iconName;

          const textColor = statusIcon.className.match(/(primary|success|error|warning|secondary)--text/)?.[1] || null;

          booking.booking_status_color = textColor || 'primary';

        }

        

        // Извлекаем responsible status и color

        const responsibleIcon = cells[13]?.querySelector('i');

        if (responsibleIcon) {

          const iconName = responsibleIcon.className.match(/mdi-([a-z0-9-]+)/)?.[1] || null;

          booking.responsible_icon = iconName;

          const textColor = responsibleIcon.className.match(/(success|secondary|error|warning)--text/)?.[1] || null;

          booking.responsible_color = textColor || 'secondary';

          

          if (iconName === 'account-check') booking.responsible_status = 'assigned';

          else if (iconName === 'account-question') booking.responsible_status = 'not_assigned';

          else booking.responsible_status = null;

        }

        

        // Определяем payment status и balance

        const paymentText = booking.payment;

        if (paymentText === 'Оплачено') {

          booking.payment_status = 'paid';

          booking.payment_balance = 0;

        } else if (paymentText === 'Не оплачено') {

          booking.payment_status = 'unpaid';

          booking.payment_balance = null;

        } else if (paymentText?.startsWith('+')) {

          booking.payment_status = 'overpaid';

          booking.payment_balance = parseFloat(paymentText.replace(/[+\s]/g, '')) || 0;

        } else if (paymentText?.startsWith('-') || paymentText === '0') {

          booking.payment_status = 'underpaid';

          booking.payment_balance = parseFloat(paymentText.replace(/[-\s]/g, '')) || 0;

        } else {

          booking.payment_status = null;

          booking.payment_balance = null;

        }

        

        // Извлекаем booking_id из ссылки

        const link = row.querySelector('a[href*="/bookings/"]');

        if (link) {

          // @ts-ignore - код выполняется в браузере

          booking.detail_url = (link as any).href;

          booking.booking_id = booking.detail_url.match(/\/bookings\/(\d+)/)?.[1] || null;

        }

        

        bookings.push(booking);

      });

      

      return bookings;

    });

    

    // Переключаемся на неактивные брони

    const inactiveTab = await page.$('button:has-text("Неактивные брони")');

    if (inactiveTab) {

      await inactiveTab.click();

      await page.waitForTimeout(2000);

      await page.waitForLoadState('networkidle');

    }

    

    // Парсим неактивные брони

    const inactiveBookings = await page.evaluate(() => {

      // @ts-ignore - код выполняется в браузере

      const rows = Array.from(document.querySelectorAll('table tbody tr'));

      const bookings: any[] = [];

      

      rows.forEach((row: any) => {

        const cells = (row as any).querySelectorAll('td');

        if (cells.length < 13) return;

        

        // В неактивных бронях нет колонки "Сост." в начале

        const booking: any = {

          number: cells[0]?.textContent?.trim() || null,

          created: cells[1]?.textContent?.trim() || null,

          client_status_html: cells[2]?.innerHTML || null,

          payment: cells[3]?.textContent?.trim() || null,

          car_name: cells[4]?.textContent?.trim() || null,

          client_name: cells[5]?.textContent?.trim() || null,

          start_date: cells[6]?.textContent?.trim() || null,

          end_date: cells[7]?.textContent?.trim() || null,

          days: cells[8]?.textContent?.trim() || null,

          issue_location: cells[9]?.textContent?.trim() || null,

          return_location: cells[10]?.textContent?.trim() || null,

          notes: cells[11]?.textContent?.trim() || null,

          responsible_html: cells[12]?.innerHTML || null,

          responsible: cells[12]?.textContent?.trim() || null,

        };

        

        // Аналогичная обработка payment, client status, responsible

        const paymentBtn = cells[3]?.querySelector('button');

        if (paymentBtn) {

          const classes = paymentBtn.className;

          booking.payment_color = classes.match(/(success|error|warning|disabled|outlined)/)?.[1] || null;

        }

        

        const clientStatusBtn = cells[2]?.querySelector('button');

        if (clientStatusBtn) {

          const icon = clientStatusBtn.querySelector('i');

          if (icon) {

            const iconName = icon.className.match(/mdi-([a-z0-9-]+)/)?.[1] || null;

            booking.client_status_icon = iconName;

            const textColor = icon.className.match(/(light-blue|green|primary)--text/)?.[1] || null;

            booking.client_status_color = textColor;

            

            if (iconName === 'new-box') booking.client_category = 'new';

            else if (iconName === 'alpha-a-circle-outline') booking.client_category = 'A';

            else if (iconName === 'account-remove-outline') booking.client_category = 'blocked';

            else if (iconName === 'cancel') booking.client_category = 'cancelled';

          }

        }

        

        const responsibleIcon = cells[12]?.querySelector('i');

        if (responsibleIcon) {

          const iconName = responsibleIcon.className.match(/mdi-([a-z0-9-]+)/)?.[1] || null;

          booking.responsible_icon = iconName;

          const textColor = responsibleIcon.className.match(/(success|secondary)--text/)?.[1] || null;

          booking.responsible_color = textColor || 'secondary';

          

          if (iconName === 'account-check') booking.responsible_status = 'assigned';

          else if (iconName === 'account-question') booking.responsible_status = 'not_assigned';

        }

        

        const paymentText = booking.payment;

        if (paymentText === 'Оплачено') {

          booking.payment_status = 'paid';

          booking.payment_balance = 0;

        } else if (paymentText === 'Не оплачено') {

          booking.payment_status = 'unpaid';

          booking.payment_balance = null;

        } else if (paymentText?.startsWith('+')) {

          booking.payment_status = 'overpaid';

          booking.payment_balance = parseFloat(paymentText.replace(/[+\s]/g, '')) || 0;

        } else if (paymentText?.startsWith('-') || paymentText === '0') {

          booking.payment_status = 'underpaid';

          booking.payment_balance = parseFloat(paymentText.replace(/[-\s]/g, '')) || 0;

        }

        

        const link = row.querySelector('a[href*="/bookings/"]');

        if (link) {

          // @ts-ignore - код выполняется в браузере

          booking.detail_url = (link as any).href;

          booking.booking_id = booking.detail_url.match(/\/bookings\/(\d+)/)?.[1] || null;

        }

        

        booking.is_active = false;

        bookings.push(booking);

      });

      

      return bookings;

    });

    

    // Помечаем активные брони

    activeBookings.forEach((b: any) => { b.is_active = true; });

    

    // Парсим даты из русского формата

    const parseRussianDate = (dateStr: string | null): string | null => {

      if (!dateStr) return null;

      try {

        const date = parseDateFromRussian(dateStr);

        return date.toISOString();

      } catch {

        return null;

      }

    };

    

    // Обрабатываем все брони

    [...activeBookings, ...inactiveBookings].forEach((booking: any) => {

      booking.created_at = parseRussianDate(booking.created);

      booking.start_at = parseRussianDate(booking.start_date);

      booking.end_at = parseRussianDate(booking.end_date);

      booking.days = booking.days ? parseFloat(booking.days) : null;

      booking.branch_code = branch;

    });

    

    await browser.close();

    

    res.json({

      success: true,

      branch,

      active: activeBookings,

      inactive: inactiveBookings,

      total: activeBookings.length + inactiveBookings.length

    });

  } catch (error: any) {

    if (browser) await browser.close();

    res.status(500).json({ success: false, error: error.message, branch });

  }

});



// Endpoint 6: Парсинг детальной страницы брони

app.post('/scrape-booking-details', async (req, res) => {

  const { branch, booking_id } = req.body;

  

  if (!branch || !CREDENTIALS[branch as keyof typeof CREDENTIALS] || !booking_id) {

    return res.status(400).json({ success: false, error: 'Invalid branch or booking_id' });

  }

  

  const creds = CREDENTIALS[branch as keyof typeof CREDENTIALS];

  let browser;

  

  try {

    browser = await chromium.launch({

      headless: true,

      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']

    });

    

    const page = await browser.newPage();

    

    // Логин

    await page.goto(`https://web.rentprog.ru/${branch}/login`);

    await page.fill('[name="email"]', creds.login);

    await page.fill('[name="password"]', creds.password);

    await page.click('button[type="submit"]');

    await page.waitForNavigation();

    

    // Переход на детальную страницу брони

    await page.goto(`https://web.rentprog.ru/bookings/${booking_id}`);

    await page.waitForLoadState('networkidle');

    await page.waitForTimeout(2000);

    

    // Парсим все данные со страницы

    const details = await page.evaluate(() => {

      // @ts-ignore - код выполняется в браузере

      // Здесь нужно будет добавить парсинг всех полей детальной страницы

      // Пока возвращаем базовую структуру

      return {

        // @ts-ignore

        booking_id: window.location.pathname.match(/\/bookings\/(\d+)/)?.[1] || null,

        // TODO: Добавить парсинг всех полей детальной страницы

        // @ts-ignore

        raw_html: document.body.innerHTML.substring(0, 5000) // Для отладки

      };

    });

    

    await browser.close();

    

    res.json({ success: true, branch, booking_id, details });

  } catch (error: any) {

    if (browser) await browser.close();

    res.status(500).json({ success: false, error: error.message, branch, booking_id });

  }

});



// Endpoint 7: Парсинг курсов KoronaPay
app.post('/scrape-koronapay-rates', async (req, res) => {
  let browser;
  
  try {
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-blink-features=AutomationControlled']
    });
    
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1280, height: 720 }
    });

    const page = await context.newPage();
    
    // Переход на страницу переводов
    await page.goto('https://koronapay.com/transfers/', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(5000); // Ждем загрузки React и рендеринга
    
    // Парсим курс
    const rates = await page.evaluate(async () => {
      // @ts-ignore
      const result: { paymentRate: number | null; returnRate: number | null; error?: string; debug_title?: string; debug_text?: string } = {
        paymentRate: null,
        returnRate: null
      };
      
      try {
        // Отладка: сохраняем заголовок и текст
        // @ts-ignore
        result.debug_title = document.title;
        // @ts-ignore
        result.debug_text = document.body.innerText ? document.body.innerText.substring(0, 1000) : 'No text';

        // Вариант 1: Поиск в тексте страницы (самый простой и надежный если есть текст)
        // Ищем "1 GEL = X.XX RUB" или "X.XX RUB" рядом с GEL
        // @ts-ignore
        const bodyText = document.body.textContent || '';
        
        // Паттерны для поиска курса
        // Примеры: "1 GEL ≈ 35.50 RUB", "Курс конвертации: 35.50", "35.50 ₽"
        // Но на короне обычно надо вводить суммы.
        
        // Попробуем найти инпуты и заполнить их, если их нет в HTML сразу
        // Но evaluate - это синхронный (в контексте страницы) код (если не async), но мы не можем вызывать page methods внутри evaluate.
        // Поэтому мы просто анализируем то что есть.
        
        // Если мы на странице, попробуем найти то, что похоже на курс
        
        // Вариант 4 из прошлого кода:
        const rubMatch = bodyText.match(/1\s*(GEL|лари|₾)\s*[=≈]\s*(\d+[.,]\d+)\s*(RUB|руб|₽)/i);
        if (rubMatch) {
             result.paymentRate = parseFloat(rubMatch[2].replace(',', '.'));
        }
        
        // Если не нашли в тексте, попробуем найти в __NEXT_DATA__
        // @ts-ignore
        if (!result.paymentRate && window.__NEXT_DATA__) {
          // @ts-ignore
          const nextData = window.__NEXT_DATA__;
          const searchForRates = (obj: any, depth = 0): number | null => {
            if (depth > 10) return null;
            if (typeof obj === 'number' && obj > 20 && obj < 100) return obj; // Курс примерно 30-40
            if (typeof obj === 'object' && obj !== null) {
              for (const [key, value] of Object.entries(obj)) {
                 // Ищем ключи типа 'rate', 'exchange', 'course'
                 if (key.toLowerCase().includes('rate') && typeof value === 'number' && value > 20 && value < 100) {
                     return value;
                 }
                 const found = searchForRates(value, depth + 1);
                 if (found) return found;
              }
            }
            return null;
          };
          result.paymentRate = searchForRates(nextData);
        }
        
        if (!result.paymentRate) {
            result.error = 'Rate not found';
        } else {
            result.returnRate = result.paymentRate; // Пока так
        }
        
      } catch (e: any) {
        result.error = e.message;
      }
      
      return result;
    });
    
    await browser.close();
    
    if (rates.error || !rates.paymentRate) {
      return res.status(500).json({ 
        success: false, 
        error: rates.error || 'Exchange rate not found',
        debug_title: rates.debug_title,
        debug_text: rates.debug_text
      });
    }
    
    res.json({
      success: true,
      paymentRate: rates.paymentRate,
      returnRate: rates.returnRate || rates.paymentRate,
      parsedAt: new Date().toISOString()
    });
    
  } catch (error: any) {
    if (browser) await browser.close();
    res.status(500).json({ success: false, error: error.message });
  }
});

// Health check

app.get('/health', (req, res) => {

  res.json({ status: 'ok', service: 'playwright-service' });

});



const PORT = process.env.PLAYWRIGHT_PORT || 3001;

app.listen(PORT, () => {

  console.log(`🎭 Playwright service running on port ${PORT}`);

});



