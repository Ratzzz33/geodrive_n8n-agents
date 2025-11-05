/**
 * Парсеры для UI событий из RentProg
 * Извлекают структурированную информацию из текстовых описаний
 */

export interface ParsedEvent {
  actor: string; // "Neverov Leonid"
  action: string; // "создал платёж", "завершил обслуживание"
  timestamp: Date;
  branch: string;
  entities: Record<string, any>;
  rawDescription: string;
}

export type EventType =
  | 'cash_operation'
  | 'maintenance'
  | 'mileage_update'
  | 'booking_status'
  | 'unknown';

/**
 * Классифицирует событие по типу
 */
export function classifyEvent(action: string, description: string): EventType {
  const text = `${action} ${description}`.toLowerCase();

  // Кассовые операции
  if (
    text.includes('платёж') ||
    text.includes('платеж') ||
    text.includes('наличными') ||
    text.includes('cash')
  ) {
    return 'cash_operation';
  }

  // Техобслуживание
  if (
    text.includes('обслуживание') ||
    text.includes('завершил') ||
    text.includes('service')
  ) {
    return 'maintenance';
  }

  // Изменение пробега
  if (text.includes('mileage') || text.includes('пробег')) {
    return 'mileage_update';
  }

  // Изменение статуса брони
  if (
    text.includes('статус') ||
    text.includes('бронь') ||
    text.includes('booking') ||
    text.includes('выдал авто') ||
    text.includes('принял авто')
  ) {
    return 'booking_status';
  }

  return 'unknown';
}

/**
 * Парсит событие создания платежа
 * Пример: "Neverov Leonid создал платёж №1834894, расход наличными 60.0GEL"
 */
export function parsePaymentEvent(description: string): {
  paymentId?: string;
  amount?: number;
  currency?: string;
  type?: 'income' | 'expense';
  method?: string;
} {
  const result: any = {};

  // Извлечь номер платежа
  const paymentIdMatch = description.match(/№(\d+)/);
  if (paymentIdMatch) {
    result.paymentId = paymentIdMatch[1];
  }

  // Извлечь тип операции
  if (description.includes('расход')) {
    result.type = 'expense';
  } else if (description.includes('приход')) {
    result.type = 'income';
  }

  // Извлечь метод оплаты
  if (description.includes('наличными')) {
    result.method = 'cash';
  }

  // Извлечь сумму и валюту
  const amountMatch = description.match(/([\d.]+)\s*(GEL|USD|EUR)/i);
  if (amountMatch) {
    result.amount = parseFloat(amountMatch[1]);
    result.currency = amountMatch[2].toUpperCase();
  }

  return result;
}

/**
 * Парсит событие завершения техобслуживания
 * Пример: "Neverov Leonid завершил обслуживание №102306 в объекте №59439 закрепить омывайку..."
 */
export function parseServiceEvent(description: string): {
  serviceId?: string;
  carNumber?: string;
  serviceDescription?: string;
} {
  const result: any = {};

  // Извлечь ID обслуживания
  const serviceIdMatch = description.match(/обслуживание\s+№(\d+)/i);
  if (serviceIdMatch) {
    result.serviceId = serviceIdMatch[1];
  }

  // Извлечь номер авто
  const carMatch = description.match(/объект[еа]?\s+№(\d+)/i);
  if (carMatch) {
    result.carNumber = carMatch[1];
  }

  // Извлечь описание работ (всё после номера авто)
  const descriptionMatch = description.match(/объект[еа]?\s+№\d+\s+(.+)$/i);
  if (descriptionMatch) {
    result.serviceDescription = descriptionMatch[1].trim();
  }

  return result;
}

/**
 * Парсит событие изменения пробега
 * Пример: "Neverov Leonid изменил, mileage с на 95136 в авто № 69168"
 */
export function parseMileageEvent(description: string): {
  carNumber?: string;
  oldMileage?: number;
  newMileage?: number;
} {
  const result: any = {};

  // Извлечь номер авто
  const carMatch = description.match(/авто\s+№\s*(\d+)/i);
  if (carMatch) {
    result.carNumber = carMatch[1];
  }

  // Извлечь новый пробег
  const newMileageMatch = description.match(/mileage\s+с\s+(?:на\s+)?(\d+)/i);
  if (newMileageMatch) {
    result.newMileage = parseInt(newMileageMatch[1], 10);
  }

  // Попробовать извлечь старый пробег (если есть)
  const oldMileageMatch = description.match(/mileage\s+с\s+(\d+)\s+на/i);
  if (oldMileageMatch) {
    result.oldMileage = parseInt(oldMileageMatch[1], 10);
  }

  return result;
}

/**
 * Парсит событие изменения статуса брони
 * Пример: "Neverov Leonid принял авто, бронь №505165"
 * Пример: "Neverov Leonid выдал авто, бронь №505165"
 */
export function parseBookingStatusEvent(description: string): {
  bookingId?: string;
  action?: 'issued' | 'returned' | 'status_changed';
  newStatus?: string;
} {
  const result: any = {};

  // Извлечь номер брони
  const bookingMatch = description.match(/брон[ья]\s+№(\d+)/i);
  if (bookingMatch) {
    result.bookingId = bookingMatch[1];
  }

  // Определить действие
  if (description.includes('выдал авто')) {
    result.action = 'issued';
  } else if (description.includes('принял авто')) {
    result.action = 'returned';
  } else if (description.includes('статус')) {
    result.action = 'status_changed';
    // Попробовать извлечь новый статус
    const statusMatch = description.match(/статус[:]?\s+(\w+)/i);
    if (statusMatch) {
      result.newStatus = statusMatch[1];
    }
  }

  return result;
}

/**
 * Парсит имя актора (сотрудника)
 * Пример: "Neverov Leonid создал..." → "Neverov Leonid"
 */
export function parseActor(text: string): string | null {
  // Ищем имя в начале строки (Фамилия Имя)
  const match = text.match(/^([A-Z][a-z]+\s+[A-Z][a-z]+)/);
  return match ? match[1] : null;
}

/**
 * Парсит действие
 * Пример: "Neverov Leonid создал платёж..." → "создал платёж"
 */
export function parseAction(text: string): string {
  // Убираем имя актора из начала
  const withoutActor = text.replace(/^[A-Z][a-z]+\s+[A-Z][a-z]+\s+/, '');
  
  // Ищем глагол в начале (создал, завершил, изменил, принял, выдал)
  const actionMatch = withoutActor.match(
    /^(создал|завершил|изменил|принял|выдал|добавил|удалил|обновил)\s+([^,]+)/i
  );
  
  if (actionMatch) {
    return `${actionMatch[1]} ${actionMatch[2]}`;
  }
  
  return withoutActor;
}

/**
 * Парсит русскую дату из RentProg
 * Пример: "05 нояб. 25 18:46" → Date object
 */
export function parseDateFromRussian(dateStr: string): Date {
  const monthMap: Record<string, number> = {
    'янв': 0, 'февр': 1, 'мар': 2, 'апр': 3, 'май': 4, 'июн': 5,
    'июл': 6, 'авг': 7, 'сент': 8, 'окт': 9, 'нояб': 10, 'дек': 11
  };

  // "05 нояб. 25 18:46"
  const match = dateStr.match(/(\d{2})\s+(\w+)\.\s+(\d{2})\s+(\d{2}):(\d{2})/);
  
  if (!match) {
    return new Date(); // fallback на текущее время
  }

  const [, day, monthRu, year, hour, minute] = match;
  const month = monthMap[monthRu.toLowerCase()] ?? 0;
  const fullYear = 2000 + parseInt(year, 10);

  return new Date(fullYear, month, parseInt(day, 10), parseInt(hour, 10), parseInt(minute, 10));
}

/**
 * Создает хеш события для дедупликации
 */
export async function createEventHash(
  branch: string,
  timestamp: Date,
  description: string
): Promise<string> {
  const crypto = await import('crypto');
  const data = `${branch}|${timestamp.toISOString()}|${description}`;
  return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * Главная функция парсинга события
 */
export function parseEvent(
  rawText: string,
  branch: string,
  timestamp: Date
): ParsedEvent {
  const actor = parseActor(rawText) || 'Unknown';
  const action = parseAction(rawText);
  const eventType = classifyEvent(action, rawText);

  let entities: Record<string, any> = {};

  switch (eventType) {
    case 'cash_operation':
      entities = parsePaymentEvent(rawText);
      break;
    case 'maintenance':
      entities = parseServiceEvent(rawText);
      break;
    case 'mileage_update':
      entities = parseMileageEvent(rawText);
      break;
    case 'booking_status':
      entities = parseBookingStatusEvent(rawText);
      break;
  }

  return {
    actor,
    action,
    timestamp,
    branch,
    entities,
    rawDescription: rawText,
  };
}

