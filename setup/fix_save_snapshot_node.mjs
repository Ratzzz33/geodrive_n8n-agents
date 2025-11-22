#!/usr/bin/env node

import https from 'https';

const WORKFLOW_ID = 'ihRLR0QCJySx319b';
const NODE_ID = '1de4f8c4-98e9-4f7d-bcff-913329229b6f';
const API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI';

console.log('🔧 Исправление ноды "Save Snapshot"...\n');

function apiRequest(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'n8n.rentflow.rentals',
      port: 443,
      path: `/api/v1${path}`,
      method: method,
      headers: {
        'X-N8N-API-KEY': API_KEY,
        'Content-Type': 'application/json',
      },
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          reject(new Error(`Failed to parse response: ${body}`));
        }
      });
    });

    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

async function fixSaveSnapshotNode() {
  try {
    console.log('1️⃣ Получение workflow...');
    const currentWorkflow = await apiRequest('GET', `/workflows/${WORKFLOW_ID}`);
    const workflow = currentWorkflow.data;

    console.log(`   ✅ Workflow: ${workflow.name}\n`);

    // Находим ноду "Save Snapshot"
    const nodeIndex = workflow.nodes.findIndex(n => n.id === NODE_ID);
    
    if (nodeIndex === -1) {
      throw new Error('Нода "Save Snapshot" не найдена!');
    }

    const node = workflow.nodes[nodeIndex];
    console.log('2️⃣ Нода найдена:', node.name);

    // ИСПРАВЛЕННЫЙ SQL запрос
    const fixedQuery = `WITH rec AS (
  SELECT
    CASE WHEN data->>'branch_id' IS NULL OR data->>'branch_id' = 'null' OR data->>'branch_id' = '' THEN NULL ELSE (data->>'branch_id')::uuid END AS branch_id,
    NULLIF(data->>'rentprog_id', 'null') AS rentprog_id,
    NULLIF(data->>'car_name', 'null') AS car_name,
    NULLIF(data->>'code', 'null') AS code,
    NULLIF(data->>'number', 'null') AS number,
    NULLIF(data->>'vin', 'null') AS vin,
    NULLIF(data->>'color', 'null') AS color,
    CASE WHEN data->>'year' IS NULL OR data->>'year' = 'null' OR data->>'year' = '' THEN NULL ELSE (data->>'year')::integer END AS year,
    NULLIF(data->>'transmission', 'null') AS transmission,
    NULLIF(data->>'fuel', 'null') AS fuel,
    NULLIF(data->>'car_type', 'null') AS car_type,
    NULLIF(data->>'car_class', 'null') AS car_class,
    CASE WHEN data->>'active' IS NULL OR data->>'active' = 'null' OR data->>'active' = '' THEN NULL ELSE (data->>'active')::boolean END AS active,
    NULLIF(data->>'state', 'null') AS state,
    CASE WHEN data->>'tank_state' IS NULL OR data->>'tank_state' = 'null' OR data->>'tank_state' = '' THEN NULL ELSE (data->>'tank_state')::boolean END AS tank_state,
    CASE WHEN data->>'clean_state' IS NULL OR data->>'clean_state' = 'null' OR data->>'clean_state' = '' THEN NULL ELSE (data->>'clean_state')::boolean END AS clean_state,
    CASE WHEN data->>'mileage' IS NULL OR data->>'mileage' = 'null' OR data->>'mileage' = '' THEN NULL ELSE (data->>'mileage')::integer END AS mileage,
    CASE WHEN data->>'tire_type' IS NULL OR data->>'tire_type' = 'null' OR data->>'tire_type' = '' THEN NULL ELSE (data->>'tire_type')::integer END AS tire_type,
    NULLIF(data->>'tire_size', 'null') AS tire_size,
    NULLIF(data->>'last_inspection', 'null') AS last_inspection,
    CASE WHEN data->>'deposit' IS NULL OR data->>'deposit' = 'null' OR data->>'deposit' = '' THEN NULL ELSE (data->>'deposit')::bigint END AS deposit,
    CASE WHEN data->>'price_hour' IS NULL OR data->>'price_hour' = 'null' OR data->>'price_hour' = '' THEN NULL ELSE (data->>'price_hour')::bigint END AS price_hour,
    CASE WHEN data->>'hourly_deposit' IS NULL OR data->>'hourly_deposit' = 'null' OR data->>'hourly_deposit' = '' THEN NULL ELSE (data->>'hourly_deposit')::bigint END AS hourly_deposit,
    CASE WHEN data->>'monthly_deposit' IS NULL OR data->>'monthly_deposit' = 'null' OR data->>'monthly_deposit' = '' THEN NULL ELSE (data->>'monthly_deposit')::bigint END AS monthly_deposit,
    CASE WHEN data->>'investor_id' IS NULL OR data->>'investor_id' = 'null' OR data->>'investor_id' = '' THEN NULL ELSE (data->>'investor_id')::bigint END AS investor_id,
    CASE WHEN data->>'purchase_price' IS NULL OR data->>'purchase_price' = 'null' OR data->>'purchase_price' = '' THEN NULL ELSE (data->>'purchase_price')::bigint END AS purchase_price,
    NULLIF(data->>'purchase_date', 'null') AS purchase_date,
    CASE WHEN data->>'age_limit' IS NULL OR data->>'age_limit' = 'null' OR data->>'age_limit' = '' THEN NULL ELSE (data->>'age_limit')::bigint END AS age_limit,
    CASE WHEN data->>'driver_year_limit' IS NULL OR data->>'driver_year_limit' = 'null' OR data->>'driver_year_limit' = '' THEN NULL ELSE (data->>'driver_year_limit')::bigint END AS driver_year_limit,
    CASE WHEN data->>'franchise' IS NULL OR data->>'franchise' = 'null' OR data->>'franchise' = '' THEN NULL ELSE (data->>'franchise')::integer END AS franchise,
    CASE WHEN data->>'max_fine' IS NULL OR data->>'max_fine' = 'null' OR data->>'max_fine' = '' THEN NULL ELSE (data->>'max_fine')::integer END AS max_fine,
    CASE WHEN data->>'repair_cost' IS NULL OR data->>'repair_cost' = 'null' OR data->>'repair_cost' = '' THEN NULL ELSE (data->>'repair_cost')::integer END AS repair_cost,
    CASE WHEN data->>'is_air' IS NULL OR data->>'is_air' = 'null' OR data->>'is_air' = '' THEN NULL ELSE (data->>'is_air')::boolean END AS is_air,
    CASE WHEN data->>'climate_control' IS NULL OR data->>'climate_control' = 'null' OR data->>'climate_control' = '' THEN NULL ELSE (data->>'climate_control')::boolean END AS climate_control,
    CASE WHEN data->>'parktronic' IS NULL OR data->>'parktronic' = 'null' OR data->>'parktronic' = '' THEN NULL ELSE (data->>'parktronic')::boolean END AS parktronic,
    CASE WHEN data->>'parktronic_camera' IS NULL OR data->>'parktronic_camera' = 'null' OR data->>'parktronic_camera' = '' THEN NULL ELSE (data->>'parktronic_camera')::boolean END AS parktronic_camera,
    CASE WHEN data->>'heated_seats' IS NULL OR data->>'heated_seats' = 'null' OR data->>'heated_seats' = '' THEN NULL ELSE (data->>'heated_seats')::boolean END AS heated_seats,
    CASE WHEN data->>'audio_system' IS NULL OR data->>'audio_system' = 'null' OR data->>'audio_system' = '' THEN NULL ELSE (data->>'audio_system')::boolean END AS audio_system,
    CASE WHEN data->>'usb_system' IS NULL OR data->>'usb_system' = 'null' OR data->>'usb_system' = '' THEN NULL ELSE (data->>'usb_system')::boolean END AS usb_system,
    CASE WHEN data->>'rain_sensor' IS NULL OR data->>'rain_sensor' = 'null' OR data->>'rain_sensor' = '' THEN NULL ELSE (data->>'rain_sensor')::boolean END AS rain_sensor,
    NULLIF(data->>'engine_capacity', 'null') AS engine_capacity,
    CASE WHEN data->>'number_doors' IS NULL OR data->>'number_doors' = 'null' OR data->>'number_doors' = '' THEN NULL ELSE (data->>'number_doors')::integer END AS number_doors,
    CASE WHEN data->>'tank_value' IS NULL OR data->>'tank_value' = 'null' OR data->>'tank_value' = '' THEN NULL ELSE (data->>'tank_value')::integer END AS tank_value,
    NULLIF(data->>'pts', 'null') AS pts,
    NULLIF(data->>'registration_certificate', 'null') AS registration_certificate,
    NULLIF(data->>'body_number', 'null') AS body_number,
    data AS data
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

    console.log('\n3️⃣ Исправления:');
    console.log('   ✅ state: integer → text (соответствует типу в таблице)');
    console.log('   ✅ data: data->\'data\' → data (весь объект, не рекурсия)');
    console.log('   ✅ Логика COALESCE сохранена (пустые значения не затирают существующие)\n');

    // Обновляем параметры ноды
    workflow.nodes[nodeIndex].parameters.query = `=${fixedQuery}`;

    console.log('4️⃣ Сохранение изменений...');

    // Подготовка данных для обновления
    const updateData = {
      name: workflow.name,
      nodes: workflow.nodes,
      connections: workflow.connections,
      settings: workflow.settings,
      active: workflow.active
    };

    // Обновляем workflow
    const result = await apiRequest('PUT', `/workflows/${WORKFLOW_ID}`, updateData);

    if (result.data) {
      console.log('   ✅ Нода "Save Snapshot" исправлена!\n');
      console.log('📊 Результат:');
      console.log('   • Тип state исправлен на text');
      console.log('   • Извлечение data исправлено (весь объект)');
      console.log('   • COALESCE логика работает правильно');
      console.log('\n🔗 Workflow URL:');
      console.log(`   https://n8n.rentflow.rentals/workflow/${WORKFLOW_ID}`);
      console.log('\n💡 Теперь workflow должен работать без ошибок!');
    } else {
      throw new Error('Не удалось обновить workflow');
    }

  } catch (error) {
    console.error('\n❌ Ошибка:', error.message);
    if (error.response) {
      console.error('Response:', JSON.stringify(error.response, null, 2));
    }
    process.exit(1);
  }
}

fixSaveSnapshotNode();
