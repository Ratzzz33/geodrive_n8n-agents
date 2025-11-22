-- Миграция: Автоматическое применение изменений из events/history в основные таблицы
-- Дата: 2025-11-21
-- Описание: Функции парсинга изменений и таблица для логирования примененных изменений

-- =====================================================
-- 1. Таблица для логирования примененных изменений
-- =====================================================

CREATE TABLE IF NOT EXISTS applied_changes (
  id BIGSERIAL PRIMARY KEY,
  ts TIMESTAMPTZ DEFAULT NOW(),
  source TEXT NOT NULL, -- 'history' или 'event'
  source_id BIGINT NOT NULL, -- ID записи в history или events
  entity_type TEXT NOT NULL, -- 'car', 'booking', 'client'
  entity_id TEXT NOT NULL, -- RentProg ID
  field_name TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  applied BOOLEAN DEFAULT TRUE,
  error TEXT,
  CONSTRAINT applied_changes_source_id_field_unique UNIQUE(source, source_id, field_name)
);

CREATE INDEX IF NOT EXISTS idx_applied_changes_entity ON applied_changes(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_applied_changes_source ON applied_changes(source, source_id);
CREATE INDEX IF NOT EXISTS idx_applied_changes_ts ON applied_changes(ts DESC);
CREATE INDEX IF NOT EXISTS idx_applied_changes_applied ON applied_changes(applied) WHERE applied = FALSE;

COMMENT ON TABLE applied_changes IS 'Лог примененных изменений из events/history в основные таблицы';
COMMENT ON COLUMN applied_changes.source IS 'Источник изменения: history или event';
COMMENT ON COLUMN applied_changes.source_id IS 'ID записи в таблице-источнике';
COMMENT ON COLUMN applied_changes.applied IS 'TRUE если изменение применено успешно';
COMMENT ON COLUMN applied_changes.error IS 'Текст ошибки при неудачном применении';

-- =====================================================
-- 2. Функция парсинга изменений из description
-- =====================================================

CREATE OR REPLACE FUNCTION parse_field_change(description TEXT)
RETURNS TABLE (
  field_name TEXT,
  old_value TEXT,
  new_value TEXT
) AS $$
DECLARE
  v_match TEXT[];
BEGIN
  -- Паттерн: "изменил FIELD с OLD на NEW"
  -- Примеры:
  -- "изменил , company_id с 11163 на 9247"
  -- "изменил car_class с Средний на Эконом"
  -- "изменил , mileage с 171678 на 172851"
  
  v_match := regexp_match(
    description, 
    'изменил[,\s]+(\w+)\s+с\s+(.*?)\s+на\s+(.*?)(?:\s+в|\s+,|\s*$)',
    'i'
  );
  
  IF v_match IS NOT NULL THEN
    field_name := v_match[1];
    old_value := TRIM(v_match[2]);
    new_value := TRIM(v_match[3]);
    RETURN NEXT;
  END IF;
  
  RETURN;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION parse_field_change(TEXT) IS 'Парсит изменения из текста description (формат: "изменил FIELD с OLD на NEW")';

-- =====================================================
-- 3. Маппинг company_id → branch
-- =====================================================

CREATE OR REPLACE FUNCTION get_branch_by_company_id(p_company_id INTEGER)
RETURNS TEXT AS $$
BEGIN
  RETURN CASE 
    WHEN p_company_id = 9247 THEN 'tbilisi'
    WHEN p_company_id = 9248 THEN 'batumi'
    WHEN p_company_id = 9249 THEN 'kutaisi'
    WHEN p_company_id = 11158 THEN 'service-center'
    ELSE NULL
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION get_branch_by_company_id(INTEGER) IS 'Возвращает branch по company_id из RentProg';

-- =====================================================
-- 4. Функция применения изменения к cars
-- =====================================================

CREATE OR REPLACE FUNCTION apply_car_change(
  p_rentprog_id TEXT,
  p_field_name TEXT,
  p_new_value TEXT,
  p_old_value TEXT DEFAULT NULL
) RETURNS TABLE (
  success BOOLEAN,
  message TEXT,
  rows_affected INTEGER
) AS $$
DECLARE
  v_rows_affected INTEGER := 0;
  v_new_branch TEXT;
  v_car_exists BOOLEAN;
BEGIN
  -- Проверяем существование машины
  SELECT EXISTS(
    SELECT 1 FROM cars c
    JOIN external_refs er ON er.entity_id = c.id
    WHERE er.entity_type = 'car' 
      AND er.system = 'rentprog' 
      AND er.external_id = p_rentprog_id
  ) INTO v_car_exists;
  
  IF NOT v_car_exists THEN
    RETURN QUERY SELECT FALSE, 'Car not found: ' || p_rentprog_id, 0;
    RETURN;
  END IF;
  
  -- Применяем изменение в зависимости от поля
  CASE p_field_name
    -- Изменение филиала (company_id)
    WHEN 'company_id' THEN
      v_new_branch := get_branch_by_company_id(p_new_value::INTEGER);
      
      IF v_new_branch IS NULL THEN
        RETURN QUERY SELECT FALSE, 'Unknown company_id: ' || p_new_value, 0;
        RETURN;
      END IF;
      
      UPDATE cars 
      SET 
        branch = v_new_branch,
        updated_at = NOW()
      WHERE id IN (
        SELECT er.entity_id::UUID
        FROM external_refs er
        WHERE er.entity_type = 'car' 
          AND er.system = 'rentprog' 
          AND er.external_id = p_rentprog_id
      );
      
      GET DIAGNOSTICS v_rows_affected = ROW_COUNT;
      RETURN QUERY SELECT TRUE, 'Branch updated to ' || v_new_branch, v_rows_affected;
      
    -- Изменение класса авто
    WHEN 'car_class' THEN
      UPDATE cars 
      SET 
        car_class = p_new_value,
        updated_at = NOW()
      WHERE id IN (
        SELECT er.entity_id::UUID
        FROM external_refs er
        WHERE er.entity_type = 'car' 
          AND er.system = 'rentprog' 
          AND er.external_id = p_rentprog_id
      );
      
      GET DIAGNOSTICS v_rows_affected = ROW_COUNT;
      RETURN QUERY SELECT TRUE, 'Car class updated to ' || p_new_value, v_rows_affected;
      
    -- Изменение пробега
    WHEN 'mileage' THEN
      UPDATE cars 
      SET 
        mileage = p_new_value::INTEGER,
        updated_at = NOW()
      WHERE id IN (
        SELECT er.entity_id::UUID
        FROM external_refs er
        WHERE er.entity_type = 'car' 
          AND er.system = 'rentprog' 
          AND er.external_id = p_rentprog_id
      );
      
      GET DIAGNOSTICS v_rows_affected = ROW_COUNT;
      RETURN QUERY SELECT TRUE, 'Mileage updated to ' || p_new_value, v_rows_affected;
      
    -- Изменение статуса
    WHEN 'status', 'active' THEN
      UPDATE cars 
      SET 
        status = p_new_value,
        updated_at = NOW()
      WHERE id IN (
        SELECT er.entity_id::UUID
        FROM external_refs er
        WHERE er.entity_type = 'car' 
          AND er.system = 'rentprog' 
          AND er.external_id = p_rentprog_id
      );
      
      GET DIAGNOSTICS v_rows_affected = ROW_COUNT;
      RETURN QUERY SELECT TRUE, 'Status updated to ' || p_new_value, v_rows_affected;
      
    -- Изменение гос. номера
    WHEN 'plate', 'license_plate', 'registration_number' THEN
      UPDATE cars 
      SET 
        license_plate = p_new_value,
        updated_at = NOW()
      WHERE id IN (
        SELECT er.entity_id::UUID
        FROM external_refs er
        WHERE er.entity_type = 'car' 
          AND er.system = 'rentprog' 
          AND er.external_id = p_rentprog_id
      );
      
      GET DIAGNOSTICS v_rows_affected = ROW_COUNT;
      RETURN QUERY SELECT TRUE, 'License plate updated to ' || p_new_value, v_rows_affected;
      
    -- Неизвестное поле - логируем но не применяем
    ELSE
      RETURN QUERY SELECT FALSE, 'Unknown field: ' || p_field_name, 0;
  END CASE;
  
  RETURN;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION apply_car_change(TEXT, TEXT, TEXT, TEXT) IS 'Применяет изменение к машине по rentprog_id';

-- =====================================================
-- 5. Функция применения изменений из history записи
-- =====================================================

CREATE OR REPLACE FUNCTION apply_changes_from_history(p_history_id BIGINT)
RETURNS TABLE (
  field_name TEXT,
  old_value TEXT,
  new_value TEXT,
  applied BOOLEAN,
  message TEXT
) AS $$
DECLARE
  v_history RECORD;
  v_change RECORD;
  v_result RECORD;
BEGIN
  -- Получаем запись из history
  SELECT * INTO v_history
  FROM history
  WHERE id = p_history_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'History record not found: %', p_history_id;
  END IF;
  
  -- Парсим изменения из description
  FOR v_change IN 
    SELECT * FROM parse_field_change(v_history.description)
  LOOP
    -- Применяем изменение в зависимости от типа сущности
    CASE v_history.entity_type
      WHEN 'car' THEN
        FOR v_result IN
          SELECT * FROM apply_car_change(
            v_history.entity_id,
            v_change.field_name,
            v_change.new_value,
            v_change.old_value
          )
        LOOP
          field_name := v_change.field_name;
          old_value := v_change.old_value;
          new_value := v_change.new_value;
          applied := v_result.success;
          message := v_result.message;
          
          -- Логируем в applied_changes
          INSERT INTO applied_changes (
            source, source_id, entity_type, entity_id,
            field_name, old_value, new_value, applied, error
          ) VALUES (
            'history', p_history_id, v_history.entity_type, v_history.entity_id,
            v_change.field_name, v_change.old_value, v_change.new_value,
            v_result.success, CASE WHEN NOT v_result.success THEN v_result.message ELSE NULL END
          ) ON CONFLICT (source, source_id, field_name) DO UPDATE
          SET 
            applied = EXCLUDED.applied,
            error = EXCLUDED.error,
            ts = NOW();
          
          RETURN NEXT;
        END LOOP;
        
      -- Добавить другие типы сущностей (booking, client) по мере необходимости
      ELSE
        field_name := v_change.field_name;
        old_value := v_change.old_value;
        new_value := v_change.new_value;
        applied := FALSE;
        message := 'Unsupported entity type: ' || v_history.entity_type;
        RETURN NEXT;
    END CASE;
  END LOOP;
  
  RETURN;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION apply_changes_from_history(BIGINT) IS 'Парсит и применяет все изменения из записи history';

-- =====================================================
-- 6. Тестовые данные и примеры использования
-- =====================================================

-- Пример 1: Парсинг изменений
-- SELECT * FROM parse_field_change('CEO Eliseev Aleksei изменил , company_id с 11163 на 9247 в авто № 39736');

-- Пример 2: Применение изменения вручную
-- SELECT * FROM apply_car_change('39736', 'company_id', '9247', '11163');

-- Пример 3: Применение всех изменений из history записи
-- SELECT * FROM apply_changes_from_history(577625);

-- Пример 4: Просмотр логов примененных изменений
-- SELECT * FROM applied_changes ORDER BY ts DESC LIMIT 10;

-- Пример 5: Статистика по примененным изменениям
-- SELECT 
--   entity_type,
--   field_name,
--   COUNT(*) as total,
--   SUM(CASE WHEN applied THEN 1 ELSE 0 END) as success,
--   SUM(CASE WHEN NOT applied THEN 1 ELSE 0 END) as failed
-- FROM applied_changes
-- GROUP BY entity_type, field_name
-- ORDER BY total DESC;

