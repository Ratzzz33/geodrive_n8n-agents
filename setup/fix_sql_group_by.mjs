#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const workflowPath = path.join(__dirname, '..', 'n8n-workflows', 'rentprog-car-states-reconciliation-v2.json');
const workflow = JSON.parse(fs.readFileSync(workflowPath, 'utf-8'));

console.log('🔧 Исправление SQL запроса - упрощение GROUP BY\n');

// Упрощаем SQL - используем подзапрос для цен вместо GROUP BY
const getCarsFromDBNode = workflow.nodes.find(n => n.id === 'get-cars-from-db');
if (getCarsFromDBNode) {
  const newQuery = `SELECT
  c.id AS car_db_id,
  c.branch_id AS branch_id,
  er.external_id::text AS rentprog_id,
  c.company_id::text AS company_id,
  c.model AS model,
  c.plate AS plate,
  c.state AS state,
  c.transmission AS transmission,
  c.year AS year,
  c.number_doors AS number_doors,
  c.number_seats AS number_seats,
  c.is_air AS is_air,
  c.engine_capacity AS engine_capacity,
  c.engine_power AS engine_power,
  c.trunk_volume AS trunk_volume,
  c.avatar_url AS avatar_url,
  c.color AS color,
  c.mileage AS mileage,
  c.car_type AS car_type,
  c.interior AS interior,
  c.car_class AS car_class,
  c.code AS code,
  c.drive_unit AS drive_unit,
  c.steering_side AS steering_side,
  c.tire_size AS tire_size,
  c.tire_type AS tire_type,
  c.franchise AS franchise,
  c.max_fine AS max_fine,
  c.insurance AS insurance,
  c.start_mileage AS start_mileage,
  c.registration_certificate AS registration_certificate,
  c.tank_value AS tank_value,
  c.gas_mileage AS gas_mileage,
  c.repair_cost AS repair_cost,
  c.store_place AS store_place,
  c.pts AS pts,
  c.roof AS roof,
  c.custom_field_1 AS custom_field_1,
  c.custom_field_2 AS custom_field_2,
  c.custom_field_3 AS custom_field_3,
  c.window_lifters AS window_lifters,
  c.extra_mileage_km AS extra_mileage_km,
  c.extra_mileage_price AS extra_mileage_price,
  c.body_number AS body_number,
  c.abs AS abs,
  c.ebd AS ebd,
  c.esp AS esp,
  c.cd_system AS cd_system,
  c.tv_system AS tv_system,
  c.parktronic AS parktronic,
  c.parktronic_back AS parktronic_back,
  c.parktronic_camera AS parktronic_camera,
  c.tank_state AS tank_state,
  c.heated_seats AS heated_seats,
  c.heated_seats_front AS heated_seats_front,
  c.clean_state AS clean_state,
  c.audio_system AS audio_system,
  c.video_system AS video_system,
  c.folding_seats AS folding_seats,
  c.climate_control AS climate_control,
  c.usb_system AS usb_system,
  c.rain_sensor AS rain_sensor,
  c.wheel_adjustment AS wheel_adjustment,
  c.wheel_adjustment_full AS wheel_adjustment_full,
  c.heated_windshield AS heated_windshield,
  c.is_electropackage AS is_electropackage,
  c.fuel AS fuel,
  b.code AS branch_code,
  -- Цены (подзапрос)
  (
    SELECT COALESCE(
      json_agg(
        json_build_object(
          'season_id', cp.season_id,
          'season_name', cp.season_name,
          'price_values', cp.price_values,
          'active', cp.active
        )
        ORDER BY cp.season_id
      ),
      '[]'::json
    )
    FROM car_prices cp
    WHERE cp.car_id = c.id AND cp.active = TRUE
  ) AS prices
FROM cars c
JOIN external_refs er ON er.entity_id = c.id
JOIN branches b ON b.id = c.branch_id
WHERE er.system = 'rentprog'
  AND er.entity_type = 'car'`;

  getCarsFromDBNode.parameters.query = newQuery;
  console.log('✅ Исправлен SQL запрос - упрощен GROUP BY (используется подзапрос для цен)');
}

// Сохраняем
fs.writeFileSync(workflowPath, JSON.stringify(workflow, null, 2), 'utf-8');

console.log('\n✅ SQL запрос исправлен!');

