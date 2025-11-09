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
        .filter(btn => btn.textContent?.includes('GEL <->'));
      
      for (const button of buttons) {
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
        const panel = button.parentElement;
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

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'playwright-service' });
});

const PORT = process.env.PLAYWRIGHT_PORT || 3001;
app.listen(PORT, () => {
  console.log(`🎭 Playwright service running on port ${PORT}`);
});

