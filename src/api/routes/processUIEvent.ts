/**
 * API endpoint для обработки UI событий из RentProg
 * Вызывается из n8n workflow "RentProg Events Scraper"
 */

import { Router, Request, Response } from 'express';
import postgres from 'postgres';
import {
  parseEvent,
  classifyEvent,
  createEventHash,
  EventType,
  ParsedEvent,
} from '../../services/eventParsers';
import {
  updateEmployeeCash,
  getEmployeeCashByName,
  Currency,
} from '../../services/cashRegisterService';

const router = Router();
const CONNECTION_STRING = process.env.DATABASE_URL || '';
const sql = postgres(CONNECTION_STRING, { max: 10, ssl: { rejectUnauthorized: false } });

interface UIEventRequest {
  timestamp: string; // ISO 8601
  branch: string;
  rawDescription: string;
}

/**
 * POST /process-ui-event
 * Обрабатывает спарсенное событие из RentProg UI
 */
router.post('/process-ui-event', async (req: Request, res: Response) => {
  try {
    const { timestamp, branch, rawDescription } = req.body as UIEventRequest;

    if (!timestamp || !branch || !rawDescription) {
      return res.status(400).json({
        ok: false,
        error: 'Missing required fields: timestamp, branch, rawDescription',
      });
    }

    const eventTimestamp = new Date(timestamp);

    // 1. Парсинг события
    const parsed = parseEvent(rawDescription, branch, eventTimestamp);
    const eventType = classifyEvent(parsed.action, parsed.rawDescription);

    // 2. Создать хеш для дедупликации
    const hash = await createEventHash(branch, eventTimestamp, rawDescription);

    // 3. Проверить дедупликацию
    const existing = await sql`
      SELECT id FROM event_processing_log WHERE hash = ${hash}
    `;

    if (existing.length > 0) {
      console.log(`⚠️ Event already processed (hash: ${hash.slice(0, 8)}...)`);
      return res.json({ ok: true, skipped: true, reason: 'duplicate' });
    }

    // 4. Обработать событие в зависимости от типа
    let processingResult: any = { success: false };

    try {
      switch (eventType) {
        case 'cash_operation':
          processingResult = await handleCashOperation(parsed, branch);
          break;

        case 'maintenance':
          processingResult = await handleMaintenance(parsed, branch);
          break;

        case 'mileage_update':
          processingResult = await handleMileageUpdate(parsed, branch);
          break;

        case 'booking_status':
          processingResult = await handleBookingStatus(parsed, branch);
          break;

        default:
          console.log(`⚠️ Unknown event type: ${eventType}`);
          processingResult = { success: false, reason: 'unknown_type' };
      }

      processingResult.success = true;
    } catch (error: any) {
      console.error(`❌ Error processing event: ${error.message}`);
      processingResult = { success: false, error: error.message };
    }

    // 5. Записать в лог обработки
    await sql`
      INSERT INTO event_processing_log (hash, event_data, event_type, processing_result)
      VALUES (
        ${hash},
        ${JSON.stringify(parsed)},
        ${eventType},
        ${JSON.stringify(processingResult)}
      )
    `;

    return res.json({
      ok: true,
      eventType,
      processingResult,
    });
  } catch (error: any) {
    console.error('❌ Error in /process-ui-event:', error);
    return res.status(500).json({ ok: false, error: error.message });
  }
});

/**
 * Обработать кассовую операцию
 */
async function handleCashOperation(
  event: ParsedEvent,
  branch: string
): Promise<any> {
  const { actor, entities } = event;
  const { paymentId, amount, currency, type } = entities;

  if (!amount || !currency || !type) {
    return { handled: false, reason: 'incomplete_data' };
  }

  // Найти сотрудника по имени
  const employee = await getEmployeeCashByName(actor);

  if (!employee) {
    console.log(`⚠️ Employee not found: ${actor}`);
    return { handled: false, reason: 'employee_not_found', actor };
  }

  // Определить операцию (расход = вычесть, приход = добавить)
  const operation = type === 'expense' ? 'subtract' : 'add';

  // Обновить кассу
  await updateEmployeeCash({
    employeeId: employee.employeeId,
    currency: currency.toLowerCase() as Currency,
    amount,
    operation,
    source: 'ui_event',
    description: `Payment #${paymentId}`,
  });

  return {
    handled: true,
    employeeId: employee.employeeId,
    operation,
    amount,
    currency,
  };
}

/**
 * Обработать завершение техобслуживания
 */
async function handleMaintenance(
  event: ParsedEvent,
  branch: string
): Promise<any> {
  const { actor, entities, timestamp } = event;
  const { serviceId, carNumber, serviceDescription } = entities;

  if (!serviceId || !carNumber) {
    return { handled: false, reason: 'incomplete_data' };
  }

  // Найти машину через external_refs
  const carResult = await sql`
    SELECT entity_id as car_id
    FROM external_refs
    WHERE system = 'rentprog' 
      AND external_id = ${carNumber}
      AND entity_type = 'car'
  `;

  if (carResult.length === 0) {
    console.log(`⚠️ Car not found: ${carNumber}`);
    return { handled: false, reason: 'car_not_found', carNumber };
  }

  const carId = carResult[0].car_id;

  // Интеграция с системой задач
  const { default: taskService } = await import('../../services/taskService');
  
  const result = await taskService.handleMaintenanceCompleted({
    serviceId,
    carId,
    carNumber,
    actor,
    description: serviceDescription || '',
    timestamp,
  });

  console.log(`✅ Maintenance handled: service ${serviceId}, car ${carNumber} → ${result.action}`);

  return {
    handled: true,
    carId,
    serviceId,
    taskId: result.taskId,
    action: result.action,
  };
}

/**
 * Обработать изменение пробега
 */
async function handleMileageUpdate(
  event: ParsedEvent,
  branch: string
): Promise<any> {
  const { entities } = event;
  const { carNumber, newMileage } = entities;

  if (!carNumber || !newMileage) {
    return { handled: false, reason: 'incomplete_data' };
  }

  // Обновить пробег авто
  await sql`
    UPDATE cars
    SET 
      mileage = ${newMileage},
      updated_at = NOW()
    WHERE id = (
      SELECT entity_id FROM external_refs
      WHERE system = 'rentprog' 
        AND external_id = ${carNumber}
        AND entity_type = 'car'
    )
  `;

  console.log(`✅ Mileage updated: car ${carNumber} → ${newMileage}`);

  return {
    handled: true,
    carNumber,
    newMileage,
  };
}

/**
 * Обработать изменение статуса брони
 */
async function handleBookingStatus(
  event: ParsedEvent,
  branch: string
): Promise<any> {
  const { entities } = event;
  const { bookingId, action } = entities;

  if (!bookingId || !action) {
    return { handled: false, reason: 'incomplete_data' };
  }

  // Найти бронь через external_refs
  const bookingResult = await sql`
    SELECT entity_id as booking_id
    FROM external_refs
    WHERE system = 'rentprog' 
      AND external_id = ${bookingId}
      AND entity_type = 'booking'
  `;

  if (bookingResult.length === 0) {
    console.log(`⚠️ Booking not found: ${bookingId}`);
    return { handled: false, reason: 'booking_not_found', bookingId };
  }

  console.log(`✅ Booking status event: ${bookingId} → ${action}`);

  return {
    handled: true,
    bookingId,
    action,
  };
}

export default router;

