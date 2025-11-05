import https from 'https';
import fs from 'fs';

const N8N_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI';
const WORKFLOW_ID = 'PbDKuU06H7s2Oem8';

// Код для динамического создания колонок
const dynamicSchemaCode = `// Динамическое создание колонок для новых полей
const entityData = $json.data || $json;
const entityType = $json.entity_type;
const rentprogId = $json.rentprog_id;

// Определяем таблицу
const tableMap = {
  'car': 'cars',
  'client': 'clients',
  'booking': 'bookings'
};

const tableName = tableMap[entityType];

if (!tableName) {
  throw new Error(\`Unknown entity_type: \${entityType}\`);
}

// Получаем существующие колонки из БД
const pgCredentials = await this.getCredentials('postgres');
const { createPool } = await import('generic-pool');
const pg = await import('pg');

const pool = createPool({
  create: async () => {
    const client = new pg.Client({
      host: pgCredentials.host,
      port: pgCredentials.port || 5432,
      database: pgCredentials.database,
      user: pgCredentials.user,
      password: pgCredentials.password,
      ssl: pgCredentials.ssl === 'allow' || pgCredentials.ssl === 'require' ? { rejectUnauthorized: false } : false
    });
    await client.connect();
    return client;
  },
  destroy: async (client) => {
    await client.end();
  }
}, { min: 1, max: 1 });

const client = await pool.acquire();

try {
  // 1. Получить существующие колонки
  const existingCols = await client.query(\`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_name = $1
  \`, [tableName]);
  
  const existingColumns = new Set(existingCols.rows.map(r => r.column_name));
  
  // 2. Определить какие колонки нужно добавить
  const columnsToAdd = [];
  
  for (const [key, value] of Object.entries(entityData)) {
    if (key === 'id' || existingColumns.has(key)) continue;
    
    // Определяем тип данных
    let pgType = 'TEXT';
    if (typeof value === 'number') {
      pgType = Number.isInteger(value) ? 'INTEGER' : 'NUMERIC';
    } else if (typeof value === 'boolean') {
      pgType = 'BOOLEAN';
    } else if (value === null) {
      pgType = 'TEXT'; // По умолчанию для NULL
    } else if (typeof value === 'object') {
      pgType = 'JSONB';
    } else if (typeof value === 'string' && value.match(/^\\d{4}-\\d{2}-\\d{2}/)) {
      // Попытка определить дату
      if (value.includes('T') || value.includes(' ')) {
        pgType = 'TIMESTAMPTZ';
      } else {
        pgType = 'DATE';
      }
    }
    
    columnsToAdd.push({ name: key, type: pgType });
  }
  
  // 3. Добавить недостающие колонки
  const addedColumns = [];
  
  for (const col of columnsToAdd) {
    try {
      await client.query(\`
        ALTER TABLE \${tableName}
        ADD COLUMN IF NOT EXISTS "\${col.name}" \${col.type}
      \`);
      addedColumns.push(col);
      console.log(\`✅ Added column: \${tableName}.\${col.name} (\${col.type})\`);
    } catch (err) {
      console.warn(\`⚠️ Failed to add column \${col.name}: \${err.message}\`);
    }
  }
  
  // 4. Подготовить данные для INSERT/UPDATE
  const dataToStore = { ...entityData };
  
  return {
    json: {
      table_name: tableName,
      rentprog_id: rentprogId,
      entity_type: entityType,
      data: dataToStore,
      data_json: JSON.stringify(dataToStore),
      added_columns: addedColumns.map(c => \`\${c.name} (\${c.type})\`),
      schema_updated: addedColumns.length > 0
    }
  };
  
} finally {
  await pool.release(client);
  await pool.drain();
  await pool.clear();
}`;

console.log('\n🔄 Добавление динамической схемы в workflow...\n');

// Читаем текущий workflow
const getCurrentWorkflow = () => {
  return new Promise((resolve, reject) => {
    const options = {
      method: 'GET',
      headers: {
        'X-N8N-API-KEY': N8N_API_KEY,
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(`https://n8n.rentflow.rentals/api/v1/workflows/${WORKFLOW_ID}`, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          resolve(JSON.parse(data).data);
        } else {
          reject(new Error(`Failed to get workflow: ${res.statusCode}`));
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
};

const updateWorkflow = (workflow) => {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      name: workflow.name,
      nodes: workflow.nodes,
      connections: workflow.connections,
      settings: workflow.settings
    });

    const options = {
      method: 'PUT',
      headers: {
        'X-N8N-API-KEY': N8N_API_KEY,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    };

    const req = https.request(`https://n8n.rentflow.rentals/api/v1/workflows/${WORKFLOW_ID}`, options, (res) => {
      let responseData = '';
      res.on('data', chunk => responseData += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          resolve(JSON.parse(responseData));
        } else {
          reject(new Error(`Failed to update workflow: ${res.statusCode} - ${responseData}`));
        }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
};

async function addDynamicSchema() {
  try {
    console.log('1️⃣ Получение текущего workflow...');
    const workflow = await getCurrentWorkflow();
    console.log(`   ✓ Получен workflow: ${workflow.nodes.length} нод\n`);

    console.log('2️⃣ Добавление нода "Ensure Schema"...');
    
    // Создаем новую ноду для обеспечения схемы
    const ensureSchemaNode = {
      "parameters": {
        "mode": "runOnceForAllItems",
        "jsCode": dynamicSchemaCode
      },
      "id": "ensure-schema",
      "name": "Ensure Schema",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [2240, 500],
      "notes": "Автоматически создает недостающие колонки в БД"
    };

    // Находим ноду "Extract Result"
    const extractResultIdx = workflow.nodes.findIndex(n => n.id === 'extract-result');
    if (extractResultIdx === -1) {
      throw new Error('Node "Extract Result" not found');
    }

    // Находим ноду "Insert Fetched Entity"
    const insertFetchedIdx = workflow.nodes.findIndex(n => n.id === 'insert-fetched');
    if (insertFetchedIdx === -1) {
      throw new Error('Node "Insert Fetched Entity" not found');
    }

    // Проверяем есть ли уже нода "Ensure Schema"
    const ensureSchemaIdx = workflow.nodes.findIndex(n => n.id === 'ensure-schema');
    
    if (ensureSchemaIdx === -1) {
      // Добавляем новую ноду между Extract Result и Insert Fetched Entity
      workflow.nodes.splice(insertFetchedIdx, 0, ensureSchemaNode);
      console.log('   ✓ Нода "Ensure Schema" добавлена\n');
    } else {
      // Обновляем существующую ноду
      workflow.nodes[ensureSchemaIdx] = ensureSchemaNode;
      console.log('   ✓ Нода "Ensure Schema" обновлена\n');
    }

    console.log('3️⃣ Обновление connections...');
    
    // Обновляем connection: Extract Result → Ensure Schema → Insert Fetched Entity
    workflow.connections["Extract Result"] = {
      "main": [[{"node": "Ensure Schema", "type": "main", "index": 0}]]
    };
    
    workflow.connections["Ensure Schema"] = {
      "main": [[{"node": "Insert Fetched Entity", "type": "main", "index": 0}]]
    };
    
    console.log('   ✓ Connections обновлены\n');

    console.log('4️⃣ Обновление workflow в n8n...');
    await updateWorkflow(workflow);
    console.log('   ✓ Workflow обновлен\n');

    console.log('✅ Динамическая схема добавлена!');
    console.log(`\n📍 URL: https://n8n.rentflow.rentals/workflow/${WORKFLOW_ID}`);
    console.log('\n💡 Теперь workflow будет:');
    console.log('   1. Получать данные от RentProg');
    console.log('   2. Проверять какие поля пришли');
    console.log('   3. Автоматически создавать недостающие колонки');
    console.log('   4. Записывать данные без ошибок\n');

  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    if (error.stack) console.error(error.stack);
    process.exit(1);
  }
}

addDynamicSchema();

