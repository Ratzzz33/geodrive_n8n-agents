/**
 * Интеграция с RentProg API v1
 * Поддержка multi-branch аутентификации и пагинации
 */

import axios, { AxiosInstance, AxiosError } from 'axios';
import crypto from 'crypto';
import { config } from '../config';
import { logger } from '../utils/logger';

// Типы филиалов
export type BranchName = 'tbilisi' | 'batumi' | 'kutaisi' | 'service-center';

// Кэш токенов по филиалам
interface TokenCache {
  token: string;
  expiresAt: Date;
}

const tokenCache: Map<BranchName, TokenCache> = new Map();

/**
 * Парсинг JSON конфигурации с fallback
 */
function parseJsonConfig<T>(jsonStr: string | undefined, defaultVal: T): T {
  if (!jsonStr) return defaultVal;
  try {
    return JSON.parse(jsonStr) as T;
  } catch {
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
  
  const keys = parseJsonConfig<Record<BranchName, string>>(config.rentprogBranchKeys, emptyKeys);
  const requiredBranches: BranchName[] = ['tbilisi', 'batumi', 'kutaisi', 'service-center'];
  
  for (const branch of requiredBranches) {
    if (!keys[branch]) {
      throw new Error(`RENTPROG_BRANCH_KEYS: отсутствует ключ для филиала ${branch}`);
    }
  }
  
  return keys;
}


/**
 * Получение временного токена для филиала
 * Обменивает company token на request token с кэшированием
 */
export async function getBranchToken(branchKey: string): Promise<string> {
  const baseUrl = config.rentprogBaseUrl || 'https://rentprog.net/api/v1/public';
  const authUrl = `${baseUrl}/get_token?company_token=${branchKey}`;
  
  try {
    const response = await axios.get<{ token: string; exp: string }>(authUrl, {
      timeout: config.rentprogTimeoutMs || 10000,
    });

    const expiresAt = new Date(response.data.exp);
    // Сохраняем в кэш с запасом 2 секунды
    expiresAt.setSeconds(expiresAt.getSeconds() - 2);
    
    return response.data.token;
  } catch (error) {
    const axiosError = error as AxiosError;
    logger.error(`Ошибка получения токена для филиала: ${axiosError.message}`);
    if (axiosError.response?.status === 401 || axiosError.response?.status === 429) {
      // Backoff на 401/429
      await new Promise(resolve => setTimeout(resolve, 1000));
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
    return cached.token;
  }
  
  // Получаем новый токен
  const keys = getBranchKeys();
  const branchKey = keys[branch];
  const token = await getBranchToken(branchKey);
  
  // Кэшируем (TTL ~240 секунд, но мы сохраняем с запасом)
  const expiresAt = new Date();
  expiresAt.setSeconds(expiresAt.getSeconds() + 238); // Запас 2 секунды
  
  tokenCache.set(branch, { token, expiresAt });
  
  return token;
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
  
  while (hasMore) {
    try {
      const pageData = await apiFetch<T[]>(branch, path, {
        ...params,
        page,
        limit: pageLimit,
      });
      
      if (!pageData || pageData.length === 0) {
        hasMore = false;
        break;
      }
      
      results.push(...pageData);
      
      // Если получили меньше запрошенного, значит это последняя страница
      if (pageData.length < pageLimit) {
        hasMore = false;
      } else {
        page++;
        // Защита от бесконечного цикла
        if (page > 1000) {
          logger.warn(`Достигнут максимум страниц для ${path}`);
          hasMore = false;
        }
      }
    } catch (error) {
      logger.error(`Ошибка пагинации для ${path}, страница ${page}:`, error);
      hasMore = false;
    }
  }
  
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
  return getBranchToken(apiKey);
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
