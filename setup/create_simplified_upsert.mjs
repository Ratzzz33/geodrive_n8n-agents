import fs from 'fs';

console.log('\n🔧 Создание упрощенного Upsert Processor...\n');

const workflow = {
  name: "RentProg Upsert Processor (Simplified)",
  nodes: [
    {
      parameters: {
        httpMethod: "POST",
        path: "upsert-processor",
        responseMode: "responseNode",
        options: {},
        onError: "continueRegularOutput"
      },
      id: "webhook-trigger",
      name: "Webhook Trigger",
      type: "n8n-nodes-base.webhook",
      typeVersion: 1,
      position: [250, 400],
      webhookId: "rentprog-upsert-processor"
    },
    {
      parameters: {
        assignments: {
          assignments: [
            {
              id: "rentprog_id",
              name: "rentprog_id",
              value: "={{ $json.body.rentprog_id || $json.body.rentprogId || $json.rentprog_id || $json.rentprogId }}",
              type: "string"
            },
            {
              id: "entity_type",
              name: "entity_type",
              value: "={{ $json.body.entity_type || $json.body.entityType || $json.entity_type || $json.entityType }}",
              type: "string"
            }
          ]
        }
      },
      id: "prepare-data",
      name: "Prepare Data",
      type: "n8n-nodes-base.set",
      typeVersion: 3.4,
      position: [450, 400]
    },
    {
      parameters: {
        mode: "runOnceForAllItems",
        jsCode: `// Ищем сущность по всем филиалам
const branchKeys = {
  "tbilisi": "91b83b93963633649f29a04b612bab3f9fbb0471b5928622",
  "batumi": "7ad345720f8d92f10c187122427c6a2c2bb9494c6bf14e8d",
  "kutaisi": "5599ebb7b94827fdfd49ca3a5b7e259cfa99d8ea78edeb50",
  "service-center": "5y4j4gcs75o9n5s1e2vrxx4a"
};

const baseUrl = 'https://rentprog.net/api/v1/public';
const rentprogId = $input.item.json.rentprog_id;
const entityType = $input.item.json.entity_type;

console.log(\`🔍 Поиск \${entityType} с ID \${rentprogId}\`);

// Мапинг типов на endpoints
const endpoints = {
  'car': '/all_cars_full',
  'client': '/all_clients',
  'booking': '/all_bookings'
};

const endpoint = endpoints[entityType];
if (!endpoint) {
  throw new Error(\`Неизвестный тип сущности: \${entityType}\`);
}

// Ищем по всем филиалам
for (const [branch, companyToken] of Object.entries(branchKeys)) {
  try {
    console.log(\`  → Проверка филиала: \${branch}\`);
    
    // Получаем токен
    const tokenResponse = await this.helpers.httpRequest({
      method: 'GET',
      url: \`\${baseUrl}/get_token\`,
      qs: { company_token: companyToken },
      json: true,
      timeout: 10000
    });
    
    const requestToken = tokenResponse?.token;
    if (!requestToken) {
      console.warn(\`  ⚠️  Не удалось получить токен для \${branch}\`);
      continue;
    }
    
    // Загружаем все сущности
    const response = await this.helpers.httpRequest({
      method: 'GET',
      url: \`\${baseUrl}\${endpoint}\`,
      headers: { 'Authorization': \`Bearer \${requestToken}\` },
      json: true,
      timeout: 15000
    });
    
    const items = Array.isArray(response) ? response : (response.data || []);
    console.log(\`  → Загружено: \${items.length} \${entityType}s\`);
    
    // Ищем нужную сущность
    const found = items.find(item => item.id == rentprogId);
    
    if (found) {
      console.log(\`  ✅ Найдено в \${branch}!\`);
      return [{
        json: {
          ok: true,
          branch: branch,
          entity_type: entityType,
          rentprog_id: rentprogId,
          data: found
        }
      }];
    }
    
  } catch (error) {
    console.error(\`  ❌ Ошибка в \${branch}: \${error.message}\`);
  }
}

// Не найдено ни в одном филиале
console.log('  ❌ Не найдено ни в одном филиале');
return [{
  json: {
    ok: false,
    error: 'Not found in any branch',
    entity_type: entityType,
    rentprog_id: rentprogId
  }
}];`
      },
      id: "search-entity",
      name: "Search Entity",
      type: "n8n-nodes-base.code",
      typeVersion: 2,
      position: [650, 400]
    },
    {
      parameters: {
        conditions: {
          options: {
            caseSensitive: true,
            leftValue: "",
            typeValidation: "strict"
          },
          conditions: [
            {
              id: "found-check",
              leftValue: "={{ $json.ok }}",
              rightValue: true,
              operator: {
                type: "boolean",
                operation: "equals"
              }
            }
          ],
          combinator: "and"
        }
      },
      id: "if-found",
      name: "If Found",
      type: "n8n-nodes-base.if",
      typeVersion: 2,
      position: [850, 400]
    },
    {
      parameters: {
        operation: "executeQuery",
        query: "INSERT INTO external_refs (entity_type, entity_id, system, external_id, created_at, updated_at)\\nSELECT $1, gen_random_uuid(), 'rentprog', $2, NOW(), NOW()\\nWHERE NOT EXISTS (\\n  SELECT 1 FROM external_refs WHERE system = 'rentprog' AND external_id = $2\\n)\\nON CONFLICT (system, external_id) DO UPDATE SET updated_at = NOW()\\nRETURNING entity_id",
        options: {
          queryReplacement: "={{ $json.entity_type }},={{ $json.rentprog_id }}"
        }
      },
      id: "save-data",
      name: "Save to DB",
      type: "n8n-nodes-base.postgres",
      typeVersion: 2,
      position: [1050, 300],
      credentials: {
        postgres: {
          id: "3I9fyXVlGg4Vl4LZ",
          name: "Postgres account"
        }
      }
    },
    {
      parameters: {
        respondWith: "json",
        responseBody: "={{ JSON.stringify({ ok: true, branch: $json.branch, entityId: $json.data.id }) }}",
        options: {}
      },
      id: "respond-success",
      name: "Respond Success",
      type: "n8n-nodes-base.respondToWebhook",
      typeVersion: 1,
      position: [1250, 300]
    },
    {
      parameters: {
        chatId: "={{ $env.TELEGRAM_ALERT_CHAT_ID }}",
        text: "❌ Не удалось найти сущность ни в одном филиале!\\n\\nТип: {{ $json.entity_type }}\\nID: {{ $json.rentprog_id }}",
        operation: "sendMessage"
      },
      id: "alert-not-found",
      name: "Alert Not Found",
      type: "n8n-nodes-base.telegram",
      typeVersion: 1,
      position: [1050, 500],
      credentials: {
        telegramApi: {
          id: "1tKryXxL5Gq395nN",
          name: "Telegram account"
        }
      }
    },
    {
      parameters: {
        respondWith: "json",
        responseBody: '{"ok":false,"error":"Not found in any branch"}',
        options: {}
      },
      id: "respond-not-found",
      name: "Respond Not Found",
      type: "n8n-nodes-base.respondToWebhook",
      typeVersion: 1,
      position: [1250, 500]
    }
  ],
  connections: {
    "Webhook Trigger": {
      main: [[{ node: "Prepare Data", type: "main", index: 0 }]]
    },
    "Prepare Data": {
      main: [[{ node: "Search Entity", type: "main", index: 0 }]]
    },
    "Search Entity": {
      main: [[{ node: "If Found", type: "main", index: 0 }]]
    },
    "If Found": {
      main: [
        [{ node: "Save to DB", type: "main", index: 0 }],
        [{ node: "Alert Not Found", type: "main", index: 0 }]
      ]
    },
    "Save to DB": {
      main: [[{ node: "Respond Success", type: "main", index: 0 }]]
    },
    "Alert Not Found": {
      main: [[{ node: "Respond Not Found", type: "main", index: 0 }]]
    }
  },
  pinData: {},
  settings: {
    executionOrder: "v1"
  },
  staticData: null,
  tags: [],
  triggerCount: 0
};

fs.writeFileSync('n8n-workflows/rentprog-upsert-processor-simplified.json', JSON.stringify(workflow, null, 2), 'utf8');

console.log('💾 Файл создан: n8n-workflows/rentprog-upsert-processor-simplified.json');
console.log('\n📝 Архитектура:');
console.log('   1. Webhook Trigger');
console.log('   2. Prepare Data (Set node)');
console.log('   3. Search Entity (Code node) - один запрос /all_{entity}_full по всем филиалам');
console.log('   4. If Found');
console.log('   5a. Save to DB + Respond Success');
console.log('   5b. Alert Not Found + Respond Not Found');
console.log('\n✅ Гораздо проще и быстрее!');
console.log('\n🚀 Следующий шаг: загрузить в n8n и заменить старый workflow\n');

