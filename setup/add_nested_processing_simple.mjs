import https from 'https';
import fs from 'fs';

const N8N_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI';
const WORKFLOW_ID = 'PbDKuU06H7s2Oem8';
const N8N_HOST = 'https://n8n.rentflow.rentals/api/v1';

console.log('\n📝 Добавление обработки вложенных car и client...\n');

// Получаем workflow
function getWorkflow() {
  return new Promise((resolve, reject) => {
    const options = {
      method: 'GET',
      headers: {
        'X-N8N-API-KEY': N8N_API_KEY
      }
    };

    const req = https.request(`${N8N_HOST}/workflows/${WORKFLOW_ID}`, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          const parsed = JSON.parse(data);
          resolve(parsed.data || parsed);
        } else {
          reject(new Error(`Get failed: ${res.statusCode}`));
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

// Обновляем workflow  
function updateWorkflow(workflow) {
  return new Promise((resolve, reject) => {
    // Создаем чистый объект только с нужными полями
    const cleanWorkflow = {
      id: workflow.id,
      name: workflow.name,
      active: workflow.active,
      nodes: workflow.nodes,
      connections: workflow.connections,
      settings: workflow.settings,
      staticData: workflow.staticData,
      pinData: workflow.pinData
    };

    const data = JSON.stringify(cleanWorkflow);
    const options = {
      method: 'PUT',
      headers: {
        'X-N8N-API-KEY': N8N_API_KEY,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    };

    const req = https.request(`${N8N_HOST}/workflows/${WORKFLOW_ID}`, options, (res) => {
      let responseData = '';
      res.on('data', chunk => responseData += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          resolve(JSON.parse(responseData));
        } else {
          console.error('Response:', responseData);
          reject(new Error(`Update failed: ${res.statusCode}`));
        }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function addNestedProcessing() {
  try {
    console.log('1️⃣ Получение workflow...');
    const workflow = await getWorkflow();
    console.log(`   ✓ ${workflow.nodes.length} нод\n`);

    // Новые ноды
    const newNodes = [
      {
        parameters: {
          jsCode: `// Обрабатываем вложенные car и client
const data = $json.data || $json;
const entityType = $json.entity_type;

if (entityType !== 'booking') {
  return {
    json: {
      skip_nested: true,
      booking_entity_id: $json.entity_id
    }
  };
}

const carData = data.car;
const clientData = data.client;

if (!carData || !clientData) {
  throw new Error('Booking missing car or client');
}

return {
  json: {
    booking_entity_id: $json.entity_id,
    car_rentprog_id: String(carData.id),
    car_data_json: JSON.stringify(carData),
    client_rentprog_id: String(clientData.id),
    client_data_json: JSON.stringify(clientData)
  }
};`
        },
        id: "process-nested",
        name: "Process Nested",
        type: "n8n-nodes-base.code",
        typeVersion: 2,
        position: [2656, 512]
      },
      {
        parameters: {
          operation: "executeQuery",
          query: "SELECT * FROM dynamic_upsert_entity('cars'::TEXT, $1::TEXT, $2::JSONB);",
          options: {
            queryReplacement: "={{ $json.car_rentprog_id }},={{ $json.car_data_json }}"
          }
        },
        id: "upsert-car",
        name: "Upsert Car",
        type: "n8n-nodes-base.postgres",
        typeVersion: 2.4,
        position: [2848, 512],
        credentials: { postgres: { id: "3I9fyXVlGg4Vl4LZ" } }
      },
      {
        parameters: {
          operation: "executeQuery",
          query: "SELECT * FROM dynamic_upsert_entity('clients'::TEXT, $1::TEXT, $2::JSONB);",
          options: {
            queryReplacement: "={{ $json.client_rentprog_id }},={{ $json.client_data_json }}"
          }
        },
        id: "upsert-client",
        name: "Upsert Client",
        type: "n8n-nodes-base.postgres",
        typeVersion: 2.4,
        position: [3040, 512],
        credentials: { postgres: { id: "3I9fyXVlGg4Vl4LZ" } }
      },
      {
        parameters: {
          jsCode: `const carResult = $('Upsert Car').first().json;
const clientResult = $('Upsert Client').first().json;
const nestedData = $('Process Nested').first().json;

return {
  json: {
    booking_entity_id: nestedData.booking_entity_id,
    car_uuid: carResult.entity_id,
    client_uuid: clientResult.entity_id
  }
};`
        },
        id: "merge-uuids",
        name: "Merge UUIDs",
        type: "n8n-nodes-base.code",
        typeVersion: 2,
        position: [3232, 512]
      },
      {
        parameters: {
          operation: "executeQuery",
          query: "UPDATE bookings SET car_id=$1::UUID, client_id=$2::UUID, updated_at=NOW() WHERE id=$3::UUID RETURNING id;",
          options: {
            queryReplacement: "={{ $json.car_uuid }},={{ $json.client_uuid }},={{ $json.booking_entity_id }}"
          }
        },
        id: "update-fkeys",
        name: "Update FKeys",
        type: "n8n-nodes-base.postgres",
        typeVersion: 2.4,
        position: [3424, 512],
        credentials: { postgres: { id: "3I9fyXVlGg4Vl4LZ" } }
      }
    ];

    workflow.nodes.push(...newNodes);

    // Обновляем connections
    workflow.connections["Insert Fetched Entity"] = {
      main: [[{ node: "Process Nested", type: "main", index: 0 }]]
    };

    workflow.connections["Process Nested"] = {
      main: [[{ node: "Upsert Car", type: "main", index: 0 }]]
    };

    workflow.connections["Upsert Car"] = {
      main: [[{ node: "Upsert Client", type: "main", index: 0 }]]
    };

    workflow.connections["Upsert Client"] = {
      main: [[{ node: "Merge UUIDs", type: "main", index: 0 }]]
    };

    workflow.connections["Merge UUIDs"] = {
      main: [[{ node: "Update FKeys", type: "main", index: 0 }]]
    };

    workflow.connections["Update FKeys"] = {
      main: [[{ node: "Respond Success", type: "main", index: 0 }]]
    };

    console.log('2️⃣ Добавлено 5 новых нод\n');
    console.log('3️⃣ Обновление workflow...');
    
    // Сохраняем JSON для отладки
    fs.writeFileSync('n8n-workflows/service-center-with-nested.json', JSON.stringify(workflow, null, 2));
    
    await updateWorkflow(workflow);
    console.log('   ✓ Готово!\n');

    console.log('✅ Workflow обновлён!');
    console.log(`   URL: https://n8n.rentflow.rentals/workflow/${WORKFLOW_ID}\n`);

  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    process.exit(1);
  }
}

addNestedProcessing();

