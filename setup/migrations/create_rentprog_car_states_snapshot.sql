-- Создание таблицы для снапшотов состояний машин из RentProg
-- Используется для сравнения с основной таблицей cars

CREATE TABLE IF NOT EXISTS rentprog_car_states_snapshot (
  rentprog_id     TEXT PRIMARY KEY,
  company_id      TEXT,
  model           TEXT,
  plate           TEXT,
  state           TEXT,
  transmission    TEXT,
  year            TEXT,
  number_doors    TEXT,
  number_seats    TEXT,
  is_air          TEXT,
  engine_capacity TEXT,
  engine_power    TEXT,
  trunk_volume    TEXT,
  avatar_url      TEXT,
  fetched_at      TIMESTAMPTZ DEFAULT now()
);

-- Индекс для быстрого поиска по филиалу
CREATE INDEX IF NOT EXISTS idx_rentprog_car_states_snapshot_company
  ON rentprog_car_states_snapshot (company_id);

-- Индекс для отслеживания времени обновления
CREATE INDEX IF NOT EXISTS idx_rentprog_car_states_snapshot_fetched
  ON rentprog_car_states_snapshot (fetched_at DESC);

