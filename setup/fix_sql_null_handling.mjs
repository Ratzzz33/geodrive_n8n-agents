import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Безопасное приведение типов для SQL
function safeCast(field, type) {
  switch (type) {
    case 'integer':
      return `CASE WHEN data->>'${field}' IS NULL OR data->>'${field}' = 'null' OR data->>'${field}' = '' THEN NULL ELSE (data->>'${field}')::integer END`;
    case 'bigint':
      return `CASE WHEN data->>'${field}' IS NULL OR data->>'${field}' = 'null' OR data->>'${field}' = '' THEN NULL ELSE (data->>'${field}')::bigint END`;
    case 'boolean':
      return `CASE WHEN data->>'${field}' IS NULL OR data->>'${field}' = 'null' OR data->>'${field}' = '' THEN NULL ELSE (data->>'${field}')::boolean END`;
    case 'text':
      return `NULLIF(data->>'${field}', 'null')`;
    case 'uuid':
      return `CASE WHEN data->>'${field}' IS NULL OR data->>'${field}' = 'null' OR data->>'${field}' = '' THEN NULL ELSE (data->>'${field}')::uuid END`;
    case 'jsonb':
      return `CASE WHEN data->'${field}' IS NULL THEN NULL ELSE (data->'${field}')::jsonb END`;
    default:
      return `NULLIF(data->>'${field}', 'null')`;
  }
}

// SQL для Save Snapshot
const saveSnapshotSQL = `=WITH rec AS (
  SELECT
    ${safeCast('branch_id', 'uuid')} AS branch_id,
    ${safeCast('rentprog_id', 'text')} AS rentprog_id,
    ${safeCast('car_name', 'text')} AS car_name,
    ${safeCast('code', 'text')} AS code,
    ${safeCast('number', 'text')} AS number,
    ${safeCast('vin', 'text')} AS vin,
    ${safeCast('color', 'text')} AS color,
    ${safeCast('year', 'integer')} AS year,
    ${safeCast('transmission', 'text')} AS transmission,
    ${safeCast('fuel', 'text')} AS fuel,
    ${safeCast('car_type', 'text')} AS car_type,
    ${safeCast('car_class', 'text')} AS car_class,
    ${safeCast('active', 'boolean')} AS active,
    ${safeCast('state', 'integer')} AS state,
    ${safeCast('tank_state', 'boolean')} AS tank_state,
    ${safeCast('clean_state', 'boolean')} AS clean_state,
    ${safeCast('mileage', 'integer')} AS mileage,
    ${safeCast('tire_type', 'integer')} AS tire_type,
    ${safeCast('tire_size', 'text')} AS tire_size,
    ${safeCast('last_inspection', 'text')} AS last_inspection,
    ${safeCast('deposit', 'bigint')} AS deposit,
    ${safeCast('price_hour', 'bigint')} AS price_hour,
    ${safeCast('hourly_deposit', 'bigint')} AS hourly_deposit,
    ${safeCast('monthly_deposit', 'bigint')} AS monthly_deposit,
    ${safeCast('investor_id', 'bigint')} AS investor_id,
    ${safeCast('purchase_price', 'bigint')} AS purchase_price,
    ${safeCast('purchase_date', 'text')} AS purchase_date,
    ${safeCast('age_limit', 'bigint')} AS age_limit,
    ${safeCast('driver_year_limit', 'bigint')} AS driver_year_limit,
    ${safeCast('franchise', 'integer')} AS franchise,
    ${safeCast('max_fine', 'integer')} AS max_fine,
    ${safeCast('repair_cost', 'integer')} AS repair_cost,
    ${safeCast('is_air', 'boolean')} AS is_air,
    ${safeCast('climate_control', 'boolean')} AS climate_control,
    ${safeCast('parktronic', 'boolean')} AS parktronic,
    ${safeCast('parktronic_camera', 'boolean')} AS parktronic_camera,
    ${safeCast('heated_seats', 'boolean')} AS heated_seats,
    ${safeCast('audio_system', 'boolean')} AS audio_system,
    ${safeCast('usb_system', 'boolean')} AS usb_system,
    ${safeCast('rain_sensor', 'boolean')} AS rain_sensor,
    ${safeCast('engine_capacity', 'text')} AS engine_capacity,
    ${safeCast('number_doors', 'integer')} AS number_doors,
    ${safeCast('tank_value', 'integer')} AS tank_value,
    ${safeCast('pts', 'text')} AS pts,
    ${safeCast('registration_certificate', 'text')} AS registration_certificate,
    ${safeCast('body_number', 'text')} AS body_number,
    ${safeCast('data', 'jsonb')} AS data
  FROM (SELECT '{{ JSON.stringify($json).replace(/'/g, "''") }}'::jsonb AS data) AS j
)
INSERT INTO rentprog_car_states_snapshot AS tgt (
  branch_id, rentprog_id, car_name, code, number, vin, color, year, transmission,
  fuel, car_type, car_class, active, state, tank_state, clean_state, mileage,
  tire_type, tire_size, last_inspection, deposit, price_hour, hourly_deposit,
  monthly_deposit, investor_id, purchase_price, purchase_date, age_limit,
  driver_year_limit, franchise, max_fine, repair_cost, is_air, climate_control,
  parktronic, parktronic_camera, heated_seats, audio_system, usb_system,
  rain_sensor, engine_capacity, number_doors, tank_value, pts,
  registration_certificate, body_number, data
)
SELECT
  rec.branch_id, rec.rentprog_id, rec.car_name, rec.code, rec.number, rec.vin, rec.color, rec.year, rec.transmission,
  rec.fuel, rec.car_type, rec.car_class, rec.active, rec.state, rec.tank_state, rec.clean_state, rec.mileage,
  rec.tire_type, rec.tire_size, rec.last_inspection, rec.deposit, rec.price_hour, rec.hourly_deposit,
  rec.monthly_deposit, rec.investor_id, rec.purchase_price, rec.purchase_date, rec.age_limit,
  rec.driver_year_limit, rec.franchise, rec.max_fine, rec.repair_cost, rec.is_air, rec.climate_control,
  rec.parktronic, rec.parktronic_camera, rec.heated_seats, rec.audio_system, rec.usb_system,
  rec.rain_sensor, rec.engine_capacity, rec.number_doors, rec.tank_value, rec.pts,
  rec.registration_certificate, rec.body_number, rec.data
FROM rec
ON CONFLICT (rentprog_id) DO UPDATE SET
  branch_id = COALESCE(EXCLUDED.branch_id, tgt.branch_id),
  car_name = COALESCE(EXCLUDED.car_name, tgt.car_name),
  code = COALESCE(EXCLUDED.code, tgt.code),
  number = COALESCE(EXCLUDED.number, tgt.number),
  vin = COALESCE(EXCLUDED.vin, tgt.vin),
  color = COALESCE(EXCLUDED.color, tgt.color),
  year = COALESCE(EXCLUDED.year, tgt.year),
  transmission = COALESCE(EXCLUDED.transmission, tgt.transmission),
  fuel = COALESCE(EXCLUDED.fuel, tgt.fuel),
  car_type = COALESCE(EXCLUDED.car_type, tgt.car_type),
  car_class = COALESCE(EXCLUDED.car_class, tgt.car_class),
  active = COALESCE(EXCLUDED.active, tgt.active),
  state = COALESCE(EXCLUDED.state, tgt.state),
  tank_state = COALESCE(EXCLUDED.tank_state, tgt.tank_state),
  clean_state = COALESCE(EXCLUDED.clean_state, tgt.clean_state),
  mileage = COALESCE(EXCLUDED.mileage, tgt.mileage),
  tire_type = COALESCE(EXCLUDED.tire_type, tgt.tire_type),
  tire_size = COALESCE(EXCLUDED.tire_size, tgt.tire_size),
  last_inspection = COALESCE(EXCLUDED.last_inspection, tgt.last_inspection),
  deposit = COALESCE(EXCLUDED.deposit, tgt.deposit),
  price_hour = COALESCE(EXCLUDED.price_hour, tgt.price_hour),
  hourly_deposit = COALESCE(EXCLUDED.hourly_deposit, tgt.hourly_deposit),
  monthly_deposit = COALESCE(EXCLUDED.monthly_deposit, tgt.monthly_deposit),
  investor_id = COALESCE(EXCLUDED.investor_id, tgt.investor_id),
  purchase_price = COALESCE(EXCLUDED.purchase_price, tgt.purchase_price),
  purchase_date = COALESCE(EXCLUDED.purchase_date, tgt.purchase_date),
  age_limit = COALESCE(EXCLUDED.age_limit, tgt.age_limit),
  driver_year_limit = COALESCE(EXCLUDED.driver_year_limit, tgt.driver_year_limit),
  franchise = COALESCE(EXCLUDED.franchise, tgt.franchise),
  max_fine = COALESCE(EXCLUDED.max_fine, tgt.max_fine),
  repair_cost = COALESCE(EXCLUDED.repair_cost, tgt.repair_cost),
  is_air = COALESCE(EXCLUDED.is_air, tgt.is_air),
  climate_control = COALESCE(EXCLUDED.climate_control, tgt.climate_control),
  parktronic = COALESCE(EXCLUDED.parktronic, tgt.parktronic),
  parktronic_camera = COALESCE(EXCLUDED.parktronic_camera, tgt.parktronic_camera),
  heated_seats = COALESCE(EXCLUDED.heated_seats, tgt.heated_seats),
  audio_system = COALESCE(EXCLUDED.audio_system, tgt.audio_system),
  usb_system = COALESCE(EXCLUDED.usb_system, tgt.usb_system),
  rain_sensor = COALESCE(EXCLUDED.rain_sensor, tgt.rain_sensor),
  engine_capacity = COALESCE(EXCLUDED.engine_capacity, tgt.engine_capacity),
  number_doors = COALESCE(EXCLUDED.number_doors, tgt.number_doors),
  tank_value = COALESCE(EXCLUDED.tank_value, tgt.tank_value),
  pts = COALESCE(EXCLUDED.pts, tgt.pts),
  registration_certificate = COALESCE(EXCLUDED.registration_certificate, tgt.registration_certificate),
  body_number = COALESCE(EXCLUDED.body_number, tgt.body_number),
  data = COALESCE(EXCLUDED.data, tgt.data);`;

// SQL для Save Cars (аналогично)
const saveCarsSQL = saveSnapshotSQL.replace(
  'INSERT INTO rentprog_car_states_snapshot',
  `INSERT INTO cars AS tgt (
  id, branch_id, rentprog_id, car_name, code, number, vin, color, year, transmission,
  fuel, car_type, car_class, active, state, tank_state, clean_state, mileage,
  tire_type, tire_size, last_inspection, deposit, price_hour, hourly_deposit,
  monthly_deposit, investor_id, purchase_price, purchase_date, age_limit,
  driver_year_limit, franchise, max_fine, repair_cost, is_air, climate_control,
  parktronic, parktronic_camera, heated_seats, audio_system, usb_system,
  rain_sensor, engine_capacity, number_doors, tank_value, pts,
  registration_certificate, body_number, data
)
SELECT
  COALESCE((SELECT id FROM cars WHERE rentprog_id = rec.rentprog_id LIMIT 1), gen_random_uuid()) AS id,
  rec.branch_id, rec.rentprog_id, rec.car_name, rec.code, rec.number, rec.vin, rec.color, rec.year, rec.transmission,
  rec.fuel, rec.car_type, rec.car_class, rec.active, rec.state, rec.tank_state, rec.clean_state, rec.mileage,
  rec.tire_type, rec.tire_size, rec.last_inspection, rec.deposit, rec.price_hour, rec.hourly_deposit,
  rec.monthly_deposit, rec.investor_id, rec.purchase_price, rec.purchase_date, rec.age_limit,
  rec.driver_year_limit, rec.franchise, rec.max_fine, rec.repair_cost, rec.is_air, rec.climate_control,
  rec.parktronic, rec.parktronic_camera, rec.heated_seats, rec.audio_system, rec.usb_system,
  rec.rain_sensor, rec.engine_capacity, rec.number_doors, rec.tank_value, rec.pts,
  rec.registration_certificate, rec.body_number, rec.data
FROM rec
INSERT INTO cars`
).replace(
  'ON CONFLICT (rentprog_id) DO UPDATE SET',
  'ON CONFLICT (rentprog_id) DO UPDATE SET'
) + '\n  updated_at = NOW();';

console.log('✅ SQL запросы подготовлены с безопасной обработкой NULL значений');

// Сохраняем для использования
writeFileSync(
  join(__dirname, 'tmp_save_snapshot_sql_safe.txt'),
  saveSnapshotSQL,
  'utf-8'
);

writeFileSync(
  join(__dirname, 'tmp_save_cars_sql_safe.txt'),
  saveCarsSQL,
  'utf-8'
);

console.log('📝 SQL запросы сохранены в tmp_save_*_sql_safe.txt');

