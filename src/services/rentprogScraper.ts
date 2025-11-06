/**
 * RentProg UI Scraper через HTTP запросы (без Playwright)
 * Быстрее, легче, надежнее
 * 
 * Кеширование cookies: один раз логинимся, cookie живет долго (недели)
 */

import axios, { AxiosInstance } from 'axios';
import * as cheerio from 'cheerio';
import { wrapper } from 'axios-cookiejar-support';
import { CookieJar } from 'tough-cookie';

type Branch = 'tbilisi' | 'batumi' | 'kutaisi' | 'service-center';

interface Credentials {
  login: string;
  password: string;
}

const CREDENTIALS: Record<Branch, Credentials> = {
  'tbilisi': { 
    login: 'eliseevaleksei32@gmail.com', 
    password: 'a0babuz0' 
  },
  'batumi': { 
    login: 'ceo@geodrive.rent', 
    password: 'a6wumobt' 
  },
  'kutaisi': { 
    login: 'geodrivekutaisi2@gmail.com', 
    password: '8fia8mor' 
  },
  'service-center': { 
    login: 'sofia2020eliseeva@gmail.com', 
    password: 'x2tn7hks' 
  }
};

/**
 * Кеш HTTP клиентов с cookies по филиалам
 * Один раз логинимся - переиспользуем cookie
 */
const clientCache: Map<Branch, AxiosInstance> = new Map();

interface Payment {
  branch: string;
  paymentDate: string;
  employeeName: string;
  paymentType: string;
  paymentMethod: string;
  amount: number;
  currency: string;
  comment: string;
  rawData: {
    date: string;
    employee: string;
    type: string;
    method: string;
    amount: string;
    currency: string;
    comment: string;
  };
}


/**
 * Получить или создать HTTP клиент с авторизацией для филиала
 * Клиент кешируется с cookies - авторизация только один раз!
 */
async function getAuthenticatedClient(branch: Branch, forceLogin = false): Promise<AxiosInstance> {
  // Проверяем кеш
  if (!forceLogin && clientCache.has(branch)) {
    console.log(`♻️ Reusing cached session for ${branch}`);
    return clientCache.get(branch)!;
  }
  
  // Создаем новый клиент
  const jar = new CookieJar();
  const client = wrapper(axios.create({
    jar,
    timeout: 30000,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'ru-RU,ru;q=0.9,en;q=0.8',
    },
    maxRedirects: 5,
    validateStatus: (status) => status < 500,
  }));
  
  // Логинимся
  const creds = CREDENTIALS[branch];
  const loginUrl = 'https://web.rentprog.ru/signin?from=%2Fcompany_counts';
  
  console.log(`🔐 Logging in to ${branch}...`);
  
  try {
    // 1. Получить страницу логина
    const getResponse = await client.get(loginUrl);
    console.log(`📄 GET ${loginUrl} -> Status: ${getResponse.status}`);
    
    // 2. Извлечь CSRF token
    const $ = cheerio.load(getResponse.data);
    const csrfToken = $('input[name="_csrf"]').val() || 
                      $('meta[name="csrf-token"]').attr('content');
    console.log(`🔑 CSRF token found: ${csrfToken ? 'YES' : 'NO'}`);
    
    // 3. Отправить форму
    const formData = new URLSearchParams();
    formData.append('email', creds.login);
    formData.append('password', creds.password);
    if (csrfToken) {
      formData.append('_csrf', csrfToken as string);
    }
    
    console.log(`📤 Posting login form for: ${creds.login}`);
    const postResponse = await client.post(loginUrl, formData, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Referer': loginUrl,
      },
    });
    
    // 4. Проверить успех
    const finalUrl = postResponse.request?.res?.responseUrl || postResponse.config.url;
    console.log(`📍 Final URL: ${finalUrl}, Status: ${postResponse.status}`);
    const isSuccess = !finalUrl?.includes('/signin');
    
    if (!isSuccess) {
      // Сохраним HTML для диагностики
      console.log(`❌ Login failed. Response body (first 500 chars):`);
      console.log(typeof postResponse.data === 'string' ? postResponse.data.substring(0, 500) : JSON.stringify(postResponse.data).substring(0, 500));
      throw new Error(`Login failed: redirected back to login page (${finalUrl})`);
    }
    
    console.log(`✅ Logged in to ${branch} successfully, cookie cached`);
    
    // Кешируем клиент с cookies
    clientCache.set(branch, client);
    
    return client;
    
  } catch (error) {
    console.error(`❌ Login error for ${branch}:`, error);
    throw error;
  }
}

/**
 * Парсинг страницы кассы компании
 */
export async function scrapeCompanyCash(branch: Branch): Promise<{ success: boolean; payments: Payment[] }> {
  try {
    // Получаем авторизованный клиент (с кешированной cookie)
    const client = await getAuthenticatedClient(branch);
    
    // Получить страницу кассы
    console.log(`💰 Fetching company cash page for ${branch}...`);
    const cashUrl = 'https://web.rentprog.ru/company_counts';
    const response = await client.get(cashUrl);
    
    // Если 401/403 - перелогиниться
    if (response.status === 401 || response.status === 403) {
      console.log(`🔄 Session expired, re-authenticating...`);
      const newClient = await getAuthenticatedClient(branch, true);
      const retryResponse = await newClient.get(cashUrl);
      return parseCashPage(retryResponse.data, branch);
    }
    
    return parseCashPage(response.data, branch);
    
  } catch (error) {
    console.error(`❌ Scrape error for ${branch}:`, error);
    return { success: false, payments: [] };
  }
}

/**
 * Парсинг HTML страницы кассы
 */
function parseCashPage(html: string, branch: Branch): { success: boolean; payments: Payment[] } {
  const $ = cheerio.load(html);
  const payments: Payment[] = [];
  
  // Найти таблицу и строки
  $('table tbody tr').each((index, element) => {
    try {
      const $row = $(element);
      const cells = $row.find('td');
      
      if (cells.length < 7) return;
      
      const dateText = $(cells[0]).text().trim();
      const employeeText = $(cells[1]).text().trim();
      const typeText = $(cells[2]).text().trim();
      const methodText = $(cells[3]).text().trim();
      const amountText = $(cells[4]).text().trim();
      const currencyText = $(cells[5]).text().trim();
      const commentText = $(cells[6]).text().trim();
      
      const amount = parseFloat(amountText.replace(/[^0-9.-]/g, '')) || 0;
      
      payments.push({
        branch: branch,
        paymentDate: dateText || '',
        employeeName: employeeText || 'unknown',
        paymentType: typeText || 'unknown',
        paymentMethod: methodText || 'unknown',
        amount: amount,
        currency: currencyText || 'GEL',
        comment: commentText || '',
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
      
    } catch (error) {
      console.error(`Error parsing row ${index}:`, error);
    }
  });
  
  console.log(`✅ Parsed ${payments.length} payments for ${branch}`);
  
  return { success: true, payments };
}

/**
 * Парсинг страницы событий
 */
export async function scrapeEvents(branch: Branch): Promise<{ success: boolean; events: any[] }> {
  try {
    const client = await getAuthenticatedClient(branch);
    
    console.log(`📋 Fetching events page for ${branch}...`);
    const eventsUrl = `https://web.rentprog.ru/${branch}/events`;
    const response = await client.get(eventsUrl);
    
    // Если 401/403 - перелогиниться
    if (response.status === 401 || response.status === 403) {
      console.log(`🔄 Session expired, re-authenticating...`);
      const newClient = await getAuthenticatedClient(branch, true);
      const retryResponse = await newClient.get(eventsUrl);
      return parseEventsPage(retryResponse.data, branch);
    }
    
    return parseEventsPage(response.data, branch);
    
  } catch (error) {
    console.error(`❌ Scrape events error for ${branch}:`, error);
    return { success: false, events: [] };
  }
}

function parseEventsPage(html: string, branch: Branch): { success: boolean; events: any[] } {
  const $ = cheerio.load(html);
  const events: any[] = [];
  
  $('table tbody tr').each((index, element) => {
    try {
      const $row = $(element);
      const cells = $row.find('td');
      
      if (cells.length < 2) return;
      
      const dateText = $(cells[0]).text().trim();
      const descriptionText = $(cells[1]).text().trim();
      
      events.push({
        timestamp: dateText,
        rawDescription: descriptionText,
        branch: branch
      });
      
    } catch (error) {
      console.error(`Error parsing event row ${index}:`, error);
    }
  });
  
  console.log(`✅ Parsed ${events.length} events for ${branch}`);
  
  return { success: true, events };
}

/**
 * Парсинг кассы конкретного сотрудника
 */
export async function scrapeEmployeeCash(
  branch: Branch, 
  employeeName: string
): Promise<{ success: boolean; realCash?: { gel: number; usd: number; eur: number } }> {
  try {
    const client = await getAuthenticatedClient(branch);
    
    console.log(`👤 Fetching employee cash for ${employeeName} in ${branch}...`);
    const employeesUrl = `https://web.rentprog.ru/${branch}/company/employees`;
    const response = await client.get(employeesUrl);
    
    // Если 401/403 - перелогиниться
    if (response.status === 401 || response.status === 403) {
      console.log(`🔄 Session expired, re-authenticating...`);
      const newClient = await getAuthenticatedClient(branch, true);
      const retryResponse = await newClient.get(employeesUrl);
      return parseEmployeeCash(retryResponse.data, employeeName);
    }
    
    return parseEmployeeCash(response.data, employeeName);
    
  } catch (error) {
    console.error(`❌ Scrape employee cash error:`, error);
    return { success: false };
  }
}

function parseEmployeeCash(html: string, employeeName: string): { success: boolean; realCash?: { gel: number; usd: number; eur: number } } {
  const $ = cheerio.load(html);
  
  let cashGel = 0;
  let cashUsd = 0;
  let cashEur = 0;
  
  // Найти строку с сотрудником и извлечь кассу
  // (структура может отличаться, нужно адаптировать под реальную страницу)
  $('table tbody tr').each((index, element) => {
    const $row = $(element);
    const name = $row.find('td:nth-child(1)').text().trim();
    
    if (name === employeeName) {
      cashGel = parseFloat($row.find('[data-currency="GEL"]').text()) || 0;
      cashUsd = parseFloat($row.find('[data-currency="USD"]').text()) || 0;
      cashEur = parseFloat($row.find('[data-currency="EUR"]').text()) || 0;
    }
  });
  
  console.log(`✅ Employee cash: GEL ${cashGel}, USD ${cashUsd}, EUR ${cashEur}`);
  
  return {
    success: true,
    realCash: { gel: cashGel, usd: cashUsd, eur: cashEur }
  };
}

