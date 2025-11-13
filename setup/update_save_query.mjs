import https from 'https';

const N8N_HOST = 'https://n8n.rentflow.rentals';
const API_KEY = process.env.N8N_API_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI';
const WORKFLOW_ID = 'P3BnmX7Nrmh1cusF';

const NEW_QUERY = `INSERT INTO bookings (
  branch, number, is_active,
  start_date, end_date, start_date_formatted, end_date_formatted,
  client_id, client_name, client_category,
  car_id, car_name, car_code,
  location_start, location_end,
  total, deposit, rental_cost, days,
  state, in_rent, archive,
  start_worker_id, end_worker_id, responsible,
  description, source, data,
  is_technical, technical_type, technical_purpose
)
VALUES (
  {{ $json.branch ? "'" + $json.branch.replace(/'/g, "''") + "'" : 'NULL' }},
  {{ $json.booking_id ? "'" + $json.booking_id + "'" : 'NULL' }},
  {{ $json.is_active ? 'TRUE' : 'FALSE' }},
  {{ $json.start_date ? "'" + $json.start_date + "'" : 'NULL' }},
  {{ $json.end_date ? "'" + $json.end_date + "'" : 'NULL' }},
  {{ $json.start_date_formatted ? "'" + $json.start_date_formatted.replace(/'/g, "''") + "'" : 'NULL' }},
  {{ $json.end_date_formatted ? "'" + $json.end_date_formatted.replace(/'/g, "''") + "'" : 'NULL' }},
  {{ $json.client_id ? "'" + $json.client_id + "'" : 'NULL' }},
  {{ $json.client_name ? "'" + $json.client_name.replace(/'/g, "''") + "'" : 'NULL' }},
  {{ $json.client_category ? "'" + $json.client_category.replace(/'/g, "''") + "'" : 'NULL' }},
  {{ $json.car_id ? "'" + $json.car_id + "'" : 'NULL' }},
  {{ $json.car_name ? "'" + $json.car_name.replace(/'/g, "''") + "'" : 'NULL' }},
  {{ $json.car_code ? "'" + $json.car_code.replace(/'/g, "''") + "'" : 'NULL' }},
  {{ $json.location_start ? "'" + $json.location_start.replace(/'/g, "''") + "'" : 'NULL' }},
  {{ $json.location_end ? "'" + $json.location_end.replace(/'/g, "''") + "'" : 'NULL' }},
  {{ $json.total !== undefined && $json.total !== null ? $json.total : 'NULL' }},
  {{ $json.deposit !== undefined && $json.deposit !== null ? $json.deposit : 'NULL' }},
  {{ $json.rental_cost !== undefined && $json.rental_cost !== null ? $json.rental_cost : 'NULL' }},
  {{ $json.days !== undefined && $json.days !== null ? $json.days : 'NULL' }},
  {{ $json.state ? "'" + $json.state.replace(/'/g, "''") + "'" : 'NULL' }},
  {{ $json.in_rent ? 'TRUE' : 'FALSE' }},
  {{ $json.archive ? 'TRUE' : 'FALSE' }},
  {{ $json.start_worker_id ? "'" + $json.start_worker_id + "'" : 'NULL' }},
  {{ $json.end_worker_id ? "'" + $json.end_worker_id + "'" : 'NULL' }},
  {{ $json.responsible ? "'" + $json.responsible.replace(/'/g, "''") + "'" : 'NULL' }},
  {{ $json.description ? "'" + $json.description.replace(/'/g, "''") + "'" : 'NULL' }},
  {{ $json.source ? "'" + $json.source.replace(/'/g, "''") + "'" : 'NULL' }},
  {{ $json.data ? "'" + JSON.stringify($json.data).replace(/'/g, "''") + "'::jsonb" : "'{}'::jsonb" }},
  {{ $json.is_technical ? 'TRUE' : 'FALSE' }},
  {{ $json.technical_type ? "'" + $json.technical_type.replace(/'/g, "''") + "'" : "'regular'" }},
  {{ $json.technical_purpose ? "'" + $json.technical_purpose.replace(/'/g, "''") + "'" : 'NULL' }}
)
ON CONFLICT (branch, number)
DO UPDATE SET
  is_active = EXCLUDED.is_active,
  start_date = EXCLUDED.start_date,
  end_date = EXCLUDED.end_date,
  start_date_formatted = EXCLUDED.start_date_formatted,
  end_date_formatted = EXCLUDED.end_date_formatted,
  client_id = EXCLUDED.client_id,
  client_name = EXCLUDED.client_name,
  client_category = EXCLUDED.client_category,
  car_id = EXCLUDED.car_id,
  car_name = EXCLUDED.car_name,
  car_code = EXCLUDED.car_code,
  location_start = EXCLUDED.location_start,
  location_end = EXCLUDED.location_end,
  total = EXCLUDED.total,
  deposit = EXCLUDED.deposit,
  rental_cost = EXCLUDED.rental_cost,
  days = EXCLUDED.days,
  state = EXCLUDED.state,
  in_rent = EXCLUDED.in_rent,
  archive = EXCLUDED.archive,
  start_worker_id = EXCLUDED.start_worker_id,
  end_worker_id = EXCLUDED.end_worker_id,
  responsible = EXCLUDED.responsible,
  description = EXCLUDED.description,
  source = EXCLUDED.source,
  data = EXCLUDED.data,
  is_technical = EXCLUDED.is_technical,
  technical_type = EXCLUDED.technical_type,
  technical_purpose = EXCLUDED.technical_purpose,
  updated_at = NOW()
RETURNING id, branch, number;`;

function apiRequest(path, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, N8N_HOST);
    const requestOptions = {
      method: options.method || 'GET',
      headers: {
        'X-N8N-API-KEY': API_KEY,
        'Accept': 'application/json',
        ...(options.headers || {})
      }
    };

    const req = https.request(url, requestOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          resolve(data ? JSON.parse(data) : {});
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', reject);

    if (options.body) {
      req.write(options.body);
    }

    req.end();
  });
}

async function main() {
  try {
    console.log('🔧 Получаю workflow...');
    const response = await apiRequest(`/api/v1/workflows/${WORKFLOW_ID}`);
    const workflow = response.data || response;

    const saveNodeIndex = workflow.nodes.findIndex((n) => n.name === 'Save to DB');
    if (saveNodeIndex === -1) {
      throw new Error('Нода "Save to DB" не найдена');
    }

    workflow.nodes[saveNodeIndex].parameters.query = NEW_QUERY;

    const updatePayload = JSON.stringify({
      name: workflow.name,
      nodes: workflow.nodes,
      connections: workflow.connections,
      settings: workflow.settings
    });

    console.log('💾 Обновляю workflow...');
    await apiRequest(`/api/v1/workflows/${WORKFLOW_ID}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: updatePayload
    });

    console.log('✅ SQL запрос обновлён');
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    process.exit(1);
  }
}

main();
