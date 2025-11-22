import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

// Тестовые данные из execution (первая машина)
const testData = {
  branch_code: "kutaisi",
  branch_id: "5e551b32-934c-498f-a4a1-a90079985c0a",
  rentprog_id: "38191",
  car_name: "Volkswagen Tiguan",
  code: "Tiguan 630 Allspace",
  number: "UU630UL",
  vin: "3VV3B7AX2LM082411",
  color: "White",
  year: 2020,
  transmission: "Автомат",
  fuel: "Бензин 95",
  car_type: "Кроссовер",
  car_class: "Бизнес",
  state: 1,
  tank_state: true,
  clean_state: true,
  mileage: 192673,
  tire_type: 2,
  tire_size: "215/60/R17",
  last_inspection: null,
  franchise: 540,
  max_fine: 35,
  repair_cost: 300,
  is_air: false,
  climate_control: true,
  parktronic: false,
  parktronic_camera: true,
  heated_seats: false,
  audio_system: true,
  usb_system: false,
  rain_sensor: false,
  engine_capacity: "2",
  number_doors: 4,
  tank_value: 58,
  pts: "Kutaisi / ქუთაისი",
  registration_certificate: "AJA5100180",
  body_number: "990023306651,880473456061",
  data: { id: 38191, company_id: 9248 }
};

async function testSQL() {
  try {
    console.log('🧪 Тестирование SQL запроса для Save Snapshot...\n');

    // Экранируем JSON как в n8n
    const jsonString = JSON.stringify(testData).replace(/'/g, "''");
    
    const query = `
WITH rec AS (
  SELECT
    (data->>'branch_id')::uuid AS branch_id,
    (data->>'rentprog_id')::text AS rentprog_id,
    (data->>'car_name')::text AS car_name,
    (data->>'code')::text AS code,
    (data->>'number')::text AS number,
    (data->>'vin')::text AS vin,
    (data->>'color')::text AS color,
    (data->>'year')::integer AS year,
    (data->>'transmission')::text AS transmission,
    (data->>'fuel')::text AS fuel,
    (data->>'car_type')::text AS car_type,
    (data->>'car_class')::text AS car_class,
    (data->>'active')::boolean AS active,
    (data->>'state')::integer AS state,
    (data->>'tank_state')::boolean AS tank_state,
    (data->>'clean_state')::boolean AS clean_state,
    (data->>'mileage')::integer AS mileage,
    (data->>'tire_type')::integer AS tire_type,
    (data->>'tire_size')::text AS tire_size,
    (data->>'last_inspection')::text AS last_inspection,
    (data->>'deposit')::bigint AS deposit,
    (data->>'price_hour')::bigint AS price_hour,
    (data->>'hourly_deposit')::bigint AS hourly_deposit,
    (data->>'monthly_deposit')::bigint AS monthly_deposit,
    (data->>'investor_id')::bigint AS investor_id,
    (data->>'purchase_price')::bigint AS purchase_price,
    (data->>'purchase_date')::text AS purchase_date,
    (data->>'age_limit')::bigint AS age_limit,
    (data->>'driver_year_limit')::bigint AS driver_year_limit,
    (data->>'franchise')::integer AS franchise,
    (data->>'max_fine')::integer AS max_fine,
    (data->>'repair_cost')::integer AS repair_cost,
    (data->>'is_air')::boolean AS is_air,
    (data->>'climate_control')::boolean AS climate_control,
    (data->>'parktronic')::boolean AS parktronic,
    (data->>'parktronic_camera')::boolean AS parktronic_camera,
    (data->>'heated_seats')::boolean AS heated_seats,
    (data->>'audio_system')::boolean AS audio_system,
    (data->>'usb_system')::boolean AS usb_system,
    (data->>'rain_sensor')::boolean AS rain_sensor,
    (data->>'engine_capacity')::text AS engine_capacity,
    (data->>'number_doors')::integer AS number_doors,
    (data->>'tank_value')::integer AS tank_value,
    (data->>'pts')::text AS pts,
    (data->>'registration_certificate')::text AS registration_certificate,
    (data->>'body_number')::text AS body_number,
    (data->'data')::jsonb AS data
  FROM (SELECT '${jsonString}'::jsonb AS data) AS j
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
  data = COALESCE(EXCLUDED.data, tgt.data)
RETURNING rentprog_id, car_name;
`;

    console.log('Выполняю SQL запрос...');
    const result = await sql.unsafe(query);
    
    console.log('✅ Запрос выполнен успешно!');
    console.log('Результат:', result);
    
    // Проверяем, что данные сохранились
    const check = await sql`
      SELECT rentprog_id, car_name, code, number
      FROM rentprog_car_states_snapshot
      WHERE rentprog_id = '38191'
      ORDER BY fetched_at DESC
      LIMIT 1
    `;
    
    if (check.length > 0) {
      console.log('\n✅ Данные сохранены в БД:');
      console.log(check[0]);
    } else {
      console.log('\n❌ Данные НЕ найдены в БД!');
    }

  } catch (error) {
    console.error('❌ Ошибка при выполнении SQL:', error.message);
    console.error('Детали:', error);
  } finally {
    await sql.end();
  }
}

testSQL();

