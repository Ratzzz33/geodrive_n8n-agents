-- =====================================================
-- Базовый маппинг типов операций из history
-- =====================================================
-- Дата: 2025-01-17
-- Описание: Начальное заполнение таблицы history_operation_mappings

-- Очистка (если нужно пересоздать)
-- TRUNCATE history_operation_mappings RESTART IDENTITY;

-- =====================================================
-- 1. ВЕБХУК СОБЫТИЯ (matched, skip processing)
-- =====================================================
-- Приоритет 100 - пропускаем, т.к. обрабатываются через webhooks

-- Car events
INSERT INTO history_operation_mappings (operation_type, matched_event_type, is_webhook_event, target_table, processing_strategy, field_mappings, priority, notes)
VALUES
('car_create', 'car_create', true, 'skip', 'skip', '{}'::jsonb, 100, 'Обрабатывается через вебхук RentProg'),
('car_update', 'car_update', true, 'skip', 'skip', '{}'::jsonb, 100, 'Обрабатывается через вебхук RentProg'),
('car_destroy', 'car_destroy', true, 'skip', 'skip', '{}'::jsonb, 100, 'Обрабатывается через вебхук RentProg')
ON CONFLICT (operation_type) DO NOTHING;

-- Client events
INSERT INTO history_operation_mappings (operation_type, matched_event_type, is_webhook_event, target_table, processing_strategy, field_mappings, priority, notes)
VALUES
('client_create', 'client_create', true, 'skip', 'skip', '{}'::jsonb, 100, 'Обрабатывается через вебхук RentProg'),
('client_update', 'client_update', true, 'skip', 'skip', '{}'::jsonb, 100, 'Обрабатывается через вебхук RentProg'),
('client_destroy', 'client_destroy', true, 'skip', 'skip', '{}'::jsonb, 100, 'Обрабатывается через вебхук RentProg')
ON CONFLICT (operation_type) DO NOTHING;

-- Booking events
INSERT INTO history_operation_mappings (operation_type, matched_event_type, is_webhook_event, target_table, processing_strategy, field_mappings, priority, notes)
VALUES
('booking_create', 'booking_create', true, 'skip', 'skip', '{}'::jsonb, 100, 'Обрабатывается через вебхук RentProg'),
('booking_update', 'booking_update', true, 'skip', 'skip', '{}'::jsonb, 100, 'Обрабатывается через вебхук RentProg'),
('booking_destroy', 'booking_destroy', true, 'skip', 'skip', '{}'::jsonb, 100, 'Обрабатывается через вебхук RentProg')
ON CONFLICT (operation_type) DO NOTHING;

-- =====================================================
-- 2. ПЛАТЕЖИ (НЕ из вебхуков) - Приоритет 90
-- =====================================================

INSERT INTO history_operation_mappings (operation_type, matched_event_type, is_webhook_event, target_table, processing_strategy, field_mappings, priority, notes)
VALUES
('payment.received', NULL, false, 'payments', 'extract_payment', 
'{
  "payment_type": "$.payment_type",
  "payment_method": "$.payment_method",
  "amount": "$.amount",
  "currency": "$.currency",
  "payment_date": "$.created_at",
  "rp_payment_id": "$.id",
  "rp_client_id": "$.client_id",
  "rp_car_id": "$.car_id",
  "rp_user_id": "$.user_id",
  "description": "$.description"
}'::jsonb, 90, 'Платёж от клиента (НЕ приходит в вебхуках)'),

('payment.refund', NULL, false, 'payments', 'extract_payment', 
'{
  "payment_type": "refund",
  "payment_method": "$.payment_method",
  "amount": "$.amount",
  "currency": "$.currency",
  "payment_date": "$.created_at",
  "rp_payment_id": "$.id",
  "rp_client_id": "$.client_id",
  "description": "$.description"
}'::jsonb, 90, 'Возврат средств клиенту'),

('payment.cashless', NULL, false, 'payments', 'extract_payment', 
'{
  "payment_type": "$.payment_type",
  "payment_method": "cashless",
  "amount": "$.amount",
  "currency": "$.currency",
  "payment_date": "$.created_at",
  "rp_payment_id": "$.id",
  "rp_client_id": "$.client_id",
  "description": "$.description"
}'::jsonb, 90, 'Безналичный платёж')
ON CONFLICT (operation_type) DO NOTHING;

-- =====================================================
-- 3. КАССОВЫЕ ОПЕРАЦИИ - Приоритет 90
-- =====================================================

INSERT INTO history_operation_mappings (operation_type, matched_event_type, is_webhook_event, target_table, processing_strategy, field_mappings, priority, notes)
VALUES
('cash.collected', NULL, false, 'employees', 'update_employee_cash', 
'{
  "employee_rp_id": "$.user_id",
  "amount": "$.amount",
  "currency": "$.currency",
  "operation": "collect",
  "description": "$.description"
}'::jsonb, 90, 'Инкассация кассы сотрудника'),

('cashbox.transfer', NULL, false, 'employees', 'cashbox_transfer', 
'{
  "from_user_id": "$.from_user_id",
  "to_user_id": "$.to_user_id",
  "amount": "$.amount",
  "currency": "$.currency",
  "description": "$.description"
}'::jsonb, 90, 'Перевод между кассами'),

('cash.adjustment', NULL, false, 'employees', 'update_employee_cash', 
'{
  "employee_rp_id": "$.user_id",
  "amount": "$.amount",
  "currency": "$.currency",
  "operation": "adjust",
  "description": "$.description"
}'::jsonb, 90, 'Корректировка остатка кассы')
ON CONFLICT (operation_type) DO NOTHING;

-- =====================================================
-- 4. ТЕХОБСЛУЖИВАНИЕ И РЕМОНТЫ - Приоритет 70
-- =====================================================

INSERT INTO history_operation_mappings (operation_type, matched_event_type, is_webhook_event, target_table, processing_strategy, field_mappings, priority, notes)
VALUES
('car.maintenance', NULL, false, 'cars', 'add_maintenance_note', 
'{
  "car_rp_id": "$.entity_id",
  "description": "$.description",
  "cost": "$.cost",
  "mileage": "$.mileage",
  "created_at": "$.created_at"
}'::jsonb, 70, 'Техническое обслуживание автомобиля'),

('car.repair', NULL, false, 'cars', 'add_maintenance_note', 
'{
  "car_rp_id": "$.entity_id",
  "description": "$.description",
  "cost": "$.cost",
  "created_at": "$.created_at"
}'::jsonb, 70, 'Ремонт автомобиля'),

('car.disabled', NULL, false, 'cars', 'update_car_status', 
'{
  "car_rp_id": "$.entity_id",
  "status": "disabled",
  "reason": "$.description",
  "disabled_at": "$.created_at"
}'::jsonb, 70, 'Автомобиль выведен из эксплуатации'),

('car.enabled', NULL, false, 'cars', 'update_car_status', 
'{
  "car_rp_id": "$.entity_id",
  "status": "available",
  "enabled_at": "$.created_at"
}'::jsonb, 70, 'Автомобиль возвращён в эксплуатацию')
ON CONFLICT (operation_type) DO NOTHING;

-- =====================================================
-- 5. ПЕРЕМЕЩЕНИЯ АВТОМОБИЛЕЙ - Приоритет 70
-- =====================================================

INSERT INTO history_operation_mappings (operation_type, matched_event_type, is_webhook_event, target_table, processing_strategy, field_mappings, priority, notes)
VALUES
('car.moved', 'car.moved', false, 'cars', 'update_car_location', 
'{
  "car_rp_id": "$.entity_id",
  "from_branch": "$.from_location",
  "to_branch": "$.to_location",
  "moved_at": "$.created_at",
  "user_name": "$.user_name"
}'::jsonb, 70, 'Перемещение автомобиля между филиалами (может дублировать вебхук)'),

('car.relocated', NULL, false, 'cars', 'update_car_location', 
'{
  "car_rp_id": "$.entity_id",
  "to_branch": "$.location",
  "moved_at": "$.created_at"
}'::jsonb, 70, 'Изменение локации автомобиля')
ON CONFLICT (operation_type) DO NOTHING;

-- =====================================================
-- 6. СОБЫТИЯ БРОНЕЙ (промежуточные статусы) - Приоритет 70
-- =====================================================

INSERT INTO history_operation_mappings (operation_type, matched_event_type, is_webhook_event, target_table, processing_strategy, field_mappings, priority, notes)
VALUES
('booking.issue.planned', 'booking.issue.planned', false, 'bookings', 'update_booking_status', 
'{
  "booking_rp_id": "$.entity_id",
  "status": "issue_planned",
  "issue_planned_at": "$.planned_at",
  "updated_at": "$.created_at"
}'::jsonb, 70, 'Запланирована выдача (может дублировать вебхук)'),

('booking.issue.completed', NULL, false, 'bookings', 'update_booking_status', 
'{
  "booking_rp_id": "$.entity_id",
  "status": "issued",
  "issue_actual_at": "$.created_at",
  "mileage_start": "$.mileage",
  "fuel_start": "$.fuel_level"
}'::jsonb, 70, 'Выдача завершена'),

('booking.return.planned', 'booking.return.planned', false, 'bookings', 'update_booking_status', 
'{
  "booking_rp_id": "$.entity_id",
  "status": "return_planned",
  "return_planned_at": "$.planned_at",
  "updated_at": "$.created_at"
}'::jsonb, 70, 'Запланирован возврат (может дублировать вебхук)'),

('booking.return.completed', NULL, false, 'bookings', 'update_booking_status', 
'{
  "booking_rp_id": "$.entity_id",
  "status": "returned",
  "return_actual_at": "$.created_at",
  "mileage_end": "$.mileage",
  "fuel_end": "$.fuel_level"
}'::jsonb, 70, 'Возврат завершён'),

('booking.cancelled', NULL, false, 'bookings', 'update_booking_status', 
'{
  "booking_rp_id": "$.entity_id",
  "status": "cancelled",
  "cancelled_at": "$.created_at",
  "cancel_reason": "$.description"
}'::jsonb, 70, 'Бронь отменена')
ON CONFLICT (operation_type) DO NOTHING;

-- =====================================================
-- 7. ДЕЙСТВИЯ ПОЛЬЗОВАТЕЛЕЙ - Приоритет 50 (низкий)
-- =====================================================

INSERT INTO history_operation_mappings (operation_type, matched_event_type, is_webhook_event, target_table, processing_strategy, field_mappings, priority, notes)
VALUES
('user.login', NULL, false, 'skip', 'skip', '{}'::jsonb, 50, 'Вход пользователя - не обрабатываем'),
('user.logout', NULL, false, 'skip', 'skip', '{}'::jsonb, 50, 'Выход пользователя - не обрабатываем'),
('user.action', NULL, false, 'skip', 'skip', '{}'::jsonb, 50, 'Действие пользователя - слишком общее, не обрабатываем')
ON CONFLICT (operation_type) DO NOTHING;

-- =====================================================
-- Статистика
-- =====================================================

SELECT 
  'Всего маппингов:' as description,
  COUNT(*) as count
FROM history_operation_mappings
UNION ALL
SELECT 
  'Вебхук события (skip):' as description,
  COUNT(*) as count
FROM history_operation_mappings
WHERE is_webhook_event = TRUE
UNION ALL
SELECT 
  'Платежи и касса:' as description,
  COUNT(*) as count
FROM history_operation_mappings
WHERE target_table IN ('payments', 'employees')
UNION ALL
SELECT 
  'Автомобили:' as description,
  COUNT(*) as count
FROM history_operation_mappings
WHERE target_table = 'cars'
UNION ALL
SELECT 
  'Брони:' as description,
  COUNT(*) as count
FROM history_operation_mappings
WHERE target_table = 'bookings';

