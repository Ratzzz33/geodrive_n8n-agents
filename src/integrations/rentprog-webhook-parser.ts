/**
 * Парсер и нормализация вебхуков RentProg
 * Преобразует входящие события в внутренние типы системы
 */

import { SystemEvent, EventType } from '../types/events';
import { BranchName } from './rentprog';
import { logger } from '../utils/logger';

/**
 * Структура входящего вебхука от RentProg
 */
interface RentProgWebhookPayload {
  event?: string;
  type?: string;
  name?: string;
  payload?: string | Record<string, unknown>;
  entity?: string;
  action?: string;
  id?: number;
  branch?: string;
  branch_name?: string;
}

/**
 * Парсинг Ruby-style строки в JSON
 */
function parseRubyStyle(str: string): Record<string, unknown> {
  try {
    // Заменяем Ruby-style => на JSON :
    let jsonStr = str.replace(/=>/g, ':');
    // Добавляем кавычки к ключам
    jsonStr = jsonStr.replace(/(\w+):/g, '"$1":');
    return JSON.parse(jsonStr);
  } catch {
    // Если не получилось, пробуем как обычный JSON
    return JSON.parse(str);
  }
}

/**
 * Извлечение payload из вебхука
 */
function extractPayload(rawPayload: string | Record<string, unknown> | undefined): Record<string, unknown> {
  if (!rawPayload) return {};
  
  if (typeof rawPayload === 'object') {
    return rawPayload;
  }
  
  if (typeof rawPayload === 'string') {
    try {
      const parsed = JSON.parse(rawPayload);
      return typeof parsed === 'object' ? parsed : {};
    } catch {
      // Пробуем Ruby-style
      return parseRubyStyle(rawPayload);
    }
  }
  
  return {};
}

/**
 * Определение типа события
 */
function determineEventType(event: string | undefined, action: string | undefined): EventType | null {
  const eventLower = (event || '').toLowerCase();
  const actionLower = (action || '').toLowerCase();
  
  // Бронирования
  if (eventLower.includes('booking')) {
    if (actionLower.includes('create') || actionLower.includes('создан')) {
      return 'booking.created';
    }
    if (actionLower.includes('update') || actionLower.includes('обнов')) {
      // Проверяем статусы для planned событий
      // TODO: Дополнительная логика для определения planned
      return 'booking.updated';
    }
    if (actionLower.includes('issue') || actionLower.includes('выдан')) {
      return 'booking.issued';
    }
    if (actionLower.includes('return') || actionLower.includes('принят')) {
      return 'booking.returned';
    }
    return 'booking.updated';
  }
  
  // Автомобили
  if (eventLower.includes('car') || eventLower.includes('автомоб')) {
    if (actionLower.includes('move') || actionLower.includes('перемещ')) {
      return 'car.moved';
    }
    return 'car.moved'; // По умолчанию для авто
  }
  
  // Клиенты
  if (eventLower.includes('client') || eventLower.includes('клиент')) {
    if (actionLower.includes('create') || actionLower.includes('создан')) {
      return 'booking.created'; // Клиенты связываются с бронями
    }
    return 'booking.updated';
  }
  
  // Касса
  if (eventLower.includes('cash') || eventLower.includes('касс')) {
    if (actionLower.includes('collect') || actionLower.includes('инкасс')) {
      return 'cash.collected';
    }
  }
  
  return null;
}

/**
 * Нормализация вебхука в событие системы
 */
export function normalizeRentProgWebhook(
  rawWebhook: RentProgWebhookPayload
): SystemEvent | null {
  try {
    const payload = extractPayload(rawWebhook.payload);
    const eventType = determineEventType(
      rawWebhook.event || rawWebhook.type || rawWebhook.name,
      rawWebhook.action
    );
    
    if (!eventType) {
      logger.warn('Не удалось определить тип события', { rawWebhook });
      return null;
    }
    
    // Базовая структура события
    const systemEvent: SystemEvent = {
      type: eventType,
      timestamp: new Date(),
      source: 'rentprog',
      payload: {
        ...payload,
        rentprog_id: rawWebhook.id || payload.id,
        // branch удален - не нужен для определения источника
        raw_event: rawWebhook.event || rawWebhook.type || rawWebhook.name,
        raw_action: rawWebhook.action,
      },
    };
    
    // Дополнительная нормализация для специфичных событий
    if (eventType === 'car.moved') {
      systemEvent.payload.car_id = rawWebhook.id || payload.car_id || payload.id;
      // from_branch и to_branch остаются в payload если есть
      systemEvent.payload.from_branch = payload.from_branch || payload.branch;
      systemEvent.payload.to_branch = payload.to_branch || payload.branch;
    }
    
    if (eventType.startsWith('booking.')) {
      systemEvent.payload.booking_id = rawWebhook.id || payload.booking_id || payload.id;
      systemEvent.payload.car_id = payload.car_id;
      systemEvent.payload.client_id = payload.client_id;
    }
    
    return systemEvent;
  } catch (error) {
    logger.error('Ошибка нормализации вебхука:', error);
    return null;
  }
}

