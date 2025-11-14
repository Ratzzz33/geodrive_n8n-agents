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
    dir?: number; // направление (градусы)
    s?: number; // скорость в км/ч (важно: поле называется "s", а не "speed"!)
  };
  position?: {  // Альтернативное имя поля (API может вернуть любое из этих двух)
    x: number;
    y: number;
    sat_qty?: number;
    ts: number;
    dir?: number;
    s?: number;
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
  dir?: number; // направление (градусы)
  s?: number; // скорость в км/ч (важно: поле называется "s", а не "speed"!)
}

/**
 * Определить статус машины по данным Starline
 * 
 * ВАЖНО: Starline API возвращает device.status = 1 ("online") для всех машин "в сети",
 * независимо от того движется машина или стоит.
 * Текст "В движении" на веб-сайте генерируется клиентом на основе скорости.
 * 
 * Мы используем комбинированную логику с ПРИОРИТЕТОМ для is_moving:
 * 1. Фактически проехала > 10 метров (isMovingByDistance) -> 'moving' (ПРИОРИТЕТ!)
 * 2. Скорость > 1 км/ч -> 'moving' (любое движение, включая пробки)
 * 3. Зажигание + двигатель -> 'moving' (даже если скорость = 0 из-за плохого GPS)
 * 4. Только зажигание -> 'parked_on'
 * 5. Всё выключено -> 'parked_off'
 * 
 * @param device Данные устройства Starline
 * @param isMovingByDistance Флаг движения на основе изменения координат (distance_moved > 10м)
 */
export function getCarStatus(
  device: StarlineDeviceDetails,
  isMovingByDistance: boolean = false
): 'offline' | 'gps_offline' | 'moving' | 'parked_on' | 'parked_off' {
  // Устройство offline
  if (device.status === 0) {
    return 'offline';
  }

  // Используем pos или position (API может вернуть любое из этих полей)
  const pos = device.pos || device.position;

  // GPS отключен (слабый сигнал) - проверяем только gps_lvl
  // sat_qty может быть undefined даже при хорошем GPS сигнале!
  if (!device.gps_lvl || device.gps_lvl === 0) {
    return 'gps_offline';
  }

  // Получаем скорость (ВАЖНО: поле называется "s", а не "speed"!)
  const speed = pos?.s ?? 0;

  // Машина двигается если:
  // 1. ПРИОРИТЕТ: Фактически проехала > 10 метров (устраняет коллизию is_moving=true но status=parked_off)
  // 2. ИЛИ скорость > 1 км/ч (понижен порог с 5 до 1 км/ч для пробок и медленных маневров)
  // 3. ИЛИ зажигание + двигатель работает (даже если GPS показывает 0 из-за плохого сигнала)
  if (isMovingByDistance || speed > 1 || (device.car_state?.ign && device.car_state?.run)) {
    return 'moving';
  }

  // Машина стоит с включенным зажиганием (прогрев, остановка на светофоре и т.д.)
  if (device.car_state?.ign && !device.car_state?.run) {
    return 'parked_on';
  }

  // Машина стоит с выключенным зажиганием (припаркована)
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

