import https from 'https';

const N8N_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI';
const WORKFLOW_ID = 'PbDKuU06H7s2Oem8';
const N8N_HOST = 'https://n8n.rentflow.rentals/api/v1';

console.log('\n📝 Добавление обработки вложенных car и client объектов...\n');

// Получаем текущий workflow
function getWorkflow() {
  return new Promise((resolve, reject) => {
    const options = {
      method: 'GET',
      headers: {
        'X-N8N-API-KEY': N8N_API_KEY,
        'Content-Type': 'application/json'
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
          reject(new Error(`Get failed: ${res.statusCode} - ${data}`));
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
    const data = JSON.stringify(workflow);
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
          reject(new Error(`Update failed: ${res.statusCode} - ${responseData}`));
        }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function addNestedEntitiesProcessing() {
  try {
    console.log('1️⃣ Получение текущего workflow...');
    const workflow = await getWorkflow();
    console.log(`   ✓ Получено ${workflow.nodes.length} нод\n`);

    // Новые ноды
    const newNodes = [
      // 1. Process Nested Entities - извлекает car и client из booking
      {
        parameters: {
          jsCode: `// Обрабатываем вложенные car и client объекты из booking
const data = $json.data || $json;
const entityType = $json.entity_type;

// Если это НЕ booking - пропускаем
if (entityType !== 'booking') {
  return {
    json: {
      skip_nested: true,
      booking_entity_id: $json.entity_id,
      rentprog_booking_id: $json.rentprog_id
    }
  };
}

// Извлекаем вложенные объекты
const carData = data.car;
const clientData = data.client;

const carId = carData?.id ? String(carData.id) : null;
const clientId = clientData?.id ? String(clientData.id) : null;

if (!carData || !clientData) {
  throw new Error('Booking missing car or client data');
}

return {
  json: {
    booking_entity_id: $json.entity_id,
    rentprog_booking_id: $json.rentprog_id,
    
    // Данные машины
    car_rentprog_id: carId,
    car_data: carData,
    car_data_json: JSON.stringify(carData),
    
    // Данные клиента
    client_rentprog_id: clientId,
    client_data: clientData,
    client_data_json: JSON.stringify(clientData),
    
    skip_nested: false
  }
};`
        },
        id: "process-nested-entities",
        name: "Process Nested Entities",
        type: "n8n-nodes-base.code",
        typeVersion: 2,
        position: [2656, 512]
      },
      
      // 2. Upsert Car
      {
        parameters: {
          operation: "executeQuery",
          query: `-- Upsert машины из booking
SELECT * FROM dynamic_upsert_entity(
  'cars'::TEXT,
  $1::TEXT,
  $2::JSONB
);`,
          options: {
            queryReplacement: "={{ $json.car_rentprog_id }},={{ $json.car_data_json }}"
          }
        },
        id: "upsert-car",
        name: "Upsert Car",
        type: "n8n-nodes-base.postgres",
        typeVersion: 2.4,
        position: [2864, 416],
        credentials: {
          postgres: {
            id: "3I9fyXVlGg4Vl4LZ",
            name: "Postgres account"
          }
        }
      },
      
      // 3. Upsert Client
      {
        parameters: {
          operation: "executeQuery",
          query: `-- Upsert клиента из booking
SELECT * FROM dynamic_upsert_entity(
  'clients'::TEXT,
  $1::TEXT,
  $2::JSONB
);`,
          options: {
            queryReplacement: "={{ $json.client_rentprog_id }},={{ $json.client_data_json }}"
          }
        },
        id: "upsert-client",
        name: "Upsert Client",
        type: "n8n-nodes-base.postgres",
        typeVersion: 2.4,
        position: [3072, 416],
        credentials: {
          postgres: {
            id: "3I9fyXVlGg4Vl4LZ",
            name: "Postgres account"
          }
        }
      },
      
      // 4. Merge Results - объединяет UUID car и client
      {
        parameters: {
          jsCode: `// Объединяем результаты upsert car и client
const carResult = $('Upsert Car').first().json;
const clientResult = $('Upsert Client').first().json;
const nestedData = $('Process Nested Entities').first().json;

return {
  json: {
    booking_entity_id: nestedData.booking_entity_id,
    rentprog_booking_id: nestedData.rentprog_booking_id,
    car_uuid: carResult.entity_id,
    client_uuid: clientResult.entity_id
  }
};`
        },
        id: "merge-results",
        name: "Merge Results",
        type: "n8n-nodes-base.code",
        typeVersion: 2,
        position: [3280, 416]
      },
      
      // 5. Update Booking FKeys - обновляет car_id и client_id в booking
      {
        parameters: {
          operation: "executeQuery",
          query: `-- Обновляем foreign keys в booking
UPDATE bookings
SET
  car_id = $1::UUID,
  client_id = $2::UUID,
  updated_at = NOW()
WHERE id = $3::UUID
RETURNING id, car_id, client_id;`,
          options: {
            queryReplacement: "={{ $json.car_uuid }},={{ $json.client_uuid }},={{ $json.booking_entity_id }}"
          }
        },
        id: "update-booking-fkeys",
        name: "Update Booking FKeys",
        type: "n8n-nodes-base.postgres",
        typeVersion: 2.4,
        position: [3488, 416],
        credentials: {
          postgres: {
            id: "3I9fyXVlGg4Vl4LZ",
            name: "Postgres account"
          }
        }
      }
    ];

    // Добавляем новые ноды
    workflow.nodes.push(...newNodes);

    // Обновляем connections
    // Insert Fetched Entity → Process Nested Entities
    workflow.connections["Insert Fetched Entity"] = {
      main: [[{ node: "Process Nested Entities", type: "main", index: 0 }]]
    };

    // Process Nested Entities → Upsert Car
    workflow.connections["Process Nested Entities"] = {
      main: [[{ node: "Upsert Car", type: "main", index: 0 }]]
    };

    // Upsert Car → Upsert Client
    workflow.connections["Upsert Car"] = {
      main: [[{ node: "Upsert Client", type: "main", index: 0 }]]
    };

    // Upsert Client → Merge Results
    workflow.connections["Upsert Client"] = {
      main: [[{ node: "Merge Results", type: "main", index: 0 }]]
    };

    // Merge Results → Update Booking FKeys
    workflow.connections["Merge Results"] = {
      main: [[{ node: "Update Booking FKeys", type: "main", index: 0 }]]
    };

    // Update Booking FKeys → Respond Success
    workflow.connections["Update Booking FKeys"] = {
      main: [[{ node: "Respond Success", type: "main", index: 0 }]]
    };

    console.log('2️⃣ Добавление новых нод...');
    console.log(`   ✓ Process Nested Entities - извлекает car и client`);
    console.log(`   ✓ Upsert Car - сохраняет/обновляет машину`);
    console.log(`   ✓ Upsert Client - сохраняет/обновляет клиента`);
    console.log(`   ✓ Merge Results - объединяет UUID`);
    console.log(`   ✓ Update Booking FKeys - обновляет car_id и client_id в booking\n`);

    console.log('3️⃣ Обновление workflow...');
    await updateWorkflow(workflow);
    console.log('   ✓ Workflow обновлён!\n');

    console.log('✅ Готово!');
    console.log(`   URL: https://n8n.rentflow.rentals/workflow/${WORKFLOW_ID}\n`);

  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    process.exit(1);
  }
}

addNestedEntitiesProcessing();

