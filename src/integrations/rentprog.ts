/**
 * Интеграция с RentProg API v1
 * Поддержка multi-branch аутентификации и пагинации
 */

import axios, { AxiosInstance, AxiosError } from 'axios';
import crypto from 'crypto';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

// Типы филиалов
export type BranchName = 'tbilisi' | 'batumi' | 'kutaisi' | 'service-center';

// Консервативные задержки для совместного использования RentProg API с другими сервисами
// Используем ~33% от лимитов RentProg, оставляя 66% для других сервисов компании
const DELAY_BETWEEN_GET_REQUESTS = 1500;  // 1.5 сек = 40 запросов/мин (лимит RentProg: 120/мин)
const DELAY_BETWEEN_POST_REQUESTS = 3000; // 3 сек = 20 запросов/мин (лимит RentProg: 60/мин)

// Кэш токенов по филиалам
interface TokenCache {
  token: string;
  expiresAt: Date;
}

const tokenCache: Map<BranchName, TokenCache> = new Map();

/**
 * Парсинг JSON конфигурации с fallback и улучшенной обработкой ошибок
 */
function parseJsonConfig<T>(jsonStr: string | undefined, defaultVal: T): T {
  if (!jsonStr) {
    logger.warn('JSON config string is empty');
    return defaultVal;
  }
  
  // Убираем лишние пробелы и экранирование
  const cleaned = jsonStr.trim();
  if (!cleaned) {
    logger.warn('JSON config string is empty after trim');
    return defaultVal;
  }
  
  try {
    const parsed = JSON.parse(cleaned) as T;
    logger.debug('JSON config parsed successfully');
    return parsed;
  } catch (error) {
    logger.error(`Failed to parse JSON config: ${error instanceof Error ? error.message : 'Unknown error'}`);
    logger.debug(`JSON string was: ${cleaned.substring(0, 200)}${cleaned.length > 200 ? '...' : ''}`);
    return defaultVal;
  }
}

/**
 * Получение ключей филиалов
 */
function getBranchKeys(): Record<BranchName, string> {
  const emptyKeys: Record<BranchName, string> = {
    tbilisi: '',
    batumi: '',
    kutaisi: '',
    'service-center': '',
  };
  
  if (!config.rentprogBranchKeys) {
    logger.error('RENTPROG_BRANCH_KEYS не установлен в конфигурации');
    throw new Error('RENTPROG_BRANCH_KEYS: отсутствует в конфигурации');
  }
  
  const keys = parseJsonConfig<Record<BranchName, string>>(config.rentprogBranchKeys, emptyKeys);
  const requiredBranches: BranchName[] = ['tbilisi', 'batumi', 'kutaisi', 'service-center'];
  
  for (const branch of requiredBranches) {
    if (!keys[branch] || keys[branch].trim() === '') {
      logger.error(`RENTPROG_BRANCH_KEYS: отсутствует или пустой ключ для филиала ${branch}`);
      throw new Error(`RENTPROG_BRANCH_KEYS: отсутствует ключ для филиала ${branch}`);
    }
  }
  
  logger.debug('All branch keys loaded successfully');
  return keys;
}


/**
 * Получение временного токена для филиала
 * Обменивает company token на request token
 * Возвращает объект с токеном и временем истечения
 */
async function getBranchTokenWithExpiry(branchKey: string): Promise<{ token: string; expiresAt: Date }> {
  const baseUrl = config.rentprogBaseUrl || 'https://rentprog.net/api/v1/public';
  const authUrl = `${baseUrl}/get_token?company_token=${branchKey}`;
  
  logger.debug(`Получаю токен для филиала через: ${baseUrl}/get_token`);
  
  try {
    const response = await axios.get<{ token: string; exp: string }>(authUrl, {
      timeout: config.rentprogTimeoutMs || 10000,
    });

    if (!response.data.token) {
      throw new Error('Токен не получен в ответе API');
    }

    const expiresAt = new Date(response.data.exp);
    // Сохраняем в кэш с запасом 5 секунд для безопасности
    expiresAt.setSeconds(expiresAt.getSeconds() - 5);
    
    logger.debug(`Токен получен, истекает: ${expiresAt.toISOString()}`);
    
    return {
      token: response.data.token,
      expiresAt,
    };
  } catch (error) {
    const axiosError = error as AxiosError;
    
    if (axiosError.response) {
      logger.error(
        `Ошибка получения токена: ${axiosError.response.status} ${axiosError.response.statusText}`,
        {
          status: axiosError.response.status,
          data: axiosError.response.data,
          url: authUrl.replace(branchKey, '***'),
        }
      );
    } else {
      logger.error(`Ошибка получения токена для филиала: ${axiosError.message}`, {
        url: authUrl.replace(branchKey, '***'),
      });
    }
    
    if (axiosError.response?.status === 401) {
      throw new Error('Неверный company token (401 Unauthorized)');
    }
    if (axiosError.response?.status === 429) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      throw new Error('Rate limit exceeded (429), попробуйте позже');
    }
    
    throw error;
  }
}

/**
 * Получение токена для филиала (с кэшированием и авто-refresh)
 */
export async function getCachedBranchToken(branch: BranchName): Promise<string> {
  const cached = tokenCache.get(branch);
  const now = new Date();
  
  // Если токен валиден, возвращаем из кэша
  if (cached && cached.expiresAt > now) {
    logger.debug(`Используем кэшированный токен для филиала ${branch}`);
    return cached.token;
  }
  
  logger.info(`Получаю новый токен для филиала ${branch}...`);
  
  try {
    // Получаем ключ филиала
    const keys = getBranchKeys();
    const branchKey = keys[branch];
    
    if (!branchKey || branchKey.trim() === '') {
      throw new Error(`Ключ для филиала ${branch} пустой`);
    }
    
    logger.debug(`Использую company token для филиала ${branch} (первые 10 символов: ${branchKey.substring(0, 10)}...)`);
    
    // Получаем новый токен с временем истечения
    const { token, expiresAt } = await getBranchTokenWithExpiry(branchKey);
    
    // Кэшируем токен
    tokenCache.set(branch, { token, expiresAt });
    
    logger.info(`Токен для филиала ${branch} получен и кэширован до ${expiresAt.toISOString()}`);
    
    return token;
  } catch (error) {
    logger.error(`Ошибка получения токена для филиала ${branch}:`, error);
    throw error;
  }
}

/**
 * Выполнение API запроса для филиала
 */
export async function apiFetch<T>(
  branch: BranchName,
  path: string,
  params?: Record<string, unknown>
): Promise<T> {
  const baseUrl = config.rentprogBaseUrl || 'https://rentprog.net/api/v1/public';
  const token = await getCachedBranchToken(branch);
  const url = `${baseUrl}${path}`;
  
  const maxRetries = 3;
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await axios.get<T>(url, {
        params,
        headers: {
          Authorization: `Bearer ${token}`,
        },
        timeout: config.rentprogTimeoutMs || 10000,
      });
      
      return response.data;
    } catch (error) {
      const axiosError = error as AxiosError;
      lastError = error as Error;
      
      // При 401 обновляем токен и повторяем
      if (axiosError.response?.status === 401 && attempt < maxRetries) {
        tokenCache.delete(branch); // Инвалидируем кэш
        await new Promise(resolve => setTimeout(resolve, 250 * attempt)); // Backoff
        continue;
      }
      
      // При 429 ждем дольше
      if (axiosError.response?.status === 429 && attempt < maxRetries) {
        const retryAfter = parseInt(axiosError.response.headers['retry-after'] || '60', 10);
        await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
        continue;
      }
      
      // Для других ошибок - экспоненциальный backoff
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 250 * Math.pow(2, attempt - 1)));
        continue;
      }
    }
  }
  
  throw lastError || new Error('Ошибка API запроса после всех попыток');
}

/**
 * Пагинированная загрузка данных
 */
export async function paginate<T>(
  branch: BranchName,
  path: string,
  params?: Record<string, unknown>
): Promise<T[]> {
  const pageLimit = config.rentprogPageLimit || 20;
  const results: T[] = [];
  let page = 1;
  let hasMore = true;
  
  // Определяем параметр пагинации: per_page для /all_bookings, limit для остальных
  // Если per_page явно передан в params, используем его, иначе используем pageLimit
  const usePerPage = path.includes('/all_bookings') || params?.per_page !== undefined;
  const pageSize = params?.per_page !== undefined ? params.per_page : pageLimit;
  
  while (hasMore) {
    try {
      const paginationParam = usePerPage 
        ? { per_page: pageSize }
        : { limit: pageSize };
      
      const pageData = await apiFetch<T[]>(branch, path, {
        ...params,
        page,
        ...paginationParam,
      });
      
      // Проверяем, что получили массив
      if (!pageData) {
        logger.warn(`[Paginate ${path}] ${branch}: Пустой ответ на странице ${page}`);
        hasMore = false;
        break;
      }
      
      // Обрабатываем разные форматы ответа
      let items: T[] = [];
      if (Array.isArray(pageData)) {
        items = pageData;
      } else if (pageData && typeof pageData === 'object' && 'data' in pageData && Array.isArray((pageData as any).data)) {
        items = (pageData as any).data;
      } else {
        logger.warn(`[Paginate ${path}] ${branch}: Неожиданный формат ответа на странице ${page}`);
        hasMore = false;
        break;
      }
      
      // Если получили 0 записей, значит страниц больше нет
      if (items.length === 0) {
        logger.info(`[Paginate ${path}] ${branch}: Страница ${page} пуста, завершение пагинации`);
        hasMore = false;
        break;
      }
      
      results.push(...items);
      
      // Логируем прогресс на каждой странице для /all_bookings, иначе каждые 5 страниц
      if (path.includes('/all_bookings') || page === 1 || page % 5 === 0) {
        logger.info(`[Paginate ${path}] ${branch}: Страница ${page} - получено ${items.length} записей, всего ${results.length}`);
      }
      
      // Определяем, есть ли еще страницы
      // ВАЖНО: API /all_bookings может игнорировать per_page и всегда возвращать 10
      // Поэтому продолжаем, пока получаем 10 записей, останавливаемся при < 10
      const isLastPage = items.length < 10; // Если получили меньше 10, значит страниц больше нет
      
      if (isLastPage) {
        hasMore = false;
        logger.info(`[Paginate ${path}] ${branch}: Последняя страница (получено ${items.length}, меньше 10)`);
      } else {
        // Получили полную страницу - продолжаем
        page++;
        // Защита от бесконечного цикла
        // Для /all_bookings увеличиваем лимит, так как может быть 3000+ бронирований (300+ страниц)
        const maxPages = path.includes('/all_bookings') ? 500 : 1000;
        if (page > maxPages) {
          logger.warn(`[Paginate ${path}] ${branch}: Достигнут максимум страниц (${maxPages}), остановка`);
          hasMore = false;
        } else {
          // Задержка между страницами для соблюдения консервативных лимитов
          // Используем ~33% capacity RentProg, оставляя 66% для других сервисов компании
          logger.debug(`[Paginate ${path}] ${branch}: Задержка ${DELAY_BETWEEN_GET_REQUESTS}ms перед страницей ${page}`);
          await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_GET_REQUESTS));
        }
      }
    } catch (error) {
      logger.error(`Ошибка пагинации для ${path}, страница ${page}:`, error);
      hasMore = false;
    }
  }
  
  logger.info(`[Paginate ${path}] ${branch}: Загрузка завершена, всего ${results.length} записей`);
  return results;
}

/**
 * Health check для конкретного филиала
 */
export async function healthCheckBranch(branch: BranchName): Promise<{ ok: boolean; error?: string }> {
  try {
    // Пробуем получить список автомобилей (легкий запрос)
    await apiFetch(branch, '/all_cars', { limit: 1 });
    return { ok: true };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`Health check failed for branch ${branch}:`, errorMsg);
    return { ok: false, error: errorMsg };
  }
}

/**
 * Health check для всех филиалов
 */
export async function healthCheck(): Promise<{
  ok: boolean;
  error?: string;
  perBranch: Record<BranchName, { ok: boolean; error?: string }>;
}> {
  const branches: BranchName[] = ['tbilisi', 'batumi', 'kutaisi', 'service-center'];
  const results: Record<BranchName, { ok: boolean; error?: string }> = {} as Record<
    BranchName,
    { ok: boolean; error?: string }
  >;
  
  // Параллельная проверка всех филиалов
  const checks = await Promise.all(
    branches.map(async (branch) => {
      const result = await healthCheckBranch(branch);
      return { branch, result };
    })
  );
  
  let allOk = true;
  for (const { branch, result } of checks) {
    results[branch] = result;
    if (!result.ok) {
      allOk = false;
    }
  }
  
  return {
    ok: allOk,
    perBranch: results,
  };
}

/**
 * Старая функция для обратной совместимости
 */
export async function getAuthToken(apiKey: string): Promise<string> {
  const { token } = await getBranchTokenWithExpiry(apiKey);
  return token;
}

/**
 * Старая функция для обратной совместимости
 */
export async function paginateList<T>(endpoint: string, token: string): Promise<T[]> {
  logger.warn('paginateList использует устаревший API, используйте paginate()');
  // Для обратной совместимости пробуем определить филиал из токена (не оптимально)
  const branches: BranchName[] = ['tbilisi', 'batumi', 'kutaisi', 'service-center'];
  for (const branch of branches) {
    try {
      const keys = getBranchKeys();
      if (keys[branch] === token.substring(0, keys[branch].length)) {
        return paginate(branch, endpoint);
      }
    } catch {
      // Игнорируем ошибки
    }
  }
  return [];
}

/**
 * Старая функция для обратной совместимости
 */
export async function checkRentProgHealth(): Promise<boolean> {
  const health = await healthCheck();
  return health.ok;
}
