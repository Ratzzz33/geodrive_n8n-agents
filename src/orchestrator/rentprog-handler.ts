/**
 * Обработчик событий RentProg
 * Дедупликация → Auto-fetch → Upsert
 */

import crypto from 'crypto';
import { logger } from '../utils/logger';
import { checkWebhookDedup, saveWebhookDedup } from '../db';
import { apiFetch, type BranchName } from '../integrations/rentprog';
import {
  upsertCarFromRentProg,
  upsertClientFromRentProg,
  upsertBookingFromRentProg,
} from '../db/upsert';
import { config } from '../config/index.js';
import type { SystemEvent } from '../types/events';
import { sendEventToN8n, sendTelegramAlert } from '../integrations/n8n';

/**
 * Генерация hash для дедупликации
 */
function generateDedupHash(
  source: string,
  branch: string,
  type: string,
  extId: string,
  timeBucket: string
): string {
  const data = `${source}|${branch}|${type}|${extId}|${timeBucket}`;
  return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * Получить полные данные бронирования через API
 */
async function fetchBookingFull(branch: BranchName, bookingId: string): Promise<any> {
  try {
    // Пробуем получить через /all_bookings или /booking/{id}
    const bookings = await apiFetch<any[]>(branch, '/all_bookings', {
      id: bookingId,
      limit: 1,
    });

    if (bookings && bookings.length > 0) {
      return bookings[0];
    }

    // Fallback: пробуем прямой endpoint
    try {
      return await apiFetch<any>(branch, `/booking/${bookingId}`);
    } catch {
      logger.warn(`Could not fetch booking ${bookingId} from ${branch}`);
      return null;
    }
  } catch (error) {
    logger.error(`Error fetching booking ${bookingId}:`, error);
    return null;
  }
}

/**
 * Получить полные данные автомобиля через API
 */
async function fetchCarFull(branch: BranchName, carId: string): Promise<any> {
  try {
    // Пробуем через /all_cars_full
    const cars = await apiFetch<any[]>(branch, '/all_cars_full', {
      id: carId,
      limit: 1,
    });

    if (cars && cars.length > 0) {
      return cars[0];
    }

    // Fallback: прямой endpoint
    try {
      return await apiFetch<any>(branch, `/car/${carId}`);
    } catch {
      logger.warn(`Could not fetch car ${carId} from ${branch}`);
      return null;
    }
  } catch (error) {
    logger.error(`Error fetching car ${carId}:`, error);
    return null;
  }
}

/**
 * Получить полные данные клиента через API
 */
async function fetchClientFull(branch: BranchName, clientId: string): Promise<any> {
  try {
    const clients = await apiFetch<any[]>(branch, '/clients', {
      id: clientId,
      limit: 1,
    });

    if (clients && clients.length > 0) {
      return clients[0];
    }

    // Fallback
    try {
      return await apiFetch<any>(branch, `/client/${clientId}`);
    } catch {
      logger.warn(`Could not fetch client ${clientId} from ${branch}`);
      return null;
    }
  } catch (error) {
    logger.error(`Error fetching client ${clientId}:`, error);
    return null;
  }
}

/**
 * Обработка события от RentProg с auto-fetch и upsert
 */
export async function handleRentProgEvent(
  event: SystemEvent,
  eventId?: number | string,
  changeTracking?: {
    source?: 'rentprog_webhook' | 'rentprog_history' | 'snapshot_workflow' | 'jarvis_api' | 'manual' | 'n8n_workflow';
    workflow?: string;
    function?: string;
    executionId?: string;
    user?: string;
    metadata?: Record<string, any>;
  }
): Promise<{
  ok: boolean;
  processed: boolean;
  entityIds?: { carId?: string; clientId?: string; bookingId?: string };
  error?: string;
}> {
  const payload = event.payload as any;
  
  // Определяем branch по company_id из payload (если массив - берем последний элемент)
  let branch: BranchName = 'tbilisi'; // по умолчанию
  
  // Извлекаем company_id с обработкой массива
  let companyId: number | null = null;
  if (payload.company_id !== undefined && payload.company_id !== null) {
    if (Array.isArray(payload.company_id)) {
      // Если массив - берем последний элемент (новое значение)
      companyId = payload.company_id.length > 0 
        ? payload.company_id[payload.company_id.length - 1] 
        : null;
    } else {
      // Если число - используем как есть
      companyId = payload.company_id;
    }
  }
  
  // Определяем branch по company_id используя маппинг
  if (companyId) {
    const { getBranchByCompanyId } = await import('../config/company-branch-mapping.js');
    const branchFromCompanyId = getBranchByCompanyId(companyId);
    if (branchFromCompanyId) {
      branch = branchFromCompanyId as BranchName;
    }
  }
  
  // Fallback: если branch указан в payload, используем его
  if (payload.branch) {
    branch = payload.branch as BranchName;
  }

  // Определяем тип сущности и ID из payload
  const extId = String(payload.rentprog_id || payload.id || payload.booking_id || payload.car_id || payload.client_id || '');
  if (!extId || extId === 'undefined') {
    return { ok: false, processed: false, error: 'No external ID in payload' };
  }

  // Дедупликация (без branch в hash, так как филиал не важен для определения источника)
  const timeBucket = new Date().toISOString().slice(0, 16);
  const dedupHash = generateDedupHash('rentprog', '', event.type, extId, timeBucket);

  const isDuplicate = await checkWebhookDedup('rentprog', dedupHash);
  if (isDuplicate) {
    logger.debug(`Duplicate webhook skipped: ${dedupHash}`);
    await sendEventToN8n({
      ts: new Date().toISOString(),
      branch: '',  // branch не важен
      type: event.type,
      ext_id: extId,
      ok: true,
      reason: 'duplicate',
    });
    return { ok: true, processed: false };
  }

  // Сохраняем hash для дедупликации
  await saveWebhookDedup('rentprog', dedupHash);

  try {
    const entityIds: { carId?: string; clientId?: string; bookingId?: string } = {};

    // Auto-fetch и upsert в зависимости от типа события
    if (event.type.startsWith('booking.')) {
      // Для бронирований: сначала клиент, затем авто, затем бронь
      let fullPayload = payload;

      // Если payload не содержит критичных данных (car_id, client_id), получаем полные данные
      // Проверяем как start_at, так и start_date (RentProg может отправлять разные форматы)
      if (!payload.car_id || !payload.client_id) {
        fullPayload = await fetchBookingFull(branch, extId);
        if (!fullPayload) {
          return { ok: false, processed: false, error: 'Could not fetch booking data' };
        }
      }

      // Upsert клиента (если есть)
      if (fullPayload.client_id) {
        let clientData = { id: fullPayload.client_id };
        if (!fullPayload.client_name && !fullPayload.client) {
          const clientFull = await fetchClientFull(branch, String(fullPayload.client_id));
          if (clientFull) {
            clientData = clientFull;
          }
        } else {
          clientData = { ...clientData, ...fullPayload.client, name: fullPayload.client_name };
        }
        const result = await upsertClientFromRentProg(clientData, branch);
        entityIds.clientId = result.entityId;
      }

      // Upsert автомобиля (если есть)
      if (fullPayload.car_id) {
        let carData = { id: fullPayload.car_id };
        if (!fullPayload.car_name && !fullPayload.car) {
          const carFull = await fetchCarFull(branch, String(fullPayload.car_id));
          if (carFull) {
            carData = carFull;
          }
        } else {
          carData = { ...carData, ...fullPayload.car, car_name: fullPayload.car_name };
        }
        const result = await upsertCarFromRentProg(carData, branch, {
          source: changeTracking?.source || 'rentprog_webhook',
          workflow: changeTracking?.workflow,
          executionId: changeTracking?.executionId || String(eventId),
          user: changeTracking?.user,
          metadata: changeTracking?.metadata,
        });
        entityIds.carId = result.entityId;
      }

      // Upsert бронирования
      const bookingResult = await upsertBookingFromRentProg(fullPayload, branch);
      entityIds.bookingId = bookingResult.entityId;

      logger.info(`Processed booking ${extId} from ${branch}`, {
        bookingId: entityIds.bookingId,
        carId: entityIds.carId,
        clientId: entityIds.clientId,
      });

      // Запись в timeline
      if (entityIds.bookingId) {
        try {
          const { addWebhookToTimeline } = await import('../db/entityTimeline');
          const relatedEntities: Array<{ type: 'car' | 'client' | 'booking'; id: string }> = [];
          if (entityIds.carId) relatedEntities.push({ type: 'car', id: entityIds.carId });
          if (entityIds.clientId) relatedEntities.push({ type: 'client', id: entityIds.clientId });
          
          // Определяем operation из payload или типа события
          const operation = (payload.operation || 
            (event.type.includes('created') ? 'create' : 
             event.type.includes('destroy') ? 'delete' : 'update')) as any;
          
          // Нормализуем details для timeline (убираем Date объекты и массивы)
          const timelineDetails: any = { rentprog_id: extId };
          for (const [key, value] of Object.entries(fullPayload)) {
            if (value instanceof Date) {
              timelineDetails[key] = value.toISOString();
            } else if (Array.isArray(value)) {
              timelineDetails[key] = value.length > 0 ? value[value.length - 1] : null;
            } else {
              timelineDetails[key] = value;
            }
          }
          
          await addWebhookToTimeline('booking', entityIds.bookingId, {
            eventType: event.type,
            operation,
            summary: `Бронь ${event.type}: ${extId}`,
            details: timelineDetails,
            branchCode: branch,
            sourceId: String(eventId || extId),
            relatedEntities: relatedEntities.length > 0 ? relatedEntities : undefined,
          });
        } catch (timelineError) {
          logger.warn('Failed to add booking to timeline:', timelineError);
        }
      }

      // Отправка в n8n
      await sendEventToN8n({
        ts: new Date().toISOString(),
        branch,
        type: event.type,
        ext_id: extId,
        ok: true,
      });
    } else if (event.type === 'car.moved' || event.type.startsWith('car.')) {
      // Для автомобилей
      let fullPayload = payload;
      if (!payload.plate && !payload.car_name) {
        fullPayload = await fetchCarFull(branch, extId);
        if (!fullPayload) {
          return { ok: false, processed: false, error: 'Could not fetch car data' };
        }
      }

      const carResult = await upsertCarFromRentProg(fullPayload, branch, {
        source: changeTracking?.source || 'rentprog_webhook',
        workflow: changeTracking?.workflow,
        executionId: changeTracking?.executionId || String(eventId),
        user: changeTracking?.user,
        metadata: changeTracking?.metadata,
      });
      entityIds.carId = carResult.entityId;

      logger.info(`Processed car ${extId} from ${branch}`, { carId: entityIds.carId });

      // Запись в timeline
      if (entityIds.carId) {
        try {
          const { addWebhookToTimeline } = await import('../db/entityTimeline');
          // Определяем operation из payload или типа события
          const operation = (payload.operation || 
            (event.type.includes('created') ? 'create' : 
             event.type.includes('destroy') ? 'delete' : 'update')) as any;
          
          // Нормализуем details для timeline (убираем Date объекты и массивы)
          const timelineDetails: any = { rentprog_id: extId };
          for (const [key, value] of Object.entries(fullPayload)) {
            if (value instanceof Date) {
              timelineDetails[key] = value.toISOString();
            } else if (Array.isArray(value)) {
              timelineDetails[key] = value.length > 0 ? value[value.length - 1] : null;
            } else {
              timelineDetails[key] = value;
            }
          }
          
          await addWebhookToTimeline('car', entityIds.carId, {
            eventType: event.type,
            operation,
            summary: `Авто ${event.type}: ${fullPayload.plate || fullPayload.car_name || extId}`,
            details: timelineDetails,
            branchCode: branch,
            sourceId: String(eventId || extId),
          });
        } catch (timelineError) {
          logger.warn('Failed to add car to timeline:', timelineError);
        }
      }

      // Отправка в n8n
      await sendEventToN8n({
        ts: new Date().toISOString(),
        branch,
        type: event.type,
        ext_id: extId,
        ok: true,
      });
    }

    return { ok: true, processed: true, entityIds };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`Error processing RentProg event:`, errorMsg);

    // Отправка ошибки в n8n и Telegram
    await sendEventToN8n({
      ts: new Date().toISOString(),
      branch,
      type: event.type,
      ext_id: extId,
      ok: false,
      reason: errorMsg.substring(0, 100),
    });

    await sendTelegramAlert(
      `❌ RentProg webhook error [${branch}]: ${event.type} #${extId}\n${errorMsg.substring(0, 200)}`
    );

    return {
      ok: false,
      processed: false,
      error: errorMsg,
    };
  }
}

