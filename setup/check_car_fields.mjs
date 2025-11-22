import postgres from 'postgres';

const sql = postgres('postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require', {
  ssl: { rejectUnauthorized: false }
});

const RENTPROG_ID = process.argv[2] || '47192';

try {
  const rows = await sql`
    SELECT
      rentprog_id, car_name, code, number, vin, color, year,
      transmission, fuel, car_type, car_class,
      active, state, tank_state, clean_state,
      mileage, tire_type, tire_size, last_inspection,
      deposit, price_hour, hourly_deposit, monthly_deposit,
      investor_id, purchase_price, purchase_date,
      age_limit, driver_year_limit, franchise, max_fine, repair_cost,
      is_air, climate_control, parktronic, parktronic_camera,
      heated_seats, audio_system, usb_system, rain_sensor,
      engine_capacity, number_doors, tank_value,
      pts, registration_certificate, body_number,
      data
    FROM cars
    WHERE rentprog_id = ${RENTPROG_ID}
    LIMIT 1;
  `;

  if (rows.length === 0) {
    console.log(`❌ Машина с rentprog_id=${RENTPROG_ID} не найдена`);
  } else {
    console.log(JSON.stringify(rows[0], null, 2));
  }
} catch (error) {
  console.error('❌ Ошибка:', error.message);
} finally {
  await sql.end();
}

