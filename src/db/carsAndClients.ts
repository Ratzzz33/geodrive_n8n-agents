/**
 * Работа с таблицами cars и clients
 * Извлечение данных из JSONB поля data в структурированные колонки
 */

import { eq } from 'drizzle-orm';
import { getDatabase } from './index.js';
import { cars, clients } from './schema.js';

/**
 * Извлечение полей из cars.data в структурированные колонки
 */
export function extractCarFields(data: any): Record<string, any> {
  if (!data || typeof data !== 'object') {
    return { data: null };
  }

  return {
    // Основные поля
    rentprog_id: data.id ? String(data.id) : null,
    plate: data.number || data.plate || null,
    vin: data.vin || null,
    model: data.car_name || data.model || null,
    code: data.code || null,
    
    // Технические характеристики
    transmission: data.transmission || null,
    fuel: data.fuel || null,
    year: data.year || null,
    color: data.color || null,
    mileage: data.mileage || null,
    car_type: data.car_type || null,
    interior: data.interior || null,
    car_class: data.car_class || null,
    
    // Состояние и статус
    state: data.state || null,
    active: data.active !== undefined ? data.active : null,
    archive: data.archive !== undefined ? data.archive : null,
    demo: data.demo !== undefined ? data.demo : null,
    
    // Медиа
    avatar_url: data.avatar_url || null,
    photo: data.photo || null,
    photos: data.photos || null,
    
    // Характеристики авто
    drive_unit: data.drive_unit || null,
    number_doors: data.number_doors || null,
    number_seats: data.number_seats || null,
    trunk_volume: data.trunk_volume || null,
    steering_side: data.steering_side || null,
    engine_capacity: data.engine_capacity || null,
    engine_power: data.engine_power || null,
    tire_size: data.tire_size || null,
    tire_type: data.tire_type || null,
    body_number: data.body_number || null,
    airbags: data.airbags || null,
    
    // Финансы
    franchise: data.franchise || null,
    max_fine: data.max_fine || null,
    deposit: data.deposit ? Number(data.deposit) : null,
    insurance: data.insurance || null,
    repair_cost: data.repair_cost || null,
    purchase_price: data.purchase_price || null,
    purchase_date: data.purchase_date || null,
    sale_price: data.sale_price || null,
    sale_date: data.sale_date || null,
    extra_mileage_km: data.extra_mileage_km || null,
    extra_mileage_price: data.extra_mileage_price || null,
    
    // Топливо и обслуживание
    tank_value: data.tank_value || null,
    gas_mileage: data.gas_mileage || null,
    start_mileage: data.start_mileage || null,
    
    // Документы
    registration_certificate: data.registration_certificate || null,
    pts: data.pts || null,
    
    // Опции (boolean)
    abs: data.abs !== undefined ? Boolean(data.abs) : null,
    ebd: data.ebd !== undefined ? Boolean(data.ebd) : null,
    esp: data.esp !== undefined ? Boolean(data.esp) : null,
    is_air: data.is_air !== undefined ? Boolean(data.is_air) : null,
    cd_system: data.cd_system !== undefined ? Boolean(data.cd_system) : null,
    tv_system: data.tv_system !== undefined ? Boolean(data.tv_system) : null,
    parktronic: data.parktronic !== undefined ? Boolean(data.parktronic) : null,
    parktronic_back: data.parktronic_back !== undefined ? Boolean(data.parktronic_back) : null,
    parktronic_camera: data.parktronic_camera !== undefined ? Boolean(data.parktronic_camera) : null,
    tank_state: data.tank_state !== undefined ? Boolean(data.tank_state) : null,
    heated_seats: data.heated_seats !== undefined ? Boolean(data.heated_seats) : null,
    heated_seats_front: data.heated_seats_front !== undefined ? Boolean(data.heated_seats_front) : null,
    clean_state: data.clean_state !== undefined ? Boolean(data.clean_state) : null,
    audio_system: data.audio_system !== undefined ? Boolean(data.audio_system) : null,
    video_system: data.video_system !== undefined ? Boolean(data.video_system) : null,
    folding_seats: data.folding_seats !== undefined ? Boolean(data.folding_seats) : null,
    climate_control: data.climate_control !== undefined ? Boolean(data.climate_control) : null,
    usb_system: data.usb_system !== undefined ? Boolean(data.usb_system) : null,
    rain_sensor: data.rain_sensor !== undefined ? Boolean(data.rain_sensor) : null,
    wheel_adjustment: data.wheel_adjustment !== undefined ? Boolean(data.wheel_adjustment) : null,
    wheel_adjustment_full: data.wheel_adjustment_full !== undefined ? Boolean(data.wheel_adjustment_full) : null,
    heated_windshield: data.heated_windshield !== undefined ? Boolean(data.heated_windshield) : null,
    is_electropackage: data.is_electropackage !== undefined ? Boolean(data.is_electropackage) : null,
    
    // Дополнительные поля
    store_place: data.store_place || null,
    roof: data.roof || null,
    custom_field_1: data.custom_field_1 || null,
    custom_field_2: data.custom_field_2 || null,
    custom_field_3: data.custom_field_3 || null,
    window_lifters: data.window_lifters || null,
    description: data.description || null,
    
    // ТО и обслуживание
    grm: data.grm || null,
    grm_km: data.grm_km || null,
    grm_date: data.grm_date || null,
    candle: data.candle || null,
    candle_km: data.candle_km || null,
    candle_date: data.candle_date || null,
    akb_renew: data.akb_renew || null,
    akb_renew_km: data.akb_renew_km || null,
    akb_renew_date: data.akb_renew_date || null,
    antifreeze: data.antifreeze || null,
    antifreeze_km: data.antifreeze_km || null,
    antifreeze_date: data.antifreeze_date || null,
    oil_engine: data.oil_engine || null,
    oil_engine_km: data.oil_engine_km || null,
    oil_engine_date: data.oil_engine_date || null,
    oil_transmission: data.oil_transmission || null,
    oil_transmission_km: data.oil_transmission_km || null,
    oil_transmission_date: data.oil_transmission_date || null,
    brake_fluid: data.brake_fluid || null,
    brake_fluid_km: data.brake_fluid_km || null,
    brake_fluid_date: data.brake_fluid_date || null,
    fuel_filter_renew: data.fuel_filter_renew || null,
    fuel_filter_renew_km: data.fuel_filter_renew_km || null,
    fuel_filter_renew_date: data.fuel_filter_renew_date || null,
    salon_filter_renew: data.salon_filter_renew || null,
    salon_filter_renew_km: data.salon_filter_renew_km || null,
    salon_filter_renew_date: data.salon_filter_renew_date || null,
    power_steering: data.power_steering || null,
    power_steering_km: data.power_steering_km || null,
    power_steering_date: data.power_steering_date || null,
    
    // Системные ID
    company_id: data.company_id || null,
    main_company_id: data.main_company_id || null,
    user_id: data.user_id || null,
    traccar_id: data.traccar_id || null,
    
    // Разное
    city: data.city || null,
    timezone: data.timezone || null,
    latitude: data.latitude || null,
    longitude: data.longitude || null,
    age_limit: data.age_limit ? Number(data.age_limit) : null,
    free: data.free || null,
    sipp: data.sipp || null,
    sort: data.sort ? Number(data.sort) : null,
    total: data.total || null,
    all_days: data.all_days || null,
    car_name: data.car_name || null,
    pickup: data.pickup || null,
    dropoff: data.dropoff || null,
    seasons: data.seasons || null,
    
    // API флаги
    created_from_api: data.created_from_api !== undefined ? Boolean(data.created_from_api) : null,
    updated_from_api: data.updated_from_api !== undefined ? Boolean(data.updated_from_api) : null,
    
    // Интеграции
    amocrm_id: data.amocrm_id || null,
    amocrm_last_update: data.amocrm_last_update || null,
    ygibdd_id: data.ygibdd_id || null,
    ygibdd_active: data.ygibdd_active !== undefined ? Boolean(data.ygibdd_active) : null,
    ygibdd_status: data.ygibdd_status || null,
    ygibdd_pending: data.ygibdd_pending !== undefined ? Boolean(data.ygibdd_pending) : null,
    
    // Очищаем data после извлечения
    data: null,
  };
}

/**
 * Извлечение полей из clients.data в структурированные колонки
 */
export function extractClientFields(data: any): Record<string, any> {
  if (!data || typeof data !== 'object') {
    return { data: null };
  }

  return {
    // Основные поля
    name: data.name || null,
    lastname: data.lastname || null,
    middlename: data.middlename || null,
    fio: data.fio || null,
    
    // Контакты
    phone: data.phone || null,
    email: data.email || null,
    telegram: data.telegram || null,
    whatsapp: data.whatsapp || null,
    
    // Адрес и локация
    address: data.address || null,
    country: data.country || null,
    city: data.city || null,
    
    // Персональные данные
    birthday: data.birthday || null,
    category: data.category || null,
    lang: data.lang || null,
    
    // Паспорт
    passport_series: data.passport_series || null,
    passport_number: data.passport_number || null,
    passport_issued: data.passport_issued || null,
    passport_issued_date: data.passport_issued_date || null,
    passport_expired_date: data.passport_expired_date || null,
    
    // Водительские права
    driver_series: data.driver_series || null,
    driver_number: data.driver_number || null,
    driver_issued: data.driver_issued || null,
    driver_issued_date: data.driver_issued_date || null,
    driver_expired_date: data.driver_expired_date || null,
    driver_status: data.driver_status || null,
    driver_license_series: data.driver_license_series || null,
    driver_license_number: data.driver_license_number || null,
    driver_license_expires_at: data.driver_license_expires_at || null,
    
    // Юридическое лицо
    entity: data.entity !== undefined ? Boolean(data.entity) : null,
    entity_name: data.entity_name || null,
    short_entity_name: data.short_entity_name || null,
    entity_phone: data.entity_phone || null,
    entity_adress: data.entity_adress || null,
    inn: data.inn || null,
    ogrn: data.ogrn || null,
    ceo: data.ceo || null,
    
    // Банковские данные
    acc_number: data.acc_number || null,
    bank: data.bank || null,
    bik: data.bik || null,
    korr: data.korr || null,
    
    // Финансы
    balance: data.balance || null,
    blocked_balance: data.blocked_balance || null,
    debt: data.debt || null,
    debtor: data.debtor !== undefined ? Boolean(data.debtor) : null,
    debt_description: data.debt_description || null,
    sale: data.sale || null,
    sale_cash: data.sale_cash || null,
    commission_percent: data.commission_percent || null,
    
    // Статус и категория
    vip_status: data.vip_status !== undefined ? Boolean(data.vip_status) : null,
    loyalty_points: data.loyalty_points || null,
    problems: data.problems !== undefined ? Boolean(data.problems) : null,
    problems_description: data.problems_description || null,
    demo: data.demo !== undefined ? Boolean(data.demo) : null,
    
    // Email
    invalid_email: data.invalid_email !== undefined ? Boolean(data.invalid_email) : null,
    invalid_email_reason: data.invalid_email_reason || null,
    send_review_email: data.send_review_email !== undefined ? Boolean(data.send_review_email) : null,
    
    // Системные ID
    company_id: data.company_id || null,
    main_company_id: data.main_company_id || null,
    user_id: data.user_id || null,
    account_id: data.account_id || null,
    car_id: data.car_id || null,
    
    // API флаги
    created_from_api: data.created_from_api !== undefined ? Boolean(data.created_from_api) : null,
    updated_from_api: data.updated_from_api !== undefined ? Boolean(data.updated_from_api) : null,
    
    // Интеграции
    amocrm_id: data.amocrm_id || null,
    amocrm_last_update: data.amocrm_last_update || null,
    vseprokaty_id: data.vseprokaty_id || null,
    
    // Tinkoff
    tinkoff_card_id: data.tinkoff_card_id || null,
    tinkoff_rebill_id: data.tinkoff_rebill_id || null,
    tinkoff_customer_key: data.tinkoff_customer_key || null,
    tinkoff_card_number: data.tinkoff_card_number || null,
    
    // Такси
    taxi_license: data.taxi_license || null,
    taxi_payment_model: data.taxi_payment_model || null,
    yandex_driver_id: data.yandex_driver_id || null,
    
    // Источник
    source: data.source || null,
    
    // Дополнительно
    notes: data.dop_info || data.notes || null,
    last_messaged: data.last_messaged || null,
    preferred_language: data.lang || data.preferred_language || null,
    
    // Очищаем data после извлечения
    data: null,
  };
}

/**
 * Обработка одной записи car - извлечение data и очистка
 */
export async function processCarData(carId: string): Promise<boolean> {
  const db = getDatabase();
  
  try {
    // Получаем запись
    const [car] = await db.select().from(cars).where(eq(cars.id, carId)).limit(1);
    
    if (!car || !car.data) {
      return false; // Нет data для обработки
    }
    
    // Извлекаем поля (приводим к any для избежания ошибок типизации)
    const extractedFields = extractCarFields(car.data as any);
    
    // Обновляем запись
    await db
      .update(cars)
      .set({
        ...extractedFields,
        updated_at: new Date(),
      })
      .where(eq(cars.id, carId));
    
    return true;
  } catch (error) {
    console.error(`Error processing car ${carId}:`, error);
    return false;
  }
}

/**
 * Обработка одной записи client - извлечение data и очистка
 */
export async function processClientData(clientId: string): Promise<boolean> {
  const db = getDatabase();
  
  try {
    // Получаем запись
    const [client] = await db.select().from(clients).where(eq(clients.id, clientId)).limit(1);
    
    if (!client || !client.data) {
      return false; // Нет data для обработки
    }
    
    // Извлекаем поля (приводим к any для избежания ошибок типизации)
    const extractedFields = extractClientFields(client.data as any);
    
    // Обновляем запись
    await db
      .update(clients)
      .set({
        ...extractedFields,
        updated_at: new Date(),
      })
      .where(eq(clients.id, clientId));
    
    return true;
  } catch (error) {
    console.error(`Error processing client ${clientId}:`, error);
    return false;
  }
}

