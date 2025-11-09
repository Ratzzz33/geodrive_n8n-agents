/**
 * Starline Helper Functions
 * Вспомогательные функции для работы с данными Starline
 */

interface StarlineDeviceDetails {
  status: number;
  gps_lvl: number;
  pos?: {
    x: number;
    y: number;
    sat_qty: number;
    ts: number;
  };
  car_state?: {
    ign: boolean;
    run: boolean;
    [key: string]: any;
  };
}

interface StarlinePosition {
  x: number; // longitude
  y: number; // latitude
  sat_qty: number;
  ts: number;
}

/**
 * Определить статус машины по данным Starline
 */
export function getCarStatus(
  device: StarlineDeviceDetails
): 'offline' | 'gps_offline' | 'moving' | 'parked_on' | 'parked_off' {
  // Устройство offline
  if (device.status === 0) {
    return 'offline';
  }

  // GPS отключен
  if (!device.gps_lvl || device.gps_lvl === 0 || !device.pos?.sat_qty || device.pos.sat_qty === 0) {
    return 'gps_offline';
  }

  // Машина двигается (зажигание включено и двигатель работает)
  if (device.car_state?.ign && device.car_state?.run) {
    return 'moving';
  }

  // Машина стоит с включенным зажиганием
  if (device.car_state?.ign && !device.car_state?.run) {
    return 'parked_on';
  }

  // Машина стоит с выключенным зажиганием
  return 'parked_off';
}

/**
 * Проверить движется ли машина (по изменению координат)
 */
export function isMoving(oldPos: StarlinePosition | null, newPos: StarlinePosition): boolean {
  if (!oldPos) return false;

  // Если координаты изменились больше чем на 0.0001 градуса (~11 метров)
  const threshold = 0.0001;
  const latDiff = Math.abs(oldPos.y - newPos.y);
  const lngDiff = Math.abs(oldPos.x - newPos.x);

  return latDiff > threshold || lngDiff > threshold;
}

/**
 * Вычислить расстояние между двумя точками (в метрах, формула Haversine)
 */
export function calculateDistance(pos1: StarlinePosition, pos2: StarlinePosition): number {
  const R = 6371e3; // радиус Земли в метрах
  const φ1 = (pos1.y * Math.PI) / 180;
  const φ2 = (pos2.y * Math.PI) / 180;
  const Δφ = ((pos2.y - pos1.y) * Math.PI) / 180;
  const Δλ = ((pos2.x - pos1.x) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // расстояние в метрах
}

