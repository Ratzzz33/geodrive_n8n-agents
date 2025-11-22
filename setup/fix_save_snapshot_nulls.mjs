import postgres from 'postgres';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Получаем API ключ из переменных окружения или используем дефолтный
const N8N_HOST = process.env.N8N_HOST || 'https://n8n.rentflow.rentals/api/v1';
const N8N_API_KEY = process.env.N8N_API_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI';
const WORKFLOW_ID = 'u3cOUuoaH5RSw7hm';
const NODE_ID = 'save-snapshot-v3-fix'; // ID текущей ноды (мы ее уже пересоздавали)

const headers = {
  'X-N8N-API-KEY': N8N_API_KEY,
  'Content-Type': 'application/json'
};

async function fixNumericNullError() {
  try {
    console.log('🔍 Получаю текущий workflow...\n');
    
    const response = await fetch(`${N8N_HOST}/workflows/${WORKFLOW_ID}`, {
      method: 'GET',
      headers
    });
    
    if (!response.ok) {
      throw new Error(`Failed to get workflow: ${response.status} ${response.statusText}`);
    }
    
    const workflowData = await response.json();
    const workflow = workflowData.data || workflowData;
    let nodes = workflow.nodes;
    
    // Находим ноду
    const nodeIndex = nodes.findIndex(n => n.id === NODE_ID || n.name === 'Save Snapshot');
    
    if (nodeIndex === -1) {
      throw new Error('Node "Save Snapshot" not found!');
    }
    
    console.log('✅ Найдена нода "Save Snapshot"\n');
    console.log('🔧 Обновляю SQL запрос с обработкой NULL...\n');
    
    // Обновляем SQL запрос: добавляем NULLIF(..., 'null') для всех полей, кроме обязательных
    // $1 (branch_id) и $2 (rentprog_id) обязательны
    const newQuery = `INSERT INTO rentprog_car_states_snapshot (
          branch_id, rentprog_id, car_name, code, number, vin, color, year,
          transmission, fuel, car_type, car_class, active, state, tank_state,
          clean_state, mileage, tire_type, tire_size, last_inspection, deposit,
          price_hour, hourly_deposit, monthly_deposit, investor_id, purchase_price,
          purchase_date, age_limit, driver_year_limit, franchise, max_fine,
          repair_cost, is_air, climate_control, parktronic, parktronic_camera,
          heated_seats, audio_system, usb_system, rain_sensor, engine_capacity,
          number_doors, tank_value, pts, registration_certificate, body_number,
          company_id, data, fetched_at
        )
        VALUES (
          $1::uuid, 
          $2::text, 
          NULLIF($3, 'null')::text, 
          NULLIF($4, 'null')::text, 
          NULLIF($5, 'null')::text, 
          NULLIF($6, 'null')::text, 
          NULLIF($7, 'null')::text, 
          NULLIF($8, 'null')::text,
          NULLIF($9, 'null')::text, 
          NULLIF($10, 'null')::text, 
          NULLIF($11, 'null')::text, 
          NULLIF($12, 'null')::text, 
          NULLIF($13, 'null')::boolean, 
          NULLIF($14, 'null')::text, 
          NULLIF($15, 'null')::boolean,
          NULLIF($16, 'null')::boolean, 
          NULLIF($17, 'null')::numeric, 
          NULLIF($18, 'null')::numeric, 
          NULLIF($19, 'null')::text, 
          NULLIF($20, 'null')::text, 
          NULLIF($21, 'null')::numeric,
          NULLIF($22, 'null')::numeric, 
          NULLIF($23, 'null')::numeric, 
          NULLIF($24, 'null')::numeric, 
          NULLIF($25, 'null')::numeric, 
          NULLIF($26, 'null')::text,
          NULLIF($27, 'null')::numeric, 
          NULLIF($28, 'null')::numeric, 
          NULLIF($29, 'null')::numeric, 
          NULLIF($30, 'null')::numeric,
          NULLIF($31, 'null')::numeric, 
          NULLIF($32, 'null')::boolean, 
          NULLIF($33, 'null')::boolean, 
          NULLIF($34, 'null')::boolean, 
          NULLIF($35, 'null')::boolean,
          NULLIF($36, 'null')::boolean, 
          NULLIF($37, 'null')::boolean, 
          NULLIF($38, 'null')::boolean, 
          NULLIF($39, 'null')::boolean, 
          NULLIF($40, 'null')::text,
          NULLIF($41, 'null')::numeric, 
          NULLIF($42, 'null')::numeric, 
          NULLIF($43, 'null')::text, 
          NULLIF($44, 'null')::text, 
          NULLIF($45, 'null')::text,
          NULLIF($46, 'null')::text, 
          $47::jsonb, 
          NOW()
        )
        ON CONFLICT ON CONSTRAINT rentprog_car_states_snapshot_pkey
        DO UPDATE SET
          branch_id = EXCLUDED.branch_id,
          car_name = EXCLUDED.car_name,
          code = EXCLUDED.code,
          number = EXCLUDED.number,
          vin = EXCLUDED.vin,
          color = EXCLUDED.color,
          year = EXCLUDED.year,
          transmission = EXCLUDED.transmission,
          fuel = EXCLUDED.fuel,
          car_type = EXCLUDED.car_type,
          car_class = EXCLUDED.car_class,
          active = EXCLUDED.active,
          state = EXCLUDED.state,
          tank_state = EXCLUDED.tank_state,
          clean_state = EXCLUDED.clean_state,
          mileage = EXCLUDED.mileage,
          tire_type = EXCLUDED.tire_type,
          tire_size = EXCLUDED.tire_size,
          last_inspection = EXCLUDED.last_inspection,
          deposit = EXCLUDED.deposit,
          price_hour = EXCLUDED.price_hour,
          hourly_deposit = EXCLUDED.hourly_deposit,
          monthly_deposit = EXCLUDED.monthly_deposit,
          investor_id = EXCLUDED.investor_id,
          purchase_price = EXCLUDED.purchase_price,
          purchase_date = EXCLUDED.purchase_date,
          age_limit = EXCLUDED.age_limit,
          driver_year_limit = EXCLUDED.driver_year_limit,
          franchise = EXCLUDED.franchise,
          max_fine = EXCLUDED.max_fine,
          repair_cost = EXCLUDED.repair_cost,
          is_air = EXCLUDED.is_air,
          climate_control = EXCLUDED.climate_control,
          parktronic = EXCLUDED.parktronic,
          parktronic_camera = EXCLUDED.parktronic_camera,
          heated_seats = EXCLUDED.heated_seats,
          audio_system = EXCLUDED.audio_system,
          usb_system = EXCLUDED.usb_system,
          rain_sensor = EXCLUDED.rain_sensor,
          engine_capacity = EXCLUDED.engine_capacity,
          number_doors = EXCLUDED.number_doors,
          tank_value = EXCLUDED.tank_value,
          pts = EXCLUDED.pts,
          registration_certificate = EXCLUDED.registration_certificate,
          body_number = EXCLUDED.body_number,
          company_id = EXCLUDED.company_id,
          data = EXCLUDED.data,
          fetched_at = NOW()
        RETURNING rentprog_id;`;

    nodes[nodeIndex].parameters.query = newQuery;
    
    // Обновляем workflow
    const updateResponse = await fetch(`${N8N_HOST}/workflows/${WORKFLOW_ID}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        name: workflow.name,
        nodes: nodes,
        connections: workflow.connections,
        settings: workflow.settings
      })
    });
    
    if (!updateResponse.ok) {
      const errorText = await updateResponse.text();
      throw new Error(`Failed to update workflow: ${updateResponse.status} ${updateResponse.statusText}\n${errorText}`);
    }
    
    console.log('✅ Нода "Save Snapshot" успешно обновлена с NULLIF!\n');
    
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    throw error;
  }
}

fixNumericNullError();

