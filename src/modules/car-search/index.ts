/**
 * Модуль поиска автомобилей по филиалам
 * Используется AI агентом для ответов в чатах
 */

import { db } from '../../db';
import { sql } from 'drizzle-orm';

export interface CarSearchFilters {
  // Основные фильтры
  branch?: string | string[];           // Код филиала: 'tbilisi' | 'batumi' | 'kutaisi' | 'service-center'
  startDate?: string;                   // Дата начала аренды (ISO 8601)
  endDate?: string;                     // Дата окончания аренды (ISO 8601)
  
  // Ценовые фильтры
  maxPriceGEL?: number;                 // Максимальная цена в GEL
  maxPriceUSD?: number;                 // Максимальная цена в USD
  minPriceGEL?: number;                 // Минимальная цена в GEL
  minPriceUSD?: number;                 // Минимальная цена в USD
  
  // Характеристики автомобиля
  transmission?: 'Автомат' | 'Механика' | 'Вариатор';
  yearFrom?: number;                    // Год выпуска от
  yearTo?: number;                      // Год выпуска до
  carClass?: string;                    // Класс авто: 'Эконом' | 'Средний' | 'Бизнес' и т.д.
  carType?: string;                     // Тип кузова: 'Седан' | 'Кроссовер' | 'Внедорожник' и т.д.
  
  // Опции
  seats?: number;                       // Количество мест
  driveUnit?: string;                   // Привод: 'Передний' | 'Полный' | 'Задний'
  
  // Лимиты и сортировка
  limit?: number;                       // Максимум результатов (по умолчанию 20)
  sortBy?: 'price' | 'year' | 'model'; // Сортировка
  sortOrder?: 'asc' | 'desc';          // Порядок сортировки
  
  // Дополнительно
  includeUnavailable?: boolean;         // Включать недоступные машины (state != 1)
}

export interface CarSearchResult {
  id: string;
  model: string;
  plate: string;
  code: string;
  year: number;
  transmission: string;
  branch: {
    code: string;
    name: string;
  };
  price: {
    gel: number;
    usd: number;
    currency: string;
    periods: Array<{
      period: string;
      gel: number;
      usd: number;
    }>;
    season?: {
      startDate: string;
      endDate: string;
    };
  } | null;
  characteristics: {
    carClass?: string;
    carType?: string;
    seats?: number;
    driveUnit?: string;
    fuel?: string;
    engineCapacity?: string;
    enginePower?: string;
  };
  available: boolean;
  unavailableReason?: string;
}

export interface CarSearchResponse {
  success: boolean;
  filters: CarSearchFilters;
  results: CarSearchResult[];
  count: number;
  summary: {
    totalCars: number;
    availableCars: number;
    priceRange?: {
      minGEL: number;
      maxGEL: number;
      minUSD: number;
      maxUSD: number;
    };
  };
}

const USD_TO_GEL = 2.7;

/**
 * Основная функция поиска автомобилей
 */
export async function searchCars(filters: CarSearchFilters): Promise<CarSearchResponse> {
  try {
    // Нормализация фильтров
    const normalizedFilters = normalizeFilters(filters);
    
    // Получить ID филиалов
    const branchIds = await getBranchIds(normalizedFilters.branch);
    
    // Построить SQL запрос
    const query = buildQuery(normalizedFilters, branchIds);
    
    // Выполнить запрос
    const cars = await db.execute(query);
    
    // Обработать результаты
    const results: CarSearchResult[] = [];
    
    for (const car of cars.rows) {
      // Проверить доступность на даты
      const isAvailable = normalizedFilters.startDate && normalizedFilters.endDate
        ? await checkAvailability(car.id as string, normalizedFilters.startDate, normalizedFilters.endDate)
        : true;
      
      // Получить цены
      const priceInfo = await getCarPrice(car.id as string);
      
      // Применить ценовые фильтры
      if (priceInfo) {
        if (normalizedFilters.maxPriceGEL && priceInfo.gel > normalizedFilters.maxPriceGEL) continue;
        if (normalizedFilters.maxPriceUSD && priceInfo.usd > normalizedFilters.maxPriceUSD) continue;
        if (normalizedFilters.minPriceGEL && priceInfo.gel < normalizedFilters.minPriceGEL) continue;
        if (normalizedFilters.minPriceUSD && priceInfo.usd < normalizedFilters.minPriceUSD) continue;
      }
      
      results.push({
        id: car.id as string,
        model: car.model as string,
        plate: car.plate as string,
        code: car.code as string,
        year: car.year as number,
        transmission: car.transmission as string,
        branch: {
          code: car.branch_code as string,
          name: car.branch_name as string,
        },
        price: priceInfo,
        characteristics: {
          carClass: car.car_class as string | undefined,
          carType: car.car_type as string | undefined,
          seats: car.number_seats as number | undefined,
          driveUnit: car.drive_unit as string | undefined,
          fuel: car.fuel as string | undefined,
          engineCapacity: car.engine_capacity as string | undefined,
          enginePower: car.engine_power as string | undefined,
        },
        available: isAvailable,
        unavailableReason: !isAvailable ? 'Забронирован на выбранные даты' : undefined,
      });
    }
    
    // Применить сортировку
    sortResults(results, normalizedFilters.sortBy, normalizedFilters.sortOrder);
    
    // Применить лимит
    const limitedResults = results.slice(0, normalizedFilters.limit || 20);
    
    // Собрать статистику
    const summary = buildSummary(results);
    
    return {
      success: true,
      filters: normalizedFilters,
      results: limitedResults,
      count: limitedResults.length,
      summary,
    };
    
  } catch (error) {
    console.error('Car search error:', error);
    throw error;
  }
}

/**
 * Нормализация и валидация фильтров
 */
function normalizeFilters(filters: CarSearchFilters): Required<CarSearchFilters> {
  return {
    branch: filters.branch,
    startDate: filters.startDate,
    endDate: filters.endDate,
    maxPriceGEL: filters.maxPriceGEL || (filters.maxPriceUSD ? filters.maxPriceUSD * USD_TO_GEL : undefined),
    maxPriceUSD: filters.maxPriceUSD || (filters.maxPriceGEL ? filters.maxPriceGEL / USD_TO_GEL : undefined),
    minPriceGEL: filters.minPriceGEL || (filters.minPriceUSD ? filters.minPriceUSD * USD_TO_GEL : undefined),
    minPriceUSD: filters.minPriceUSD || (filters.minPriceGEL ? filters.minPriceGEL / USD_TO_GEL : undefined),
    transmission: filters.transmission,
    yearFrom: filters.yearFrom,
    yearTo: filters.yearTo,
    carClass: filters.carClass,
    carType: filters.carType,
    seats: filters.seats,
    driveUnit: filters.driveUnit,
    limit: filters.limit || 20,
    sortBy: filters.sortBy || 'price',
    sortOrder: filters.sortOrder || 'asc',
    includeUnavailable: filters.includeUnavailable || false,
  } as Required<CarSearchFilters>;
}

/**
 * Получить ID филиалов по кодам
 */
async function getBranchIds(branch?: string | string[]): Promise<string[]> {
  if (!branch) {
    // Все филиалы
    const result = await db.execute(sql`SELECT id FROM branches`);
    return result.rows.map((r: any) => r.id as string);
  }
  
  const branches = Array.isArray(branch) ? branch : [branch];
  const result = await db.execute(
    sql`SELECT id FROM branches WHERE code = ANY(${branches})`
  );
  
  return result.rows.map((r: any) => r.id as string);
}

/**
 * Построить SQL запрос с фильтрами
 */
function buildQuery(filters: Required<CarSearchFilters>, branchIds: string[]) {
  const conditions: string[] = [];
  const params: any[] = [];
  
  // Филиалы
  if (branchIds.length > 0) {
    conditions.push(`c.branch_id = ANY($${params.length + 1})`);
    params.push(branchIds);
  }
  
  // Состояние машины
  if (!filters.includeUnavailable) {
    conditions.push('c.state = 1');
  }
  
  // Коробка передач
  if (filters.transmission) {
    conditions.push(`c.transmission = $${params.length + 1}`);
    params.push(filters.transmission);
  }
  
  // Год выпуска
  if (filters.yearFrom) {
    conditions.push(`c.year >= $${params.length + 1}`);
    params.push(filters.yearFrom);
  }
  if (filters.yearTo) {
    conditions.push(`c.year <= $${params.length + 1}`);
    params.push(filters.yearTo);
  }
  
  // Класс и тип
  if (filters.carClass) {
    conditions.push(`c.car_class = $${params.length + 1}`);
    params.push(filters.carClass);
  }
  if (filters.carType) {
    conditions.push(`c.car_type = $${params.length + 1}`);
    params.push(filters.carType);
  }
  
  // Количество мест
  if (filters.seats) {
    conditions.push(`c.number_seats >= $${params.length + 1}`);
    params.push(filters.seats);
  }
  
  // Привод
  if (filters.driveUnit) {
    conditions.push(`c.drive_unit = $${params.length + 1}`);
    params.push(filters.driveUnit);
  }
  
  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  
  return sql.raw(`
    SELECT 
      c.id,
      c.model,
      c.plate,
      c.code,
      c.year,
      c.transmission,
      c.car_class,
      c.car_type,
      c.number_seats,
      c.drive_unit,
      c.fuel,
      c.engine_capacity,
      c.engine_power,
      c.state,
      b.code as branch_code,
      b.name as branch_name
    FROM cars c
    LEFT JOIN branches b ON b.id = c.branch_id
    ${whereClause}
    ORDER BY c.model
  `);
}

/**
 * Проверить доступность машины на даты
 */
async function checkAvailability(carId: string, startDate: string, endDate: string): Promise<boolean> {
  const result = await db.execute(sql`
    SELECT COUNT(*) as count
    FROM bookings
    WHERE car_id = ${carId}
      AND status IN ('active', 'confirmed', 'in_rent')
      AND (
        (start_at <= ${startDate}::timestamptz AND end_at >= ${startDate}::timestamptz)
        OR
        (start_at <= ${endDate}::timestamptz AND end_at >= ${endDate}::timestamptz)
        OR
        (start_at >= ${startDate}::timestamptz AND end_at <= ${endDate}::timestamptz)
      )
  `);
  
  return (result.rows[0].count as number) === 0;
}

/**
 * Получить цену машины
 */
async function getCarPrice(carId: string) {
  const result = await db.execute(sql`
    SELECT currency, exchange_rate, price_values
    FROM car_prices
    WHERE car_id = ${carId}
    ORDER BY season_id
    LIMIT 1
  `);
  
  if (result.rows.length === 0) {
    return null;
  }
  
  const row = result.rows[0];
  let priceData = row.price_values;
  
  // Парсим JSON если строка
  if (typeof priceData === 'string') {
    try {
      priceData = JSON.parse(priceData);
    } catch {
      return null;
    }
  }
  
  if (!priceData?.items || priceData.items.length === 0) {
    return null;
  }
  
  const firstPeriod = priceData.items[0];
  
  return {
    gel: firstPeriod.price_gel || firstPeriod.price_per_day,
    usd: firstPeriod.price_usd || (firstPeriod.price_gel / USD_TO_GEL),
    currency: row.currency as string,
    periods: priceData.items.map((item: any) => ({
      period: item.period,
      gel: item.price_gel || item.price_per_day,
      usd: item.price_usd || ((item.price_gel || item.price_per_day) / USD_TO_GEL),
    })),
    season: priceData.season,
  };
}

/**
 * Сортировка результатов
 */
function sortResults(
  results: CarSearchResult[],
  sortBy?: 'price' | 'year' | 'model',
  sortOrder?: 'asc' | 'desc'
) {
  const order = sortOrder === 'desc' ? -1 : 1;
  
  results.sort((a, b) => {
    switch (sortBy) {
      case 'price':
        const priceA = a.price?.gel || Infinity;
        const priceB = b.price?.gel || Infinity;
        return (priceA - priceB) * order;
      
      case 'year':
        return (a.year - b.year) * order;
      
      case 'model':
      default:
        return a.model.localeCompare(b.model) * order;
    }
  });
}

/**
 * Построить статистику по результатам
 */
function buildSummary(results: CarSearchResult[]) {
  const availableCars = results.filter(c => c.available).length;
  
  const prices = results
    .filter(c => c.price)
    .map(c => c.price!);
  
  const priceRange = prices.length > 0 ? {
    minGEL: Math.min(...prices.map(p => p.gel)),
    maxGEL: Math.max(...prices.map(p => p.gel)),
    minUSD: Math.min(...prices.map(p => p.usd)),
    maxUSD: Math.max(...prices.map(p => p.usd)),
  } : undefined;
  
  return {
    totalCars: results.length,
    availableCars,
    priceRange,
  };
}

/**
 * Вспомогательная функция для форматирования ответа для AI агента
 */
export function formatForChat(response: CarSearchResponse): string {
  if (response.results.length === 0) {
    return '🚫 К сожалению, не нашел машин по вашим критериям.';
  }
  
  const { filters, results, summary } = response;
  
  let message = `🚗 Нашел ${results.length} ${pluralize(results.length, 'машину', 'машины', 'машин')}`;
  
  if (filters.branch) {
    const branches = Array.isArray(filters.branch) ? filters.branch : [filters.branch];
    message += ` в ${branches.map(b => branchNames[b] || b).join(', ')}`;
  }
  
  if (filters.startDate && filters.endDate) {
    message += ` на ${formatDate(filters.startDate)} - ${formatDate(filters.endDate)}`;
  }
  
  message += ':\n\n';
  
  results.slice(0, 10).forEach((car, i) => {
    message += `${i + 1}. ${car.model} (${car.year})\n`;
    message += `   📍 ${car.branch.name}\n`;
    message += `   ⚙️ ${car.transmission}`;
    
    if (car.characteristics.seats) {
      message += ` | ${car.characteristics.seats} мест`;
    }
    
    message += '\n';
    
    if (car.price) {
      message += `   💰 ${car.price.gel} GEL/день (≈$${car.price.usd.toFixed(2)})\n`;
    } else {
      message += `   💰 Цена уточняется\n`;
    }
    
    if (!car.available) {
      message += `   ❌ ${car.unavailableReason}\n`;
    }
    
    message += '\n';
  });
  
  if (results.length > 10) {
    message += `\n... и еще ${results.length - 10} ${pluralize(results.length - 10, 'машина', 'машины', 'машин')}`;
  }
  
  if (summary.priceRange) {
    message += `\n📊 Цены: от ${summary.priceRange.minGEL} до ${summary.priceRange.maxGEL} GEL`;
  }
  
  return message;
}

// Вспомогательные функции
const branchNames: Record<string, string> = {
  tbilisi: 'Тбилиси',
  batumi: 'Батуми',
  kutaisi: 'Кутаиси',
  'service-center': 'Сервисный центр',
};

function pluralize(n: number, one: string, few: string, many: string): string {
  if (n % 10 === 1 && n % 100 !== 11) return one;
  if (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20)) return few;
  return many;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
}

