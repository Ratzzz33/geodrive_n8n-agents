/**
 * Быстрое обновление существующих сущностей только измененными полями из вебхука
 */

import { getDatabase } from '../db/index';
import { cars, clients, bookings } from '../db/schema';
import { eq } from 'drizzle-orm';
import { logger } from '../utils/logger';

/**
 * Быстрое обновление автомобиля только измененными полями
 */
async function quickUpdateCar(
  entityId: string,
  payload: any,
  eventType: string
): Promise<{ changes: string[] }> {
  const db = getDatabase();
  const changes: string[] = [];
  const updates: any = { updated_at: new Date() };

  // Для car_update обрабатываем изменения из payload
  if (eventType.includes('car_update') || eventType.includes('car.update')) {
    // clean_state: [старое, новое] - берем новое значение
    if (payload.clean_state && Array.isArray(payload.clean_state) && payload.clean_state.length === 2) {
      // Пока не сохраняем clean_state в БД напрямую, только логируем
      changes.push(`clean_state: ${payload.clean_state[0]} → ${payload.clean_state[1]}`);
    }

    // mileage: [старое, новое] - берем новое значение
    if (payload.mileage && Array.isArray(payload.mileage) && payload.mileage.length === 2) {
      // mileage может быть сохранен в meta или отдельном поле
      changes.push(`mileage: ${payload.mileage[0]} → ${payload.mileage[1]}`);
    }

    // Обновляем другие поля если они есть
    if (payload.plate || payload.number) {
      updates.plate = payload.plate || payload.number || null;
      changes.push('plate updated');
    }
    if (payload.vin) {
      updates.vin = payload.vin;
      changes.push('vin updated');
    }
    if (payload.model || payload.car_name) {
      updates.model = payload.model || payload.car_name || null;
      changes.push('model updated');
    }
    if (payload.starline_id) {
      updates.starline_id = payload.starline_id;
      changes.push('starline_id updated');
    }
  }

  await db.update(cars).set(updates).where(eq(cars.id, entityId));
  logger.debug(`Quick updated car ${entityId}, changes: ${changes.join(', ')}`);

  return { changes };
}

/**
 * Быстрое обновление клиента только измененными полями
 */
async function quickUpdateClient(
  entityId: string,
  payload: any,
  eventType: string
): Promise<{ changes: string[] }> {
  const db = getDatabase();
  const changes: string[] = [];
  const updates: any = { updated_at: new Date() };

  if (eventType.includes('client_update') || eventType.includes('client.update')) {
    // category: [старое, новое] - берем новое значение
    if (payload.category && Array.isArray(payload.category) && payload.category.length === 2) {
      changes.push(`category: ${payload.category[0]} → ${payload.category[1]}`);
    }

    if (payload.name || payload.client_name) {
      updates.name = payload.name || payload.client_name || null;
      changes.push('name updated');
    }
    if (payload.phone || payload.tel) {
      updates.phone = payload.phone || payload.tel || null;
      changes.push('phone updated');
    }
    if (payload.email) {
      updates.email = payload.email;
      changes.push('email updated');
    }
  }

  await db.update(clients).set(updates).where(eq(clients.id, entityId));
  logger.debug(`Quick updated client ${entityId}, changes: ${changes.join(', ')}`);

  return { changes };
}

/**
 * Быстрое обновление бронирования только измененными полями
 */
async function quickUpdateBooking(
  entityId: string,
  payload: any,
  eventType: string
): Promise<{ changes: string[] }> {
  const db = getDatabase();
  const changes: string[] = [];
  const updates: any = { updated_at: new Date() };

  if (eventType.includes('booking_update') || eventType.includes('booking.update')) {
    // state: [старое, новое] - берем новое значение
    if (payload.state && Array.isArray(payload.state) && payload.state.length === 2) {
      updates.status = payload.state[1];
      changes.push(`status: ${payload.state[0]} → ${payload.state[1]}`);
    } else if (payload.state && typeof payload.state === 'string') {
      updates.status = payload.state;
      changes.push(`status: ${payload.state}`);
    }

    // active: [старое, новое]
    if (payload.active && Array.isArray(payload.active) && payload.active.length === 2) {
      changes.push(`active: ${payload.active[0]} → ${payload.active[1]}`);
    }

    // start_date, end_date
    if (payload.start_date || payload.start_at) {
      const startDate = parseRentProgDate(payload.start_date || payload.start_at);
      if (startDate) {
        updates.start_at = startDate;
        changes.push('start_at updated');
      }
    }
    if (payload.end_date || payload.end_at) {
      const endDate = parseRentProgDate(payload.end_date || payload.end_at);
      if (endDate) {
        updates.end_at = endDate;
        changes.push('end_at updated');
      }
    }
  }

  await db.update(bookings).set(updates).where(eq(bookings.id, entityId));
  logger.debug(`Quick updated booking ${entityId}, changes: ${changes.join(', ')}`);

  return { changes };
}

/**
 * Парсинг даты из формата RentProg (DD-MM-YYYY H:mm)
 */
function parseRentProgDate(dateStr: string | undefined): Date | null {
  if (!dateStr) return null;
  try {
    // Формат: "25-01-2022 10:00"
    const parts = dateStr.split(' ');
    const datePart = parts[0].split('-');
    if (datePart.length === 3) {
      const day = parseInt(datePart[0], 10);
      const month = parseInt(datePart[1], 10) - 1; // месяц 0-indexed
      const year = parseInt(datePart[2], 10);
      let hour = 0, minute = 0;
      if (parts[1]) {
        const timePart = parts[1].split(':');
        hour = parseInt(timePart[0], 10);
        minute = parseInt(timePart[1] || '0', 10);
      }
      return new Date(year, month, day, hour, minute);
    }
    // Пробуем стандартный парсинг
    return new Date(dateStr);
  } catch {
    return null;
  }
}

/**
 * Быстрое обновление сущности по типу
 */
export async function quickUpdateEntity(
  entityType: string,
  entityId: string,
  payload: any,
  eventType: string
): Promise<{ changes: string[] }> {
  switch (entityType) {
    case 'car':
      return quickUpdateCar(entityId, payload, eventType);
    case 'client':
      return quickUpdateClient(entityId, payload, eventType);
    case 'booking':
      return quickUpdateBooking(entityId, payload, eventType);
    default:
      logger.warn(`Unknown entity type for quick update: ${entityType}`);
      return { changes: [] };
  }
}

