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

async function fixSaveSnapshotNodeV2() {
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
    
    // Находим ноду "Save Snapshot"
    const saveSnapshotNode = nodes.find(n => n.id === NODE_ID);
    
    if (!saveSnapshotNode) {
      throw new Error('Node "Save Snapshot" not found!');
    }
    
    console.log('✅ Найдена нода "Save Snapshot"\n');
    console.log('🔧 Обновляю queryReplacement, убираю "|| null"...\n');
    
    // Обновляем ноду. Используем undefined вместо null, n8n должен обработать это корректно.
    // Для data используем проверку на существование.
    saveSnapshotNode.parameters.options.queryReplacement = `={{ $json.branch_id }},={{ String($json.rentprog_id) }},={{ $json.car_name }},={{ $json.code }},={{ $json.number }},={{ $json.vin }},={{ $json.color }},={{ $json.year }},={{ $json.transmission }},={{ $json.fuel }},={{ $json.car_type }},={{ $json.car_class }},={{ $json.active }},={{ $json.state }},={{ $json.tank_state }},={{ $json.clean_state }},={{ $json.mileage }},={{ $json.tire_type }},={{ $json.tire_size }},={{ $json.last_inspection }},={{ $json.deposit }},={{ $json.price_hour }},={{ $json.hourly_deposit }},={{ $json.monthly_deposit }},={{ $json.investor_id }},={{ $json.purchase_price }},={{ $json.purchase_date }},={{ $json.age_limit }},={{ $json.driver_year_limit }},={{ $json.franchise }},={{ $json.max_fine }},={{ $json.repair_cost }},={{ $json.is_air }},={{ $json.climate_control }},={{ $json.parktronic }},={{ $json.parktronic_camera }},={{ $json.heated_seats }},={{ $json.audio_system }},={{ $json.usb_system }},={{ $json.rain_sensor }},={{ $json.engine_capacity }},={{ $json.number_doors }},={{ $json.tank_value }},={{ $json.pts }},={{ $json.registration_certificate }},={{ $json.body_number }},={{ $json.company_id }},={{ $json.data ? JSON.stringify($json.data) : undefined }}`;
    
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
    
    console.log('✅ Нода "Save Snapshot" успешно обновлена (V2)!\n');
    
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    throw error;
  }
}

fixSaveSnapshotNodeV2();

