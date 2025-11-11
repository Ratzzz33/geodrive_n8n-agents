/**
 * Сервис парсинга курсов валют из RentProg через Playwright
 */

import { chromium, Browser, Page } from 'playwright';

type BranchName = 'tbilisi' | 'batumi' | 'kutaisi' | 'service-center';

// Credentials для каждого филиала
const CREDENTIALS: Record<BranchName, { login: string; password: string }> = {
  tbilisi: { login: 'eliseevaleksei32@gmail.com', password: 'a0babuz0' },
  batumi: { login: 'ceo@geodrive.rent', password: 'a6wumobt' },
  kutaisi: { login: 'geodrivekutaisi2@gmail.com', password: '8fia8mor' },
  'service-center': { login: 'sofia2020eliseeva@gmail.com', password: 'x2tn7hks' }
};

interface ExchangeRates {
  gel_to_rub: number | null;
  gel_to_eur: number | null;
  gel_to_usd: number | null;
  rub_to_gel: number | null;
  eur_to_gel: number | null;
  usd_to_gel: number | null;
}

/**
 * Парсинг курсов валют для филиала
 */
export async function scrapeExchangeRatesForBranch(branch: BranchName): Promise<ExchangeRates> {
  const creds = CREDENTIALS[branch];
  let browser: Browser | null = null;

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
      // @ts-expect-error - DOM types available in browser context
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
        // @ts-expect-error - DOM types available in browser context
        (button as HTMLElement).click();

        // Ждём 100ms для раскрытия
        await new Promise(resolve => setTimeout(resolve, 100));

        // Ищем input в раскрытой панели
        const panel = (button as any).parentElement;
        const content = panel?.querySelector('.v-expansion-panel-content');
        // @ts-expect-error - DOM types available in browser context
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

    return {
      gel_to_rub: rates.gel_to_rub || null,
      gel_to_eur: rates.gel_to_eur || null,
      gel_to_usd: rates.gel_to_usd || null,
      rub_to_gel: rates.rub_to_gel || null,
      eur_to_gel: rates.eur_to_gel || null,
      usd_to_gel: rates.usd_to_gel || null
    };

  } catch (error) {
    if (browser) await browser.close();
    throw error;
  }
}

