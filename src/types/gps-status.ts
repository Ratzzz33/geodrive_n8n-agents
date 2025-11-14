/**
 * GPS Status Types
 * Типы статусов GPS трекинга
 */

/**
 * Технические коды статусов (как хранятся в БД)
 */
export type GPSStatusCode = 'offline' | 'gps_offline' | 'moving' | 'parked_on' | 'parked_off';

/**
 * Человекопонятные названия статусов (для UI)
 */
export const GPS_STATUS_LABELS: Record<GPSStatusCode, string> = {
  offline: 'Нет связи',
  gps_offline: 'Слабый GPS',
  moving: 'Едет',
  parked_on: 'Стоит (заведена)',
  parked_off: 'Припаркована'
} as const;

/**
 * Эмодзи для статусов
 */
export const GPS_STATUS_EMOJI: Record<GPSStatusCode, string> = {
  offline: '🔴',
  gps_offline: '🟡',
  moving: '🟢',
  parked_on: '🟠',
  parked_off: '⚪'
} as const;

/**
 * Обратный маппинг (русское название → код)
 * Используется если нужно найти код по человекопонятному названию
 */
export const GPS_STATUS_CODES: Record<string, GPSStatusCode> = {
  'Нет связи': 'offline',
  'Слабый GPS': 'gps_offline',
  'Едет': 'moving',
  'Стоит (заведена)': 'parked_on',
  'Припаркована': 'parked_off'
} as const;

/**
 * Получить человекопонятное название статуса
 * @param code Технический код статуса
 * @returns Русское название
 */
export function getStatusLabel(code: GPSStatusCode): string {
  return GPS_STATUS_LABELS[code] || code;
}

/**
 * Получить эмодзи статуса
 * @param code Технический код статуса
 * @returns Эмодзи
 */
export function getStatusEmoji(code: GPSStatusCode): string {
  return GPS_STATUS_EMOJI[code] || '';
}

/**
 * Получить полное отображение статуса (эмодзи + название)
 * @param code Технический код статуса
 * @returns "🟢 Едет"
 */
export function getStatusDisplay(code: GPSStatusCode): string {
  const emoji = getStatusEmoji(code);
  const label = getStatusLabel(code);
  return `${emoji} ${label}`;
}

/**
 * Категории статусов (для группировки в UI)
 */
export enum GPSStatusCategory {
  ACTIVE = 'active',      // moving, parked_on - машина активна
  PASSIVE = 'passive',    // parked_off - машина пассивна
  UNAVAILABLE = 'unavailable' // offline, gps_offline - недоступна
}

/**
 * Получить категорию статуса
 * @param code Технический код статуса
 * @returns Категория
 */
export function getStatusCategory(code: GPSStatusCode): GPSStatusCategory {
  switch (code) {
    case 'moving':
    case 'parked_on':
      return GPSStatusCategory.ACTIVE;
    case 'parked_off':
      return GPSStatusCategory.PASSIVE;
    case 'offline':
    case 'gps_offline':
      return GPSStatusCategory.UNAVAILABLE;
  }
}

/**
 * Проверить, активна ли машина (можно отследить, скоро поедет)
 * @param code Технический код статуса
 * @returns true если активна
 */
export function isActiveStatus(code: GPSStatusCode): boolean {
  return getStatusCategory(code) === GPSStatusCategory.ACTIVE;
}

/**
 * Проверить, доступна ли машина (на связи)
 * @param code Технический код статуса
 * @returns true если доступна
 */
export function isAvailableStatus(code: GPSStatusCode): boolean {
  return code !== 'offline' && code !== 'gps_offline';
}

