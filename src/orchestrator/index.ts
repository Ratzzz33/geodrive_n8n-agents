/**
 * Оркестратор системы
 * Принимает события и маршрутизирует их к соответствующим агентам
 */

import { SystemEvent, EventType } from '../types/events';
import { logger } from '../utils/logger';
import { handleRentProgEvent } from './rentprog-handler';

/**
 * Результат обработки события
 */
export interface EventResult {
  success: boolean;
  agentIds: string[];
  error?: string;
}

/**
 * Шина событий (заглушка для MVP)
 */
class EventBus {
  private handlers: Map<EventType, Array<(event: SystemEvent) => Promise<void>>> = new Map();

  /**
   * Подписка на событие
   */
  subscribe(eventType: EventType, handler: (event: SystemEvent) => Promise<void>): void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, []);
    }
    this.handlers.get(eventType)!.push(handler);
    logger.debug(`Subscribed to event type: ${eventType}`);
  }

  /**
   * Публикация события
   */
  async publish(event: SystemEvent): Promise<void> {
    const handlers = this.handlers.get(event.type) || [];
    logger.info(`Publishing event: ${event.type}, handlers: ${handlers.length}`);

    for (const handler of handlers) {
      try {
        await handler(event);
      } catch (error) {
        logger.error(`Error in event handler for ${event.type}:`, error);
      }
    }
  }
}

const eventBus = new EventBus();

/**
 * Маршрутизация события к агентам
 * @param event - Событие для обработки
 * @returns Результат обработки
 */
export async function route(event: SystemEvent): Promise<EventResult> {
  logger.info(`Routing event: ${event.type}`, {
    source: event.source,
    timestamp: event.timestamp,
  });

  try {
    // Обработка событий RentProg: дедуп → auto-fetch → upsert
    if (event.source === 'rentprog') {
      const result = await handleRentProgEvent(event);
      if (!result.ok) {
        return {
          success: false,
          agentIds: [],
          error: result.error || 'Failed to process RentProg event',
        };
      }

      // Продолжаем маршрутизацию к агентам даже после upsert
      if (result.processed && result.entityIds) {
        logger.debug('RentProg upsert completed', result.entityIds);
      }
    }

    // Публикуем событие в шину для агентов
    await eventBus.publish(event);

    // Определение агентов по типу события
    const agentIds = determineAgents(event.type);

    return {
      success: true,
      agentIds,
    };
  } catch (error) {
    logger.error(`Error routing event ${event.type}:`, error);
    return {
      success: false,
      agentIds: [],
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Определение нужных агентов по типу события (заглушка)
 */
function determineAgents(eventType: EventType): string[] {
  const mapping: Partial<Record<EventType, string[]>> = {
    'booking.issue.planned': ['booking-controller', 'issue-assistant'],
    'booking.return.planned': ['booking-controller', 'return-assistant'],
    'umnico.message.incoming': ['client-chats-bridge'],
    'daily.plan.generate': ['daily-plan-generator'],
    'check.starline': ['starline-service-trips'],
    'check.to': ['to-controller'],
  };

  return mapping[eventType] || [];
}

/**
 * Подписка на событие (для агентов)
 */
export function subscribe(eventType: EventType, handler: (event: SystemEvent) => Promise<void>): void {
  eventBus.subscribe(eventType, handler);
}

/**
 * Создание события
 */
export function createEvent(
  type: EventType,
  source: SystemEvent['source'],
  payload: Record<string, unknown>
): SystemEvent {
  return {
    type,
    timestamp: new Date(),
    source,
    payload,
  };
}

export { eventBus };

