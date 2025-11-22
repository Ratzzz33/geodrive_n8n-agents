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
const NODE_ID = '4cada770-105d-428b-b47d-0bae30bdcfe2';

const headers = {
  'X-N8N-API-KEY': N8N_API_KEY,
  'Content-Type': 'application/json'
};

async function recreateSaveSnapshotNode() {
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
    const nodes = workflow.nodes;
    
    // Находим старую ноду
    const oldNodeIndex = nodes.findIndex(n => n.id === NODE_ID);
    
    if (oldNodeIndex === -1) {
      throw new Error('Node "Save Snapshot" not found!');
    }
    
    const oldNode = nodes[oldNodeIndex];
    console.log('✅ Найдена старая нода "Save Snapshot"\n');
    
    // Создаем новую ноду
    const newNode = {
      ...oldNode,
      parameters: {
        operation: 'executeQuery',
        query: `INSERT INTO rentprog_car_states_snapshot (
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
          $1::uuid, $2::text, $3::text, $4::text, $5::text, $6::text, $7::text, $8::text,
          $9::text, $10::text, $11::text, $12::text, $13::boolean, $14::text, $15::boolean,
          $16::boolean, $17::numeric, $18::numeric, $19::text, $20::text, $21::numeric,
          $22::numeric, $23::numeric, $24::numeric, $25::numeric, $26::text,
          $27::numeric, $28::numeric, $29::numeric, $30::numeric,
          $31::numeric, $32::boolean, $33::boolean, $34::boolean, $35::boolean,
          $36::boolean, $37::boolean, $38::boolean, $39::boolean, $40::text,
          $41::numeric, $42::numeric, $43::text, $44::text, $45::text,
          $46::text, $47::jsonb, NOW()
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
        RETURNING rentprog_id;`,
        options: {
          queryReplacement: `={{ $json.branch_id }},={{ String($json.rentprog_id) }},={{ $json.car_name || null }},={{ $json.code || null }},={{ $json.number || null }},={{ $json.vin || null }},={{ $json.color || null }},={{ $json.year || null }},={{ $json.transmission || null }},={{ $json.fuel || null }},={{ $json.car_type || null }},={{ $json.car_class || null }},={{ $json.active || false }},={{ $json.state || null }},={{ $json.tank_state || false }},={{ $json.clean_state || false }},={{ $json.mileage || null }},={{ $json.tire_type || null }},={{ $json.tire_size || null }},={{ $json.last_inspection || null }},={{ $json.deposit || null }},={{ $json.price_hour || null }},={{ $json.hourly_deposit || null }},={{ $json.monthly_deposit || null }},={{ $json.investor_id || null }},={{ $json.purchase_price || null }},={{ $json.purchase_date || null }},={{ $json.age_limit || null }},={{ $json.driver_year_limit || null }},={{ $json.franchise || null }},={{ $json.max_fine || null }},={{ $json.repair_cost || null }},={{ $json.is_air || false }},={{ $json.climate_control || false }},={{ $json.parktronic || false }},={{ $json.parktronic_camera || false }},={{ $json.heated_seats || false }},={{ $json.audio_system || false }},={{ $json.usb_system || false }},={{ $json.rain_sensor || false }},={{ $json.engine_capacity || null }},={{ $json.number_doors || null }},={{ $json.tank_value || null }},={{ $json.pts || null }},={{ $json.registration_certificate || null }},={{ $json.body_number || null }},={{ $json.company_id || null }},={{ $json.data ? JSON.stringify($json.data) : null }}`
        }
      }
    };
    
    // Заменяем ноду
    nodes[oldNodeIndex] = newNode;
    
    console.log('🔧 Заменяю ноду на новую...\n');
    
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
    
    console.log('✅ Нода "Save Snapshot" успешно пересоздана!\n');
    
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    throw error;
  }
}

recreateSaveSnapshotNode();

