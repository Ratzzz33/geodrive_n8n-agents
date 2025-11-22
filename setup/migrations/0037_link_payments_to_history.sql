-- Migration: Link payments to history via trigger
-- Автоматическое связывание внутренних переводов из payments с history

-- Добавить поле history_id в таблицу payments для связи
ALTER TABLE payments ADD COLUMN IF NOT EXISTS history_id BIGINT REFERENCES history(id);

-- Создать индекс для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_payments_history_id ON payments(history_id) WHERE history_id IS NOT NULL;

-- Функция для связывания payments с history
CREATE OR REPLACE FUNCTION link_payment_to_history()
RETURNS TRIGGER AS $$
DECLARE
  matched_history_id BIGINT;
  time_diff_seconds NUMERIC;
BEGIN
  -- Проверяем только для внутренних переводов и зарплат
  IF NEW.payment_type IN ('Внутренние переводы', 'Зарплата', 'Выдача наличных') THEN
    
    -- Ищем соответствующую запись в history по:
    -- 1. Филиал совпадает
    -- 2. Время ±5 минут
    -- 3. Сумма упоминается в description
    SELECT 
      h.id,
      ABS(EXTRACT(EPOCH FROM (h.created_at - NEW.payment_date)))
    INTO 
      matched_history_id,
      time_diff_seconds
    FROM history h
    WHERE h.branch = NEW.branch
      AND h.created_at BETWEEN (NEW.payment_date - INTERVAL '5 minutes')
                           AND (NEW.payment_date + INTERVAL '5 minutes')
      AND h.description ILIKE '%' || CAST(FLOOR(NEW.amount::numeric) AS TEXT) || '%'
    ORDER BY ABS(EXTRACT(EPOCH FROM (h.created_at - NEW.payment_date))) ASC
    LIMIT 1;
    
    -- Если нашли совпадение, связываем
    IF matched_history_id IS NOT NULL THEN
      NEW.history_id := matched_history_id;
      
      RAISE NOTICE 'Linked payment % to history % (time diff: % seconds)', 
        NEW.rp_payment_id, matched_history_id, time_diff_seconds;
    END IF;
    
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Создать trigger для новых записей
DROP TRIGGER IF EXISTS link_payment_to_history_trigger ON payments;

CREATE TRIGGER link_payment_to_history_trigger
  BEFORE INSERT ON payments
  FOR EACH ROW
  EXECUTE FUNCTION link_payment_to_history();

-- Обновить существующие записи (внутренние переводы без history_id)
DO $$
DECLARE
  payment_rec RECORD;
  matched_history_id BIGINT;
  updated_count INT := 0;
BEGIN
  FOR payment_rec IN 
    SELECT 
      id,
      rp_payment_id,
      branch,
      payment_date,
      amount,
      payment_type
    FROM payments
    WHERE payment_type IN ('Внутренние переводы', 'Зарплата', 'Выдача наличных')
      AND history_id IS NULL
      AND created_at >= NOW() - INTERVAL '7 days'
    ORDER BY payment_date DESC
    LIMIT 1000
  LOOP
    -- Ищем соответствующую запись в history
    SELECT h.id INTO matched_history_id
    FROM history h
    WHERE h.branch = payment_rec.branch
      AND h.created_at BETWEEN (payment_rec.payment_date - INTERVAL '5 minutes')
                           AND (payment_rec.payment_date + INTERVAL '5 minutes')
      AND h.description ILIKE '%' || CAST(FLOOR(payment_rec.amount::numeric) AS TEXT) || '%'
    ORDER BY ABS(EXTRACT(EPOCH FROM (h.created_at - payment_rec.payment_date))) ASC
    LIMIT 1;
    
    -- Если нашли, обновляем
    IF matched_history_id IS NOT NULL THEN
      UPDATE payments
      SET history_id = matched_history_id
      WHERE id = payment_rec.id;
      
      updated_count := updated_count + 1;
    END IF;
  END LOOP;
  
  RAISE NOTICE 'Updated % existing payments with history links', updated_count;
END $$;

-- Добавить комментарии
COMMENT ON COLUMN payments.history_id IS 'Ссылка на запись в history (для внутренних переводов, зарплат)';
COMMENT ON TRIGGER link_payment_to_history_trigger ON payments IS 'Автоматически связывает внутренние переводы с записями в history по времени и сумме';

