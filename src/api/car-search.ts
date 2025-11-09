/**
 * API endpoint для поиска автомобилей
 * POST /api/cars/search
 */

import { Router } from 'express';
import { searchCars, formatForChat, type CarSearchFilters } from '../modules/car-search';

const router = Router();

/**
 * POST /api/cars/search
 * 
 * Body:
 * {
 *   "branch": "batumi",
 *   "startDate": "2025-11-09",
 *   "endDate": "2025-11-10",
 *   "maxPriceUSD": 50,
 *   "transmission": "Автомат",
 *   "limit": 10
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "filters": {...},
 *   "results": [...],
 *   "count": 6,
 *   "summary": {...},
 *   "message": "..." // Форматированное сообщение для чата
 * }
 */
router.post('/search', async (req, res) => {
  try {
    const filters: CarSearchFilters = req.body;
    
    // Валидация
    if (filters.startDate && filters.endDate) {
      const start = new Date(filters.startDate);
      const end = new Date(filters.endDate);
      
      if (start > end) {
        return res.status(400).json({
          success: false,
          error: 'Дата начала не может быть позже даты окончания',
        });
      }
    }
    
    // Поиск
    const response = await searchCars(filters);
    
    // Форматирование для чата
    const chatMessage = formatForChat(response);
    
    return res.json({
      ...response,
      message: chatMessage,
    });
    
  } catch (error) {
    console.error('Car search API error:', error);
    return res.status(500).json({
      success: false,
      error: 'Ошибка поиска автомобилей',
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * GET /api/cars/search/quick?branch=batumi&date=2025-11-09&maxPrice=50
 * 
 * Быстрый поиск через query параметры (для простых запросов)
 */
router.get('/search/quick', async (req, res) => {
  try {
    const filters: CarSearchFilters = {
      branch: req.query.branch as string,
      startDate: req.query.startDate as string,
      endDate: req.query.endDate as string,
      maxPriceUSD: req.query.maxPriceUSD ? parseFloat(req.query.maxPriceUSD as string) : undefined,
      maxPriceGEL: req.query.maxPriceGEL ? parseFloat(req.query.maxPriceGEL as string) : undefined,
      transmission: req.query.transmission as any,
      limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
    };
    
    const response = await searchCars(filters);
    const chatMessage = formatForChat(response);
    
    return res.json({
      ...response,
      message: chatMessage,
    });
    
  } catch (error) {
    console.error('Quick search API error:', error);
    return res.status(500).json({
      success: false,
      error: 'Ошибка поиска',
    });
  }
});

/**
 * POST /api/cars/search/natural
 * 
 * Поиск на естественном языке (для AI агента)
 * 
 * Body:
 * {
 *   "query": "покажи машины в батуми до 50 долларов на 9-10 ноября"
 * }
 */
router.post('/search/natural', async (req, res) => {
  try {
    const { query } = req.body;
    
    if (!query || typeof query !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Требуется текстовый запрос',
      });
    }
    
    // Парсинг естественного языка
    const filters = parseNaturalQuery(query);
    
    // Поиск
    const response = await searchCars(filters);
    const chatMessage = formatForChat(response);
    
    return res.json({
      ...response,
      message: chatMessage,
      parsedFilters: filters,
    });
    
  } catch (error) {
    console.error('Natural search API error:', error);
    return res.status(500).json({
      success: false,
      error: 'Ошибка обработки запроса',
    });
  }
});

/**
 * Простой парсер запросов на естественном языке
 */
function parseNaturalQuery(query: string): CarSearchFilters {
  const filters: CarSearchFilters = {};
  const lowerQuery = query.toLowerCase();
  
  // Филиалы
  if (lowerQuery.includes('батуми') || lowerQuery.includes('batumi')) {
    filters.branch = 'batumi';
  } else if (lowerQuery.includes('тбилиси') || lowerQuery.includes('tbilisi')) {
    filters.branch = 'tbilisi';
  } else if (lowerQuery.includes('кутаиси') || lowerQuery.includes('kutaisi')) {
    filters.branch = 'kutaisi';
  }
  
  // Цена
  const priceMatch = query.match(/(\d+)\s*(долл|usd|гел|gel)/i);
  if (priceMatch) {
    const price = parseInt(priceMatch[1]);
    const currency = priceMatch[2].toLowerCase();
    
    if (currency.includes('долл') || currency.includes('usd')) {
      filters.maxPriceUSD = price;
    } else {
      filters.maxPriceGEL = price;
    }
  }
  
  // Даты (простой формат: "9 ноября", "9-10 ноября")
  const dateMatch = query.match(/(\d{1,2})[- ]?(\d{1,2})?\s*(ноя|нояб|november|nov)/i);
  if (dateMatch) {
    const day1 = parseInt(dateMatch[1]);
    const day2 = dateMatch[2] ? parseInt(dateMatch[2]) : day1;
    const currentYear = new Date().getFullYear();
    
    filters.startDate = `${currentYear}-11-${day1.toString().padStart(2, '0')}`;
    filters.endDate = `${currentYear}-11-${day2.toString().padStart(2, '0')}`;
  }
  
  // Коробка передач
  if (lowerQuery.includes('автомат')) {
    filters.transmission = 'Автомат';
  } else if (lowerQuery.includes('механика')) {
    filters.transmission = 'Механика';
  }
  
  return filters;
}

export default router;

