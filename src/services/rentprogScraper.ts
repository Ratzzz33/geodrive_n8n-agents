/**
 * RentProg API Client с Bearer токенами
 * Прямые API запросы без парсинга HTML
 * 
 * Токены действительны до: 2025-12-02
 */

type Branch = 'tbilisi' | 'batumi' | 'kutaisi' | 'service-center';

/**
 * Bearer токены для каждого филиала
 * Срок действия: до 2025-12-02
 */
const TOKENS: Record<Branch, string> = {
  'service-center': 'Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxNjA0NSIsInNjcCI6InVzZXIiLCJhdWQiOm51bGwsImlhdCI6MTc2MjQ1OTM4MSwiZXhwIjoxNzY1MDUxMzgxLCJqdGkiOiI4ZDdkYjYyNi1jNWJiLTQ0MWMtYTNlMy00YjQwOWFmODQ1NmUifQ.32BRzttLFFgOgMv-VusAXK8mmyvrk4X-pb_rHQHSFbw',
  'tbilisi': 'Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxNjA0NiIsInNjcCI6InVzZXIiLCJhdWQiOm51bGwsImlhdCI6MTc2MjQ1OTY2MCwiZXhwIjoxNzY1MDUxNjYwLCJqdGkiOiIxOTFjMDY4ZS1jOGNhLTQ4OWEtODk0OS1iMjJkMmUzODE2ZDIifQ.G4_I4D96Flv4rP3JwjwDPpEHaH6ShSb0YRRQG8PasXk',
  'batumi': 'Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxNjA0OCIsInNjcCI6InVzZXIiLCJhdWQiOm51bGwsImlhdCI6MTc2MjQ2MDAyNSwiZXhwIjoxNzY1MDUyMDI1LCJqdGkiOiI0ZmQ2ODE4Yy0zYWNiLTRmZmQtOGZmYS0wZWMwZDkyMmIyMzgifQ.16s2ruRb3x_S7bgy4zF7TW9dSQ3ITqX3kei8recyH_8',
  'kutaisi': 'Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxNjA0OSIsInNjcCI6InVzZXIiLCJhdWQiOm51bGwsImlhdCI6MTc2MjQ2MDE3MiwiZXhwIjoxNzY1MDUyMTcyLCJqdGkiOiJmNzE1NGQ3MC0zZWFmLTRiNzItYTI3Ni0yZTg3MmQ4YjA0YmQifQ.1vd1kNbWB_qassLVqoxgyRsRJwtPsl7OR28gVsCxmwY'
};

/**
 * Общие заголовки для всех API запросов
 */
function getHeaders(branch: Branch): Record<string, string> {
  return {
    'accept': 'application/json, text/plain, */*',
    'authorization': TOKENS[branch],
    'origin': 'https://web.rentprog.ru',
    'referer': 'https://web.rentprog.ru/',
    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36'
  };
}

/**
 * Форматирование даты в YYYY-MM-DD
 */
function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Интерфейс для платежа
 */
interface Payment {
  branch: string;
  paymentDate: string;
  employeeName: string;
  paymentType: string;
  paymentMethod: string;
  amount: number;
  currency: string;
  comment: string;
  rawData: any;
}

/**
 * Получить кассу пользователя через API
 */
export async function getUserCashbox(branch: Branch) {
  const url = 'https://rentprog.net/api/v1/user_cashbox';
  
  console.log(`💰 Fetching user cashbox for ${branch}...`);
  
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: getHeaders(branch)
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    console.log(`✅ User cashbox for ${branch}:`, data);
    
    return {
      success: true,
      branch,
      data
    };
    
  } catch (error) {
    console.error(`❌ Error fetching user cashbox for ${branch}:`, error);
    return {
      success: false,
      branch,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Получить кассу компании за период через API
 */
export async function getCompanyCounts(
  branch: Branch,
  dateFrom?: Date,
  dateTo?: Date
) {
  // По умолчанию: последние 30 дней
  const endDate = dateTo || new Date();
  const startDate = dateFrom || new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);
  
  const startDateStr = formatDate(startDate);
  const endDateStr = formatDate(endDate);
  
  const url = `https://rentprog.net/api/v1/company_counts_v2?start_date=${startDateStr}&end_date=${endDateStr}`;
  
  console.log(`💰 Fetching company counts for ${branch} (${startDateStr} to ${endDateStr})...`);
  
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: getHeaders(branch)
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const json: any = await response.json();
    // RentProg API возвращает {counts: {data: [...], totalcount: {...}, workers: [...]}}
    const data = json.counts || json;
    
    console.log(`✅ Company counts for ${branch}: ${data.data?.length || 0} transactions`);
    
    return {
      success: true,
      branch,
      startDate: startDateStr,
      endDate: endDateStr,
      data
    };
    
  } catch (error) {
    console.error(`❌ Error fetching company counts for ${branch}:`, error);
    return {
      success: false,
      branch,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Парсинг данных кассы компании в формат платежей
 * (для обратной совместимости с существующим кодом)
 */
export async function scrapeCompanyCash(branch: Branch): Promise<{ success: boolean; payments: Payment[] }> {
  try {
    const result = await getCompanyCounts(branch);
    
    if (!result.success) {
      return { success: false, payments: [] };
    }
    
    // Преобразуем данные API в формат Payment
    const payments: Payment[] = [];
    
    // RentProg возвращает {counts: {data: [...], totalcount: {...}}}
    // result.data уже это counts объект
    const dataArray: any = result.data.data;
    if (dataArray && Array.isArray(dataArray)) {
      for (const item of dataArray) {
        const attrs = item.attributes || {};
        payments.push({
          branch: branch,
          paymentDate: attrs.created_at || '',
          employeeName: attrs.source || 'unknown',
          paymentType: attrs.group || 'unknown',
          paymentMethod: attrs.cash ? 'cash' : attrs.cashless ? 'cashless' : attrs.cash_card ? 'card' : 'unknown',
          amount: parseFloat(attrs.sum) || 0,
          currency: attrs.currency_id === 39 ? 'GEL' : attrs.currency_id === 1 ? 'USD' : attrs.currency_id === 3 ? 'EUR' : 'unknown',
          comment: attrs.description || '',
          rawData: attrs
        });
      }
    }
    
    console.log(`✅ Parsed ${payments.length} payments for ${branch}`);
    
    return { success: true, payments };
    
  } catch (error) {
    console.error(`❌ Error scraping company cash for ${branch}:`, error);
    return { success: false, payments: [] };
  }
}

/**
 * Парсинг страницы событий (через API если есть endpoint)
 */
export async function scrapeEvents(branch: Branch): Promise<{ success: boolean; events: any[] }> {
  try {
    // TODO: Найти API endpoint для событий
    // Пока возвращаем пустой массив
    console.log(`⚠️ Events API endpoint not implemented yet for ${branch}`);
    
    return { success: true, events: [] };
    
  } catch (error) {
    console.error(`❌ Error scraping events for ${branch}:`, error);
    return { success: false, events: [] };
  }
}

/**
 * Парсинг кассы конкретного сотрудника
 */
export async function scrapeEmployeeCash(
  branch: Branch, 
  employeeName: string
): Promise<{ success: boolean; realCash?: { gel: number; usd: number; eur: number } }> {
  try {
    const userCashbox = await getUserCashbox(branch);
    
    if (!userCashbox.success) {
      return { success: false };
    }
    
    // Извлекаем данные кассы из ответа API
    const cashData: any = userCashbox.data;
    
    return {
      success: true,
      realCash: {
        gel: parseFloat(cashData?.gel || cashData?.GEL || 0),
        usd: parseFloat(cashData?.usd || cashData?.USD || 0),
        eur: parseFloat(cashData?.eur || cashData?.EUR || 0)
      }
    };
    
  } catch (error) {
    console.error(`❌ Error scraping employee cash:`, error);
    return { success: false };
  }
}
