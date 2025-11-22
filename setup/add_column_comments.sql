-- ============================================================================
-- Миграция: Добавление русских описаний полей (COMMENT ON COLUMN)
-- Дата: 2025-11-14
-- Цель: Для AI агентов, работающих с БД на русском языке
-- ============================================================================

-- ============================================================================
-- ТАБЛИЦА: cars (автомобили из RentProg)
-- ============================================================================

COMMENT ON TABLE cars IS 'Автомобили компании из RentProg';

-- Основные идентификаторы
COMMENT ON COLUMN cars.id IS 'Уникальный идентификатор (UUID)';
COMMENT ON COLUMN cars.rentprog_id IS 'ID автомобиля в RentProg';
COMMENT ON COLUMN cars.branch_id IS 'Филиал (ссылка на branches)';
COMMENT ON COLUMN cars.company_id IS 'ID компании в RentProg';

-- Номера и документы
COMMENT ON COLUMN cars.plate IS 'Государственный номер';
COMMENT ON COLUMN cars.vin IS 'VIN номер';
COMMENT ON COLUMN cars.body_number IS '№ кузова';
COMMENT ON COLUMN cars.pts IS 'ПТС (серия номер)';
COMMENT ON COLUMN cars.registration_certificate IS 'Свидетельство о регистрации (серия номер)';

-- Основные характеристики
COMMENT ON COLUMN cars.model IS 'Название (марка и модель)';
COMMENT ON COLUMN cars.code IS 'Внутренний код';
COMMENT ON COLUMN cars.car_name IS 'Полное название автомобиля';
COMMENT ON COLUMN cars.sort IS '№ сортировки';
COMMENT ON COLUMN cars.number IS 'Внутренний номер';

-- Тип и класс
COMMENT ON COLUMN cars.car_type IS 'Тип кузова (седан, хэтчбек и т.д.)';
COMMENT ON COLUMN cars.car_class IS 'Класс автомобиля (эконом, средний, премиум)';
COMMENT ON COLUMN cars.color IS 'Цвет';
COMMENT ON COLUMN cars.year IS 'Год выпуска';

-- Трансмиссия и привод
COMMENT ON COLUMN cars.transmission IS 'Коробка передач (автомат, механика)';
COMMENT ON COLUMN cars.drive_unit IS 'Привод (передний, задний, полный)';
COMMENT ON COLUMN cars.fuel IS 'Тип топлива (бензин, дизель)';

-- Объемы и расход
COMMENT ON COLUMN cars.tank_value IS 'Объём бака (литры)';
COMMENT ON COLUMN cars.gas_mileage IS 'Расход топлива на 100 км (литры)';
COMMENT ON COLUMN cars.engine_capacity IS 'Объём двигателя (литры)';
COMMENT ON COLUMN cars.engine_power IS 'Мощность двигателя (л.с.)';

-- Конфигурация
COMMENT ON COLUMN cars.steering_side IS 'Сторона руля (левая, правая)';
COMMENT ON COLUMN cars.number_doors IS 'Количество дверей';
COMMENT ON COLUMN cars.number_seats IS 'Количество мест';
COMMENT ON COLUMN cars.trunk_volume IS 'Объём багажника (литры)';

-- Шины
COMMENT ON COLUMN cars.tire_size IS 'Размер шин';
COMMENT ON COLUMN cars.tire_type IS 'Тип резины (лето/зима)';

-- Страхование и штрафы
COMMENT ON COLUMN cars.franchise IS 'Размер франшизы';
COMMENT ON COLUMN cars.max_fine IS 'Максимальный штраф';
COMMENT ON COLUMN cars.repair_cost IS 'Стоимость ремонта 1 элемента кузова';
COMMENT ON COLUMN cars.insurance IS 'Страховка';

-- Пробег
COMMENT ON COLUMN cars.mileage IS 'Текущий пробег (км)';
COMMENT ON COLUMN cars.start_mileage IS 'Начальный пробег (км)';
COMMENT ON COLUMN cars.mileage_limit IS 'Лимит пробега';
COMMENT ON COLUMN cars.extra_mileage_km IS 'Дополнительный пробег (км)';
COMMENT ON COLUMN cars.extra_mileage_price IS 'Цена за доп. пробег';

-- Опции и оборудование
COMMENT ON COLUMN cars.abs IS 'ABS (антиблокировочная система)';
COMMENT ON COLUMN cars.ebd IS 'EBD (электронное распределение тормозных усилий)';
COMMENT ON COLUMN cars.esp IS 'ESP (система стабилизации)';
COMMENT ON COLUMN cars.is_air IS 'Кондиционер';
COMMENT ON COLUMN cars.climate_control IS 'Климат-контроль';
COMMENT ON COLUMN cars.heated_seats IS 'Подогрев сидений';
COMMENT ON COLUMN cars.heated_seats_front IS 'Подогрев передних сидений';
COMMENT ON COLUMN cars.heated_windshield IS 'Подогрев лобового стекла';
COMMENT ON COLUMN cars.parktronic IS 'Парктроник';
COMMENT ON COLUMN cars.parktronic_back IS 'Парктроник задний';
COMMENT ON COLUMN cars.parktronic_camera IS 'Камера заднего вида';
COMMENT ON COLUMN cars.audio_system IS 'Аудиосистема';
COMMENT ON COLUMN cars.video_system IS 'Видеосистема';
COMMENT ON COLUMN cars.cd_system IS 'CD система';
COMMENT ON COLUMN cars.tv_system IS 'TV система';
COMMENT ON COLUMN cars.usb_system IS 'USB разъем';
COMMENT ON COLUMN cars.rain_sensor IS 'Датчик дождя';
COMMENT ON COLUMN cars.wheel_adjustment IS 'Регулировка руля';
COMMENT ON COLUMN cars.wheel_adjustment_full IS 'Полная регулировка руля';
COMMENT ON COLUMN cars.window_lifters IS 'Электростеклоподъемники';
COMMENT ON COLUMN cars.is_electropackage IS 'Электропакет';
COMMENT ON COLUMN cars.folding_seats IS 'Складывающиеся сиденья';
COMMENT ON COLUMN cars.airbags IS 'Подушки безопасности';

-- Состояние
COMMENT ON COLUMN cars.state IS 'Состояние автомобиля (1-отличное, 2-хорошее и т.д.)';
COMMENT ON COLUMN cars.active IS 'Активен (доступен для аренды)';
COMMENT ON COLUMN cars.archive IS 'В архиве';
COMMENT ON COLUMN cars.free IS 'Свободен';
COMMENT ON COLUMN cars.demo IS 'Демонстрационный';
COMMENT ON COLUMN cars.tank_state IS 'Состояние бака (полный/пустой)';
COMMENT ON COLUMN cars.clean_state IS 'Чистота автомобиля';

-- Цены и депозиты
COMMENT ON COLUMN cars.prices IS 'Ценовая сетка (JSON): {1-2: 107, 3-4: 102, ...}';
COMMENT ON COLUMN cars.price_hour IS 'Цена за час';
COMMENT ON COLUMN cars.deposit IS 'Залог';
COMMENT ON COLUMN cars.hourly_deposit IS 'Почасовой депозит';
COMMENT ON COLUMN cars.weekly_deposit IS 'Недельный депозит';
COMMENT ON COLUMN cars.monthly_deposit IS 'Месячный депозит';
COMMENT ON COLUMN cars.average_price IS 'Средняя цена';
COMMENT ON COLUMN cars.start_price IS 'Начальная цена';
COMMENT ON COLUMN cars.selected_price IS 'Выбранная цена';
COMMENT ON COLUMN cars.price_periods IS 'Периоды цен';

-- Обслуживание
COMMENT ON COLUMN cars.oil_engine IS 'Моторное масло';
COMMENT ON COLUMN cars.oil_engine_km IS 'Пробег замены масла (км)';
COMMENT ON COLUMN cars.oil_engine_date IS 'Дата замены масла';
COMMENT ON COLUMN cars.oil_transmission IS 'Трансмиссионное масло';
COMMENT ON COLUMN cars.oil_transmission_km IS 'Пробег замены трансм. масла (км)';
COMMENT ON COLUMN cars.oil_transmission_date IS 'Дата замены трансм. масла';
COMMENT ON COLUMN cars.antifreeze IS 'Антифриз';
COMMENT ON COLUMN cars.antifreeze_km IS 'Пробег замены антифриза (км)';
COMMENT ON COLUMN cars.antifreeze_date IS 'Дата замены антифриза';
COMMENT ON COLUMN cars.brake_fluid IS 'Тормозная жидкость';
COMMENT ON COLUMN cars.brake_fluid_km IS 'Пробег замены тормозной жидкости (км)';
COMMENT ON COLUMN cars.brake_fluid_date IS 'Дата замены тормозной жидкости';
COMMENT ON COLUMN cars.power_steering IS 'Жидкость ГУР';
COMMENT ON COLUMN cars.power_steering_km IS 'Пробег замены жидкости ГУР (км)';
COMMENT ON COLUMN cars.power_steering_date IS 'Дата замены жидкости ГУР';
COMMENT ON COLUMN cars.fuel_filter_renew IS 'Топливный фильтр';
COMMENT ON COLUMN cars.fuel_filter_renew_km IS 'Пробег замены топливного фильтра (км)';
COMMENT ON COLUMN cars.fuel_filter_renew_date IS 'Дата замены топливного фильтра';
COMMENT ON COLUMN cars.salon_filter_renew IS 'Салонный фильтр';
COMMENT ON COLUMN cars.salon_filter_renew_km IS 'Пробег замены салонного фильтра (км)';
COMMENT ON COLUMN cars.salon_filter_renew_date IS 'Дата замены салонного фильтра';
COMMENT ON COLUMN cars.candle IS 'Свечи';
COMMENT ON COLUMN cars.candle_km IS 'Пробег замены свечей (км)';
COMMENT ON COLUMN cars.candle_date IS 'Дата замены свечей';
COMMENT ON COLUMN cars.grm IS 'ГРМ (ремень/цепь)';
COMMENT ON COLUMN cars.grm_km IS 'Пробег замены ГРМ (км)';
COMMENT ON COLUMN cars.grm_date IS 'Дата замены ГРМ';
COMMENT ON COLUMN cars.akb_renew IS 'АКБ (аккумулятор)';
COMMENT ON COLUMN cars.akb_renew_km IS 'Пробег замены АКБ (км)';
COMMENT ON COLUMN cars.akb_renew_date IS 'Дата замены АКБ';

-- Техосмотр и документы
COMMENT ON COLUMN cars.last_inspection IS 'Последний техосмотр';
COMMENT ON COLUMN cars.diagnostic_card IS 'Диагностическая карта';
COMMENT ON COLUMN cars.inspections_count IS 'Количество техосмотров';

-- Покупка и продажа
COMMENT ON COLUMN cars.purchase_date IS 'Дата покупки';
COMMENT ON COLUMN cars.purchase_price IS 'Цена покупки';
COMMENT ON COLUMN cars.sale_date IS 'Дата продажи';
COMMENT ON COLUMN cars.sale_price IS 'Цена продажи';
COMMENT ON COLUMN cars.investor_id IS 'ID инвестора';

-- Брони и статистика
COMMENT ON COLUMN cars.bookings_count IS 'Количество броней';
COMMENT ON COLUMN cars.active_bookings IS 'Активные брони';
COMMENT ON COLUMN cars.active_bookings_count IS 'Количество активных броней';
COMMENT ON COLUMN cars.rided_bookings_count IS 'Количество завершенных броней';
COMMENT ON COLUMN cars.in_rent_bookings_count IS 'Количество броней в прокате';
COMMENT ON COLUMN cars.last_booking_on_dates IS 'Последняя бронь (даты)';
COMMENT ON COLUMN cars.next_booking_on_dates IS 'Следующая бронь (даты)';

-- Интеграции
COMMENT ON COLUMN cars.starline_id IS 'ID в системе Starline (GPS)';
COMMENT ON COLUMN cars.traccar_id IS 'ID в системе Traccar (GPS)';
COMMENT ON COLUMN cars.ygibdd_id IS 'ID в системе ГИБДД';
COMMENT ON COLUMN cars.ygibdd_status IS 'Статус проверки ГИБДД';
COMMENT ON COLUMN cars.ygibdd_active IS 'Активна ли проверка ГИБДД';
COMMENT ON COLUMN cars.ygibdd_pending IS 'Ожидает проверки ГИБДД';
COMMENT ON COLUMN cars.amocrm_id IS 'ID в AmoCRM';
COMMENT ON COLUMN cars.amocrm_last_update IS 'Последнее обновление из AmoCRM';
COMMENT ON COLUMN cars.yandex_vehicle_id IS 'ID автомобиля в Яндекс.Такси';
COMMENT ON COLUMN cars.taxi_vehicle_class IS 'Класс автомобиля в такси';
COMMENT ON COLUMN cars.taxi_permit_number IS 'Номер разрешения на такси';
COMMENT ON COLUMN cars.taxi_permit_expires_at IS 'Срок действия разрешения на такси';
COMMENT ON COLUMN cars.taxi_vehicle_data IS 'Данные автомобиля для такси (JSON)';
COMMENT ON COLUMN cars.in_agregator IS 'В агрегаторе';
COMMENT ON COLUMN cars.in_agregator_date IS 'Дата добавления в агрегатор';
COMMENT ON COLUMN cars.ready_for_agregator IS 'Готов для агрегатора';
COMMENT ON COLUMN cars.in_localrent IS 'В LocalRent';

-- Геолокация и адреса
COMMENT ON COLUMN cars.latitude IS 'Широта';
COMMENT ON COLUMN cars.longitude IS 'Долгота';
COMMENT ON COLUMN cars.city IS 'Город';
COMMENT ON COLUMN cars.timezone IS 'Часовой пояс';
COMMENT ON COLUMN cars.locations IS 'Локации (JSON)';
COMMENT ON COLUMN cars.pickup IS 'Место выдачи';
COMMENT ON COLUMN cars.dropoff IS 'Место возврата';
COMMENT ON COLUMN cars.store_place IS 'Место хранения';

-- Дополнительные поля
COMMENT ON COLUMN cars.description IS 'Описание';
COMMENT ON COLUMN cars.booking_description IS 'Описание для брони';
COMMENT ON COLUMN cars.custom_field_1 IS 'Дополнительное поле 1';
COMMENT ON COLUMN cars.custom_field_2 IS 'Дополнительное поле 2';
COMMENT ON COLUMN cars.custom_field_3 IS 'Дополнительное поле 3';
COMMENT ON COLUMN cars.sipp IS 'SIPP код';
COMMENT ON COLUMN cars.photo IS 'Основное фото (URL)';
COMMENT ON COLUMN cars.photos IS 'Все фотографии (JSON)';
COMMENT ON COLUMN cars.avatar_url IS 'Аватар (URL)';

-- Служебные поля
COMMENT ON COLUMN cars.data IS 'Полные данные из RentProg API (JSON)';
COMMENT ON COLUMN cars.history_log IS 'История изменений (JSON)';
COMMENT ON COLUMN cars.created_at IS 'Дата создания записи';
COMMENT ON COLUMN cars.updated_at IS 'Дата последнего обновления';
COMMENT ON COLUMN cars.created_from_api IS 'Создано через API';
COMMENT ON COLUMN cars.updated_from_api IS 'Обновлено через API';
COMMENT ON COLUMN cars.user_id IS 'ID пользователя (создатель)';

-- Ссылки
COMMENT ON COLUMN cars.ru_link IS 'Ссылка на русскую версию';
COMMENT ON COLUMN cars.en_link IS 'Ссылка на английскую версию';


-- ============================================================================
-- ТАБЛИЦА: bookings (брони из RentProg)
-- ============================================================================

COMMENT ON TABLE bookings IS 'Брони автомобилей из RentProg';

-- Идентификаторы
COMMENT ON COLUMN bookings.id IS 'Уникальный идентификатор (UUID)';
COMMENT ON COLUMN bookings.branch IS 'Филиал (tbilisi, batumi, kutaisi, service-center)';
COMMENT ON COLUMN bookings.number IS 'Номер брони в RentProg';
COMMENT ON COLUMN bookings.is_active IS 'Активна ли бронь';

-- Даты
COMMENT ON COLUMN bookings.start_date IS 'Дата и время начала аренды';
COMMENT ON COLUMN bookings.end_date IS 'Дата и время окончания аренды';
COMMENT ON COLUMN bookings.start_date_formatted IS 'Начало аренды (форматированная строка)';
COMMENT ON COLUMN bookings.end_date_formatted IS 'Окончание аренды (форматированная строка)';
COMMENT ON COLUMN bookings.created_at IS 'Дата создания брони';

-- Клиент
COMMENT ON COLUMN bookings.client_id IS 'ID клиента в RentProg';
COMMENT ON COLUMN bookings.client_name IS 'Полное имя клиента';
COMMENT ON COLUMN bookings.client_category IS 'Категория клиента (новый, лояльный и т.д.)';

-- Автомобиль
COMMENT ON COLUMN bookings.car_id IS 'ID автомобиля в RentProg';
COMMENT ON COLUMN bookings.car_name IS 'Название автомобиля';
COMMENT ON COLUMN bookings.car_code IS 'Код автомобиля';

-- Локации
COMMENT ON COLUMN bookings.location_start IS 'Место выдачи автомобиля';
COMMENT ON COLUMN bookings.location_end IS 'Место возврата автомобиля';

-- Финансы
COMMENT ON COLUMN bookings.total IS 'Общая сумма брони';
COMMENT ON COLUMN bookings.deposit IS 'Залог';
COMMENT ON COLUMN bookings.rental_cost IS 'Стоимость аренды';
COMMENT ON COLUMN bookings.days IS 'Количество дней аренды';

-- Статусы
COMMENT ON COLUMN bookings.state IS 'Состояние брони (активная, завершенная и т.д.)';
COMMENT ON COLUMN bookings.in_rent IS 'Автомобиль сейчас в прокате';
COMMENT ON COLUMN bookings.archive IS 'Бронь в архиве';

-- Ответственные
COMMENT ON COLUMN bookings.start_worker_id IS 'ID сотрудника выдавшего автомобиль';
COMMENT ON COLUMN bookings.end_worker_id IS 'ID сотрудника принявшего автомобиль';
COMMENT ON COLUMN bookings.responsible IS 'Ответственный за бронь';

-- Дополнительная информация
COMMENT ON COLUMN bookings.description IS 'Описание/примечания к брони';
COMMENT ON COLUMN bookings.source IS 'Источник брони (сайт, телефон, сотрудник и т.д.)';

-- Технические брони
COMMENT ON COLUMN bookings.is_technical IS 'Техническая бронь (не клиентская)';
COMMENT ON COLUMN bookings.technical_type IS 'Тип технической брони (regular, technical, technical_repair)';
COMMENT ON COLUMN bookings.technical_purpose IS 'Назначение технической брони (repair, employee_trip)';

-- Полные данные
COMMENT ON COLUMN bookings.data IS 'Полные данные из RentProg API (JSON)';

-- Служебные поля
COMMENT ON COLUMN bookings.updated_at IS 'Дата последнего обновления';


-- ============================================================================
-- ТАБЛИЦА: clients (клиенты из RentProg)
-- ============================================================================

COMMENT ON TABLE clients IS 'Клиенты из RentProg';

COMMENT ON COLUMN clients.id IS 'Уникальный идентификатор (UUID)';
COMMENT ON COLUMN clients.name IS 'Полное имя клиента';
COMMENT ON COLUMN clients.fio IS 'ФИО (полное)';
COMMENT ON COLUMN clients.lastname IS 'Фамилия';
COMMENT ON COLUMN clients.middlename IS 'Отчество';
COMMENT ON COLUMN clients.email IS 'Email адрес';
COMMENT ON COLUMN clients.phone IS 'Номер телефона';
COMMENT ON COLUMN clients.category IS 'Категория клиента (новый, лояльный и т.д.)';
COMMENT ON COLUMN clients.debtor IS 'Должник';
COMMENT ON COLUMN clients.telegram IS 'Telegram username';
COMMENT ON COLUMN clients.whatsapp IS 'WhatsApp номер';
COMMENT ON COLUMN clients.company_id IS 'ID компании в RentProg';
COMMENT ON COLUMN clients.vip_status IS 'VIP статус';
COMMENT ON COLUMN clients.loyalty_points IS 'Бонусные баллы';
COMMENT ON COLUMN clients.passport_number IS 'Номер паспорта';
COMMENT ON COLUMN clients.passport_series IS 'Серия паспорта';
COMMENT ON COLUMN clients.passport_issued IS 'Кем выдан паспорт';
COMMENT ON COLUMN clients.passport_issued_date IS 'Дата выдачи паспорта';
COMMENT ON COLUMN clients.passport_expired_date IS 'Срок действия паспорта';
COMMENT ON COLUMN clients.passport_expiry IS 'Истечение паспорта';
COMMENT ON COLUMN clients.driver_license_number IS 'Номер водительского удостоверения';
COMMENT ON COLUMN clients.driver_license_series IS 'Серия водительского удостоверения';
COMMENT ON COLUMN clients.driver_issued IS 'Кем выдано ВУ';
COMMENT ON COLUMN clients.driver_issued_date IS 'Дата выдачи ВУ';
COMMENT ON COLUMN clients.driver_expired_date IS 'Срок действия ВУ';
COMMENT ON COLUMN clients.driver_license_expires_at IS 'Истечение ВУ';
COMMENT ON COLUMN clients.preferred_language IS 'Предпочитаемый язык';
COMMENT ON COLUMN clients.lang IS 'Язык общения';
COMMENT ON COLUMN clients.country IS 'Страна';
COMMENT ON COLUMN clients.city IS 'Город';
COMMENT ON COLUMN clients.address IS 'Адрес';
COMMENT ON COLUMN clients.birthday IS 'Дата рождения';
COMMENT ON COLUMN clients.entity IS 'Юридическое лицо (да/нет)';
COMMENT ON COLUMN clients.entity_name IS 'Название юр. лица';
COMMENT ON COLUMN clients.entity_phone IS 'Телефон юр. лица';
COMMENT ON COLUMN clients.entity_adress IS 'Адрес юр. лица';
COMMENT ON COLUMN clients.inn IS 'ИНН';
COMMENT ON COLUMN clients.ogrn IS 'ОГРН';
COMMENT ON COLUMN clients.balance IS 'Баланс клиента';
COMMENT ON COLUMN clients.debt IS 'Долг';
COMMENT ON COLUMN clients.debt_description IS 'Описание долга';
COMMENT ON COLUMN clients.blocked_balance IS 'Заблокированный баланс';
COMMENT ON COLUMN clients.source IS 'Источник (откуда узнал)';
COMMENT ON COLUMN clients.amocrm_id IS 'ID в AmoCRM';
COMMENT ON COLUMN clients.amocrm_last_update IS 'Последнее обновление из AmoCRM';
COMMENT ON COLUMN clients.yandex_driver_id IS 'ID водителя в Яндекс.Такси';
COMMENT ON COLUMN clients.taxi_license IS 'Лицензия такси';
COMMENT ON COLUMN clients.driver_status IS 'Статус водителя';
COMMENT ON COLUMN clients.taxi_driver_data IS 'Данные водителя такси (JSON)';
COMMENT ON COLUMN clients.taxi_payment_model IS 'Модель оплаты такси';
COMMENT ON COLUMN clients.commission_percent IS 'Процент комиссии';
COMMENT ON COLUMN clients.data IS 'Полные данные из RentProg API (JSON)';
COMMENT ON COLUMN clients.history_log IS 'История изменений (JSON)';
COMMENT ON COLUMN clients.created_at IS 'Дата создания записи';
COMMENT ON COLUMN clients.updated_at IS 'Дата последнего обновления';
COMMENT ON COLUMN clients.created_from_api IS 'Создано через API';
COMMENT ON COLUMN clients.updated_from_api IS 'Обновлено через API';


-- ============================================================================
-- ТАБЛИЦА: branches (филиалы)
-- ============================================================================

COMMENT ON TABLE branches IS 'Филиалы компании';

COMMENT ON COLUMN branches.id IS 'Уникальный идентификатор (UUID)';
COMMENT ON COLUMN branches.code IS 'Код филиала (tbilisi, batumi, kutaisi, service-center)';
COMMENT ON COLUMN branches.name IS 'Название филиала';
COMMENT ON COLUMN branches.company_id IS 'ID компании в RentProg';
COMMENT ON COLUMN branches.created_at IS 'Дата создания';
COMMENT ON COLUMN branches.updated_at IS 'Дата обновления';


-- ============================================================================
-- ТАБЛИЦА: payments (платежи из RentProg)
-- ============================================================================

COMMENT ON TABLE payments IS 'Платежи по броням из RentProg';

COMMENT ON COLUMN payments.id IS 'Уникальный идентификатор (UUID)';
COMMENT ON COLUMN payments.branch IS 'Филиал (tbilisi, batumi, kutaisi, service-center)';
COMMENT ON COLUMN payments.branch_id IS 'ID филиала (ссылка на branches)';
COMMENT ON COLUMN payments.booking_id IS 'ID брони (ссылка на bookings)';
COMMENT ON COLUMN payments.payment_id IS 'ID платежа';
COMMENT ON COLUMN payments.rp_payment_id IS 'ID платежа в RentProg';
COMMENT ON COLUMN payments.employee_id IS 'ID сотрудника';
COMMENT ON COLUMN payments.rp_client_id IS 'ID клиента в RentProg';
COMMENT ON COLUMN payments.rp_car_id IS 'ID автомобиля в RentProg';
COMMENT ON COLUMN payments.car_code IS 'Код автомобиля';
COMMENT ON COLUMN payments.payment_date IS 'Дата платежа';
COMMENT ON COLUMN payments.payment_type IS 'Тип платежа (наличные, карта, перевод и т.д.)';
COMMENT ON COLUMN payments.payment_method IS 'Метод платежа';
COMMENT ON COLUMN payments.group IS 'Группа платежа';
COMMENT ON COLUMN payments.subgroup IS 'Подгруппа платежа';
COMMENT ON COLUMN payments.payment_subgroup IS 'Подгруппа платежа (доп.)';
COMMENT ON COLUMN payments.amount IS 'Сумма платежа';
COMMENT ON COLUMN payments.sum IS 'Сумма';
COMMENT ON COLUMN payments.cash IS 'Наличные';
COMMENT ON COLUMN payments.cashless IS 'Безнал';
COMMENT ON COLUMN payments.currency IS 'Валюта';
COMMENT ON COLUMN payments.exchange_rate IS 'Курс обмена';
COMMENT ON COLUMN payments.rated_amount IS 'Сумма по курсу';
COMMENT ON COLUMN payments.last_balance IS 'Последний баланс';
COMMENT ON COLUMN payments.description IS 'Описание платежа';
COMMENT ON COLUMN payments.has_check IS 'Есть чек';
COMMENT ON COLUMN payments.is_completed IS 'Завершен';
COMMENT ON COLUMN payments.is_operation IS 'Операция';
COMMENT ON COLUMN payments.is_tinkoff_paid IS 'Оплачено через Tinkoff';
COMMENT ON COLUMN payments.is_client_balance IS 'С баланса клиента';
COMMENT ON COLUMN payments.completed_at IS 'Дата завершения';
COMMENT ON COLUMN payments.completed_by IS 'Завершил (сотрудник)';
COMMENT ON COLUMN payments.raw_data IS 'Сырые данные (JSON)';
COMMENT ON COLUMN payments.created_at IS 'Дата создания записи';
COMMENT ON COLUMN payments.updated_at IS 'Дата обновления';


-- ============================================================================
-- ТАБЛИЦА: events (события вебхуков от RentProg)
-- ============================================================================

COMMENT ON TABLE events IS 'События от вебхуков RentProg для отслеживания обработки';

COMMENT ON COLUMN events.id IS 'Уникальный идентификатор';
COMMENT ON COLUMN events.ts IS 'Время получения события';
COMMENT ON COLUMN events.type IS 'Тип события (booking.created, car.updated и т.д.)';
COMMENT ON COLUMN events.ext_id IS 'Внешний ID (ID сущности в RentProg)';
COMMENT ON COLUMN events.ok IS 'Успешно обработано';
COMMENT ON COLUMN events.reason IS 'Причина ошибки (если не обработано)';
COMMENT ON COLUMN events.processed IS 'Флаг обработки события';
COMMENT ON COLUMN events.rentprog_id IS 'ID в RentProg';
COMMENT ON COLUMN events.company_id IS 'ID компании';
COMMENT ON COLUMN events.event_hash IS 'Хэш события для дедупликации';
COMMENT ON COLUMN events.payload IS 'Полезная нагрузка события (JSON)';
COMMENT ON COLUMN events.operation IS 'Операция (create, update, delete)';
COMMENT ON COLUMN events.entity_type IS 'Тип сущности (booking, car, client и т.д.)';
COMMENT ON COLUMN events.event_name IS 'Название события';
COMMENT ON COLUMN events.metadata IS 'Метаданные события (JSON)';
COMMENT ON COLUMN events.execution_id IS 'ID выполнения n8n workflow';
COMMENT ON COLUMN events.execution_url IS 'URL выполнения в n8n';


-- ============================================================================
-- ТАБЛИЦА: external_refs (внешние ссылки между системами)
-- ============================================================================

COMMENT ON TABLE external_refs IS 'Связи между нашими UUID и ID во внешних системах';

COMMENT ON COLUMN external_refs.id IS 'Уникальный идентификатор';
COMMENT ON COLUMN external_refs.entity_type IS 'Тип сущности (car, client, booking, branch)';
COMMENT ON COLUMN external_refs.entity_id IS 'Наш UUID сущности';
COMMENT ON COLUMN external_refs.system IS 'Внешняя система (rentprog, amocrm, starline, umnico)';
COMMENT ON COLUMN external_refs.external_id IS 'ID сущности во внешней системе';
COMMENT ON COLUMN external_refs.branch_code IS 'Код филиала';
COMMENT ON COLUMN external_refs.meta IS 'Метаданные (JSON)';
COMMENT ON COLUMN external_refs.data IS 'Дополнительные данные связи (JSON)';
COMMENT ON COLUMN external_refs.created_at IS 'Дата создания связи';
COMMENT ON COLUMN external_refs.updated_at IS 'Дата обновления';


-- ============================================================================
-- КОНЕЦ МИГРАЦИИ
-- ============================================================================

