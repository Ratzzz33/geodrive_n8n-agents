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

async function recreateSaveSnapshotNodeComplete() {
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
    let connections = workflow.connections;
    
    // 1. Удаляем старую ноду
    console.log('🗑️ Удаляю старую ноду "Save Snapshot"...\n');
    nodes = nodes.filter(n => n.id !== NODE_ID);
    
    // 2. Удаляем connections к ней
    // Входящие в нее (Merge & Process -> Save Snapshot)
    if (connections['Split Cars and Prices']) {
      connections['Split Cars and Prices'].main[1] = []; // Очищаем ветку
    }
    
    // Исходящие из нее (Save Snapshot -> Pass Through Data)
    delete connections['Save Snapshot'];
    
    // 3. Создаем новую ноду с НОВЫМ ID, чтобы сбросить кеш
    const NEW_NODE_ID = 'save-snapshot-v3-fix';
    const newNode = {
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
          queryReplacement: `={{ $json.branch_id }},={{ String($json.rentprog_id) }},={{ $json.car_name }},={{ $json.code }},={{ $json.number }},={{ $json.vin }},={{ $json.color }},={{ $json.year }},={{ $json.transmission }},={{ $json.fuel }},={{ $json.car_type }},={{ $json.car_class }},={{ $json.active }},={{ $json.state }},={{ $json.tank_state }},={{ $json.clean_state }},={{ $json.mileage }},={{ $json.tire_type }},={{ $json.tire_size }},={{ $json.last_inspection }},={{ $json.deposit }},={{ $json.price_hour }},={{ $json.hourly_deposit }},={{ $json.monthly_deposit }},={{ $json.investor_id }},={{ $json.purchase_price }},={{ $json.purchase_date }},={{ $json.age_limit }},={{ $json.driver_year_limit }},={{ $json.franchise }},={{ $json.max_fine }},={{ $json.repair_cost }},={{ $json.is_air }},={{ $json.climate_control }},={{ $json.parktronic }},={{ $json.parktronic_camera }},={{ $json.heated_seats }},={{ $json.audio_system }},={{ $json.usb_system }},={{ $json.rain_sensor }},={{ $json.engine_capacity }},={{ $json.number_doors }},={{ $json.tank_value }},={{ $json.pts }},={{ $json.registration_certificate }},={{ $json.body_number }},={{ $json.company_id }},={{ $json.data ? JSON.stringify($json.data) : undefined }}`
        }
      },
      name: "Save Snapshot",
      type: "n8n-nodes-base.postgres",
      typeVersion: 2.5,
      position: [
        1488,
        464
      ],
      id: NEW_NODE_ID,
      credentials: {
        postgres: {
          id: "3I9fyXVlGg4Vl4LZ",
          name: "Postgres account"
        }
      }
    };
    
    nodes.push(newNode);
    
    // 4. Восстанавливаем connections к новой ноде
    // Merge & Process -> Save Snapshot
    // Но в данном workflow идет Split Cars and Prices -> Save Snapshot
    
    // Восстанавливаем связь от Split Cars and Prices (index 1 - вторая ветка)
    if (!connections['Split Cars and Prices']) {
       throw new Error('Node "Split Cars and Prices" not found in connections');
    }
    
    connections['Split Cars and Prices'].main[1] = [
      {
        node: "Save Snapshot",
        type: "main",
        index: 0
      }
    ];
    
    // Восстанавливаем связь от Save Snapshot -> Pass Through Data
    connections['Save Snapshot'] = {
      main: [
        [
          {
            node: "Pass Through Data",
            type: "main",
            index: 0
          }
        ]
      ]
    };
    
    console.log('🔧 Создаю новую ноду и обновляю связи...\n');
    
    // Обновляем workflow
    const updateResponse = await fetch(`${N8N_HOST}/workflows/${WORKFLOW_ID}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        name: workflow.name,
        nodes: nodes,
        connections: connections,
        settings: workflow.settings
      })
    });
    
    if (!updateResponse.ok) {
      const errorText = await updateResponse.text();
      throw new Error(`Failed to update workflow: ${updateResponse.status} ${updateResponse.statusText}\n${errorText}`);
    }
    
    console.log('✅ Нода "Save Snapshot" успешно пересоздана с НОВЫМ ID!\n');
    
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    throw error;
  }
}

recreateSaveSnapshotNodeComplete();

