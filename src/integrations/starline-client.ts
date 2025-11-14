/**
 * Starline API Client
 * Работает через HTTP запросы с cookies авторизации
 */

interface StarlinePosition {
  x: number; // longitude
  y: number; // latitude
  sat_qty: number;
  ts: number; // timestamp
  dir?: number; // направление движения (градусы)
  s?: number; // скорость в км/ч (важно: поле называется "s", а не "speed"!)
}

interface StarlineDevice {
  alias: string; // название машины
  device_id: number; // IMEI
  status: number; // 0 = offline, 1 = online
  pos?: StarlinePosition;
  position?: StarlinePosition;
  shared_for_me: boolean;
}

interface StarlineDeviceDetails extends StarlineDevice {
  battery?: number; // напряжение батареи
  gps_lvl?: number; // уровень GPS сигнала (0-31)
  gsm_lvl?: number; // уровень GSM сигнала (0-31)
  car_state?: {
    ign: boolean; // зажигание
    run: boolean; // двигатель работает
    pbrake: boolean; // ручник
    door: boolean;
    trunk: boolean;
    hood: boolean;
  };
  car_alr_state?: {
    shock_h: boolean;
    shock_l: boolean;
    door: boolean;
    trunk: boolean;
    hood: boolean;
  };
  ts_activity?: number; // время последней активности
  imei?: string;
  phone?: string;
  fw_version?: string;
  sn?: string; // серийный номер
  type?: number; // тип устройства
}

interface StarlineAPIResponse<T> {
  result: number; // 1 = success, 0 = error
  answer?: T;
  error?: string;
}

export class StarlineClient {
  private baseUrl = 'https://starline-online.ru';
  private cookies: string;
  private userAgent: string;

  constructor() {
    this.cookies = process.env.STARLINE_COOKIES || '';
    this.userAgent = process.env.STARLINE_USER_AGENT || 
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36';
    
    if (!this.cookies) {
      throw new Error('STARLINE_COOKIES not configured in .env');
    }
  }

  /**
   * Получить список всех устройств
   */
  async getDevices(): Promise<StarlineDevice[]> {
    const tz = new Date().getTimezoneOffset() * -1; // timezone offset в минутах
    const url = `${this.baseUrl}/device?tz=${tz}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json, text/javascript, */*; q=0.01',
        'Cookie': this.cookies,
        'User-Agent': this.userAgent,
        'X-Requested-With': 'XMLHttpRequest',
        'Referer': `${this.baseUrl}/site/map`
      }
    });

    if (!response.ok) {
      throw new Error(`Starline API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as StarlineAPIResponse<{ devices: StarlineDevice[] }>;

    if (data.result !== 1 || !data.answer) {
      throw new Error(`Starline API error: ${data.error || 'Unknown error'}`);
    }

    return data.answer.devices;
  }

  /**
   * Получить детальную информацию об устройстве
   */
  async getDeviceDetails(deviceId: number): Promise<StarlineDeviceDetails> {
    const tz = new Date().getTimezoneOffset() * -1;
    const url = `${this.baseUrl}/device/${deviceId}?tz=${tz}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json, text/javascript, */*; q=0.01',
        'Cookie': this.cookies,
        'User-Agent': this.userAgent,
        'X-Requested-With': 'XMLHttpRequest',
        'Referer': `${this.baseUrl}/site/map`
      }
    });

    if (!response.ok) {
      throw new Error(`Starline API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as StarlineAPIResponse<StarlineDeviceDetails>;

    if (data.result !== 1 || !data.answer) {
      throw new Error(`Starline API error: ${data.error || 'Unknown error'}`);
    }

    return data.answer;
  }

  /**
   * Определить статус машины
   */
  getCarStatus(device: StarlineDeviceDetails): 'offline' | 'gps_offline' | 'moving' | 'parked_on' | 'parked_off' {
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
  isMoving(oldPos: StarlinePosition | null, newPos: StarlinePosition): boolean {
    if (!oldPos) return false;

    // Если координаты изменились больше чем на 0.0001 градуса (~11 метров)
    const threshold = 0.0001;
    const latDiff = Math.abs(oldPos.y - newPos.y);
    const lngDiff = Math.abs(oldPos.x - newPos.x);

    return latDiff > threshold || lngDiff > threshold;
  }

  /**
   * Вычислить расстояние между двумя точками (в метрах)
   */
  calculateDistance(pos1: StarlinePosition, pos2: StarlinePosition): number {
    const R = 6371e3; // радиус Земли в метрах
    const φ1 = pos1.y * Math.PI / 180;
    const φ2 = pos2.y * Math.PI / 180;
    const Δφ = (pos2.y - pos1.y) * Math.PI / 180;
    const Δλ = (pos2.x - pos1.x) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // расстояние в метрах
  }
}

export default StarlineClient;

