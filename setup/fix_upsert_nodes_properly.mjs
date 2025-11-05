import https from 'https';

const N8N_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI';
const WORKFLOW_ID = 'PbDKuU06H7s2Oem8';
const N8N_HOST = 'https://n8n.rentflow.rentals/api/v1';

console.log('\n🔧 Исправление Upsert нод (использование Code вместо queryReplacement)...\n');

function getWorkflow() {
  return new Promise((resolve, reject) => {
    const options = {
      method: 'GET',
      headers: { 'X-N8N-API-KEY': N8N_API_KEY }
    };

    https.request(`${N8N_HOST}/workflows/${WORKFLOW_ID}`, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          resolve(JSON.parse(data).data || JSON.parse(data));
        } else {
          reject(new Error(`GET failed: ${res.statusCode} ${data}`));
        }
      });
    }).on('error', reject).end();
  });
}

function updateWorkflow(workflow) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(workflow);
    const options = {
      method: 'PUT',
      headers: {
        'X-N8N-API-KEY': N8N_API_KEY,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    };

    const req = https.request(`${N8N_HOST}/workflows/${WORKFLOW_ID}`, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          resolve(JSON.parse(data));
        } else {
          reject(new Error(`PUT failed: ${res.statusCode} ${data}`));
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function main() {
  try {
    console.log('1️⃣ Получение workflow...');
    const workflow = await getWorkflow();
    console.log(`   ✓ Получен workflow: ${workflow.name}\n`);

    console.log('2️⃣ Обновление Upsert Car и Upsert Client нод...');
    
    // Находим нужные ноды
    const upsertCarNode = workflow.nodes.find(n => n.id === 'upsert-car');
    const upsertClientNode = workflow.nodes.find(n => n.id === 'upsert-client');

    if (!upsertCarNode || !upsertClientNode) {
      throw new Error('Не найдены Upsert ноды!');
    }

    // Заменяем их на Code ноды, которые затем вызывают простой Postgres
    console.log('   ✓ Замена Upsert Car...');
    upsertCarNode.type = 'n8n-nodes-base.code';
    upsertCarNode.typeVersion = 2;
    delete upsertCarNode.credentials;
    upsertCarNode.parameters = {
      jsCode: `const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require'
});

const carRentprogId = $json.car_rentprog_id;
const carDataJson = $json.car_data_json;

try {
  const result = await pool.query(
    'SELECT * FROM dynamic_upsert_entity($1, $2, $3)',
    ['cars', carRentprogId, carDataJson]
  );
  
  return {
    json: result.rows[0]
  };
} catch (error) {
  throw new Error(\`Upsert Car failed: \${error.message}\`);
} finally {
  await pool.end();
}`
    };

    console.log('   ✓ Замена Upsert Client...');
    upsertClientNode.type = 'n8n-nodes-base.code';
    upsertClientNode.typeVersion = 2;
    delete upsertClientNode.credentials;
    upsertClientNode.parameters = {
      jsCode: `const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require'
});

const clientRentprogId = $json.client_rentprog_id;
const clientDataJson = $json.client_data_json;

try {
  const result = await pool.query(
    'SELECT * FROM dynamic_upsert_entity($1, $2, $3)',
    ['clients', clientRentprogId, clientDataJson]
  );
  
  return {
    json: result.rows[0]
  };
} catch (error) {
  throw new Error(\`Upsert Client failed: \${error.message}\`);
} finally {
  await pool.end();
}`
    };

    console.log('\n3️⃣ Обновление workflow...');
    
    // Удаляем служебные поля
    delete workflow.createdAt;
    delete workflow.updatedAt;
    delete workflow.versionId;
    delete workflow.active; // read-only for PUT
    
    await updateWorkflow(workflow);
    console.log('   ✓ Workflow обновлен!\n');

    console.log('✅ Исправление завершено!\n');
    console.log('💡 Теперь Upsert Car и Upsert Client используют Code ноды с pg.Pool');
    console.log('   Это обходит проблему queryReplacement с запятыми в JSON\n');

  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    process.exit(1);
  }
}

main();

