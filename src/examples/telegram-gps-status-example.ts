/**
 * Пример использования GPS статусов в Telegram боте
 * 
 * Этот файл показывает как использовать человекопонятные названия статусов
 * при отправке сообщений в Telegram.
 */

import { getStatusDisplay, getStatusLabel, getStatusEmoji, isActiveStatus } from '../types/gps-status';
import type { GPSStatusCode } from '../types/gps-status';

/**
 * Пример 1: Формирование сообщения о машине
 */
function formatCarMessage(car: {
  alias: string;
  plate: string;
  location: string;
  status: GPSStatusCode;
  speed: number;
  batteryVoltage: number;
  lastUpdate: Date;
}) {
  const statusDisplay = getStatusDisplay(car.status);
  
  let message = `🚗 ${car.alias} — ${car.plate}\n`;
  message += `📍 Местоположение: ${car.location}\n`;
  message += `📊 Статус: ${statusDisplay}`;
  
  // Показываем скорость только если машина едет
  if (car.status === 'moving') {
    message += ` ⚡ ${car.speed} км/ч`;
  }
  
  // Показываем вольтаж для припаркованных машин
  if (car.status === 'parked_off' || car.status === 'parked_on') {
    message += ` 🔋 ${car.batteryVoltage.toFixed(1)} В`;
  }
  
  message += `\n🕐 Обновлено: ${car.lastUpdate.toLocaleString('ru-RU')}`;
  
  return message;
}

/**
 * Пример 2: Группировка машин по категориям
 */
function groupCarsByStatus(cars: Array<{ alias: string; status: GPSStatusCode }>) {
  const active: string[] = [];
  const passive: string[] = [];
  const unavailable: string[] = [];
  
  for (const car of cars) {
    if (isActiveStatus(car.status)) {
      active.push(car.alias);
    } else if (car.status === 'parked_off') {
      passive.push(car.alias);
    } else {
      unavailable.push(car.alias);
    }
  }
  
  let message = '📊 Статистика автопарка:\n\n';
  
  if (active.length > 0) {
    message += `✅ Активные (${active.length}):\n`;
    message += active.map(alias => `  • ${alias}`).join('\n');
    message += '\n\n';
  }
  
  if (passive.length > 0) {
    message += `🕐 На стоянке (${passive.length}):\n`;
    message += passive.slice(0, 5).map(alias => `  • ${alias}`).join('\n');
    if (passive.length > 5) {
      message += `\n  ... и ещё ${passive.length - 5}`;
    }
    message += '\n\n';
  }
  
  if (unavailable.length > 0) {
    message += `❌ Недоступные (${unavailable.length}):\n`;
    message += unavailable.map(alias => `  • ${alias}`).join('\n');
  }
  
  return message;
}

/**
 * Пример 3: Алерт при изменении статуса
 */
function formatStatusChangeAlert(car: {
  alias: string;
  plate: string;
  oldStatus: GPSStatusCode;
  newStatus: GPSStatusCode;
  location: string;
}) {
  const oldLabel = getStatusLabel(car.oldStatus);
  const newDisplay = getStatusDisplay(car.newStatus);
  
  let message = `🔔 Изменение статуса\n\n`;
  message += `🚗 ${car.alias} — ${car.plate}\n`;
  message += `📍 ${car.location}\n\n`;
  message += `Было: ${oldLabel}\n`;
  message += `Стало: ${newDisplay}`;
  
  // Добавляем контекстные подсказки
  if (car.newStatus === 'moving' && car.oldStatus === 'parked_off') {
    message += '\n\n💡 Машина выехала со стоянки';
  } else if (car.newStatus === 'parked_off' && car.oldStatus === 'moving') {
    message += '\n\n💡 Машина припаркована';
  } else if (car.newStatus === 'offline') {
    message += '\n\n⚠️ Потеряна связь с трекером';
  } else if (car.newStatus === 'gps_offline') {
    message += '\n\n⚠️ GPS сигнал потерян (возможно в помещении)';
  }
  
  return message;
}

/**
 * Пример 4: Список машин с фильтром
 */
function formatCarListByStatus(
  cars: Array<{ alias: string; plate: string; status: GPSStatusCode; speed: number }>,
  filterStatus?: GPSStatusCode
) {
  const filtered = filterStatus 
    ? cars.filter(car => car.status === filterStatus)
    : cars;
  
  if (filtered.length === 0) {
    const statusLabel = filterStatus ? getStatusLabel(filterStatus) : '';
    return `Нет машин${statusLabel ? ` со статусом "${statusLabel}"` : ''}`;
  }
  
  const statusLabel = filterStatus ? ` (${getStatusLabel(filterStatus)})` : '';
  let message = `🚗 Список машин${statusLabel}:\n\n`;
  
  filtered.forEach((car, index) => {
    const emoji = getStatusEmoji(car.status);
    message += `${index + 1}. ${emoji} ${car.alias} — ${car.plate}`;
    
    if (car.status === 'moving' && car.speed > 0) {
      message += ` (${car.speed} км/ч)`;
    }
    
    message += '\n';
  });
  
  return message;
}

/**
 * Пример 5: Быстрая статистика
 */
function formatQuickStats(cars: Array<{ status: GPSStatusCode }>) {
  const stats = {
    offline: 0,
    gps_offline: 0,
    moving: 0,
    parked_on: 0,
    parked_off: 0
  };
  
  cars.forEach(car => stats[car.status]++);
  
  const total = cars.length;
  
  return [
    `📊 Статистика (${total} машин):`,
    '',
    `🟢 ${getStatusLabel('moving')}: ${stats.moving}`,
    `🟠 ${getStatusLabel('parked_on')}: ${stats.parked_on}`,
    `⚪ ${getStatusLabel('parked_off')}: ${stats.parked_off}`,
    `🟡 ${getStatusLabel('gps_offline')}: ${stats.gps_offline}`,
    `🔴 ${getStatusLabel('offline')}: ${stats.offline}`
  ].join('\n');
}

// Экспорт примеров для использования
export {
  formatCarMessage,
  groupCarsByStatus,
  formatStatusChangeAlert,
  formatCarListByStatus,
  formatQuickStats
};

/**
 * Пример использования:
 * 
 * import { formatCarMessage } from './examples/telegram-gps-status-example';
 * 
 * const message = formatCarMessage({
 *   alias: 'Maserati levante SQ4 686',
 *   plate: 'WQ686WQ',
 *   location: 'Батуми, проспект Тамар Мепе',
 *   status: 'moving',
 *   speed: 69,
 *   batteryVoltage: 12.7,
 *   lastUpdate: new Date()
 * });
 * 
 * await bot.sendMessage(chatId, message);
 * 
 * // Результат:
 * // 🚗 Maserati levante SQ4 686 — WQ686WQ
 * // 📍 Местоположение: Батуми, проспект Тамар Мепе
 * // 📊 Статус: 🟢 Едет ⚡ 69 км/ч
 * // 🕐 Обновлено: 14.11.2025, 10:28
 */

