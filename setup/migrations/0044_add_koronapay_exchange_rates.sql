-- =====================================================
-- Миграция 0044: Добавление полей курсов KoronaPay
-- =====================================================
-- Дата: 2025-01-20
-- Описание: Добавляем поля для хранения курсов оплаты и возврата
--           из KoronaPay (Россия → Грузия, GEL → RUB)
--           - koronapay_payment_rate: курс оплаты рублями (сколько RUB за 1 GEL)
--           - koronapay_return_rate: курс возврата из лари в рубли (сколько RUB за 1 GEL при возврате)

BEGIN;

-- =====================================================
-- 1. Добавление полей курсов KoronaPay
-- =====================================================

ALTER TABLE exchange_rates
  ADD COLUMN IF NOT EXISTS koronapay_payment_rate DECIMAL(10, 6),
  ADD COLUMN IF NOT EXISTS koronapay_return_rate DECIMAL(10, 6);

-- =====================================================
-- 2. Комментарии к полям
-- =====================================================

COMMENT ON COLUMN exchange_rates.koronapay_payment_rate IS 'Курс оплаты рублями через KoronaPay (RUB за 1 GEL) - парсится с koronapay.com/transfers/';
COMMENT ON COLUMN exchange_rates.koronapay_return_rate IS 'Курс возврата из лари в рубли через KoronaPay (RUB за 1 GEL при возврате) - парсится с koronapay.com/transfers/';

-- =====================================================
-- 3. Обновление комментария таблицы
-- =====================================================

COMMENT ON TABLE exchange_rates IS 'Курсы валют из RentProg и KoronaPay. RentProg парсятся с /company_profile, KoronaPay парсятся с koronapay.com/transfers/';

COMMIT;

