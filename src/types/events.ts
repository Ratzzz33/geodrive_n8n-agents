/**
 * Базовые типы событий системы
 * События классифицируются и маршрутизируются оркестратором
 */

export type EventType =
  // События от RentProg
  | 'booking.issue.planned'
  | 'booking.return.planned'
  | 'booking.created'
  | 'booking.updated'
  | 'booking.issued'
  | 'booking.returned'
  | 'car.moved'
  | 'cash.collected'
  // События от Umnico
  | 'umnico.message.incoming'
  | 'umnico.message.sent'
  // События от Telegram
  | 'telegram.message.employee'
  | 'telegram.callback.button'
  | 'telegram.photo.uploaded'
  // Внутренние события (cron)
  | 'check.cash'
  | 'check.bookings'
  | 'check.to'
  | 'check.starline'
  | 'daily.plan.generate';

/**
 * Базовая структура события
 */
export interface BaseEvent {
  type: EventType;
  timestamp: Date;
  source: 'rentprog' | 'umnico' | 'telegram' | 'cron' | 'internal';
  payload: Record<string, unknown>;
}

/**
 * Событие запланированной выдачи
 */
export interface BookingIssuePlannedEvent extends BaseEvent {
  type: 'booking.issue.planned';
  payload: {
    bookingId: string;
    carId: string;
    branchId: string;
    plannedTime: Date;
    responsibleEmployeeId?: string;
  };
}

/**
 * Событие запланированной приемки
 */
export interface BookingReturnPlannedEvent extends BaseEvent {
  type: 'booking.return.planned';
  payload: {
    bookingId: string;
    carId: string;
    branchId: string;
    plannedTime: Date;
    responsibleEmployeeId?: string;
  };
}

/**
 * Событие входящего сообщения от Umnico
 */
export interface UmnicoMessageIncomingEvent extends BaseEvent {
  type: 'umnico.message.incoming';
  payload: {
    messageId: string;
    clientId: string;
    text: string;
    language?: string;
    channel: 'whatsapp' | 'telegram';
  };
}

/**
 * Событие генерации дневного плана
 */
export interface DailyPlanGenerateEvent extends BaseEvent {
  type: 'daily.plan.generate';
  payload: {
    branchId: string;
    date: Date;
  };
}

/**
 * Событие проверки Starline
 */
export interface CheckStarlineEvent extends BaseEvent {
  type: 'check.starline';
  payload: {
    carId?: string; // Если не указан, проверяются все авто
  };
}

/**
 * Событие проверки ТО
 */
export interface CheckTOEvent extends BaseEvent {
  type: 'check.to';
  payload: {
    carId?: string; // Если не указан, проверяются все авто
  };
}

/**
 * Union тип всех событий
 */
export type SystemEvent =
  | BookingIssuePlannedEvent
  | BookingReturnPlannedEvent
  | UmnicoMessageIncomingEvent
  | DailyPlanGenerateEvent
  | CheckStarlineEvent
  | CheckTOEvent
  | BaseEvent;

