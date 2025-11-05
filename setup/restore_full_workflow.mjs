import https from 'https';

const N8N_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI';
const WORKFLOW_ID = 'PbDKuU06H7s2Oem8';

// Полная структура из версии 256 (20 нод)
const fullWorkflow = {
  "name": "Service Center Processor",
  "nodes": [
    {
      "parameters": {
        "httpMethod": "POST",
        "path": "service-center-webhook",
        "responseMode": "responseNode",
        "options": {}
      },
      "id": "webhook-node",
      "name": "Webhook (Service Center)",
      "type": "n8n-nodes-base.webhook",
      "typeVersion": 1.1,
      "position": [240, 400],
      "webhookId": "service-center-webhook"
    },
    {
      "parameters": {
        "mode": "runOnceForAllItems",
        "jsCode": "// Парсинг вебхука от RentProg\nconst body = $input.item.json.body || $input.item.json;\n\n// Извлекаем event и payload\nconst eventName = body.event || 'unknown';\nlet payloadStr = body.payload || '{}';\nlet parsedPayload = {};\n\n// Парсим payload (может быть Ruby hash или JSON)\ntry {\n  if (typeof payloadStr === 'string') {\n    // Пробуем JSON\n    try {\n      parsedPayload = JSON.parse(payloadStr);\n    } catch {\n      // Конвертируем Ruby hash → JSON\n      let jsonStr = payloadStr\n        .replace(/=>/g, ':')\n        .replace(/([{, ])([a-zA-Z_][a-zA-Z0-9_]*):/g, '$1\"$2\":')\n        .replace(/nil/g, 'null');\n      parsedPayload = JSON.parse(jsonStr);\n    }\n  } else {\n    parsedPayload = payloadStr;\n  }\n} catch (e) {\n  parsedPayload = { error: 'Failed to parse payload', raw: payloadStr };\n}\n\n// Определяем entity_type и operation\nlet entityType = 'unknown';\nlet operation = 'unknown';\n\nif (eventName.includes('car')) entityType = 'car';\nelse if (eventName.includes('client')) entityType = 'client';\nelse if (eventName.includes('booking')) entityType = 'booking';\n\nif (eventName.includes('create')) operation = 'create';\nelse if (eventName.includes('update')) operation = 'update';\nelse if (eventName.includes('destroy')) operation = 'destroy';\n\n// Извлекаем rentprog_id\nconst rentprogId = parsedPayload.id ? String(parsedPayload.id) : 'unknown';\n\n// Генерируем event_hash (простая детерминированная строка)\nconst eventHash = `service-center_${eventName}_${rentprogId}_${body?.payload?.updated_at || body?.payload?.id || Date.now()}`;\n\nreturn {\n  json: {\n    event_name: eventName,\n    entity_type: entityType,\n    operation: operation,\n    rentprog_id: rentprogId,\n    company_id: 11163,\n    payload: parsedPayload,\n    metadata: {\n      source: 'webhook',\n      branch: 'service-center',\n      received_at: new Date().toISOString()\n    },\n    event_hash: eventHash\n  }\n};"
      },
      "id": "parse-webhook",
      "name": "Parse Webhook",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [440, 400]
    },
    {
      "parameters": {
        "operation": "executeQuery",
        "query": "INSERT INTO events (\n  event_name,\n  entity_type,\n  operation,\n  rentprog_id,\n  company_id,\n  type,\n  payload,\n  metadata,\n  event_hash,\n  processed\n)\nVALUES (\n  $1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9, false\n)\nON CONFLICT (company_id, type, rentprog_id) \nDO UPDATE SET\n  event_name = EXCLUDED.event_name,\n  payload = EXCLUDED.payload,\n  metadata = EXCLUDED.metadata\nRETURNING *;",
        "options": {
          "queryReplacement": "={{ $json.event_name }},={{ $json.entity_type }},={{ $json.operation }},={{ $json.rentprog_id }},={{ $json.company_id }},={{ $json.operation }},={{ JSON.stringify($json.payload) }},={{ JSON.stringify($json.metadata) }},={{ $json.event_hash }}"
        }
      },
      "id": "save-to-events",
      "name": "Save to Events",
      "type": "n8n-nodes-base.postgres",
      "typeVersion": 2.4,
      "position": [640, 400],
      "credentials": {
        "postgres": {
          "id": "3I9fyXVlGg4Vl4LZ",
          "name": "Postgres account"
        }
      }
    },
    {
      "parameters": {
        "mode": "runOnceForAllItems",
        "jsCode": "// Передаем данные из Parse Webhook дальше\nconst parsed = $('Parse Webhook').first().json;\nreturn { json: parsed };"
      },
      "id": "pass-data",
      "name": "Pass Data",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [840, 400]
    },
    {
      "parameters": {
        "rules": {
          "values": [
            {
              "conditions": {
                "options": {
                  "caseSensitive": true,
                  "leftValue": "",
                  "typeValidation": "strict"
                },
                "conditions": [
                  {
                    "leftValue": "={{ $json.operation }}",
                    "rightValue": "create",
                    "operator": {
                      "type": "string",
                      "operation": "equals"
                    }
                  }
                ],
                "combinator": "and"
              },
              "renameOutput": true,
              "outputKey": "create"
            },
            {
              "conditions": {
                "options": {
                  "caseSensitive": true,
                  "leftValue": "",
                  "typeValidation": "strict"
                },
                "conditions": [
                  {
                    "leftValue": "={{ $json.operation }}",
                    "rightValue": "update",
                    "operator": {
                      "type": "string",
                      "operation": "equals"
                    }
                  }
                ],
                "combinator": "and"
              },
              "renameOutput": true,
              "outputKey": "update"
            },
            {
              "conditions": {
                "options": {
                  "caseSensitive": true,
                  "leftValue": "",
                  "typeValidation": "strict"
                },
                "conditions": [
                  {
                    "leftValue": "={{ $json.operation }}",
                    "rightValue": "destroy",
                    "operator": {
                      "type": "string",
                      "operation": "equals"
                    }
                  }
                ],
                "combinator": "and"
              },
              "renameOutput": true,
              "outputKey": "destroy"
            }
          ]
        },
        "options": {}
      },
      "id": "switch-operation",
      "name": "Switch by Operation",
      "type": "n8n-nodes-base.switch",
      "typeVersion": 3,
      "position": [1040, 400]
    },
    {
      "parameters": {
        "mode": "runOnceForAllItems",
        "jsCode": "// Подготовка данных для INSERT\nconst entityType = $json.entity_type;\nconst payload = $json.payload;\nconst rentprogId = $json.rentprog_id;\n\n// Определяем таблицу\nconst tableMap = {\n  'car': 'cars',\n  'client': 'clients',\n  'booking': 'bookings'\n};\n\nconst tableName = tableMap[entityType];\n\nif (!tableName) {\n  throw new Error(`Unknown entity_type: ${entityType}`);\n}\n\nreturn {\n  json: {\n    table_name: tableName,\n    rentprog_id: rentprogId,\n    company_id: 11163,\n    data: payload,\n    payload_json: JSON.stringify(payload)\n  }\n};"
      },
      "id": "prepare-create",
      "name": "Prepare Create",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [1240, 200]
    },
    {
      "parameters": {
        "operation": "executeQuery",
        "query": "-- Создаём запись в external_refs\nINSERT INTO external_refs (\n  entity_type,\n  entity_id,\n  system,\n  external_id,\n  data\n)\nSELECT\n  $1,\n  gen_random_uuid(),\n  'rentprog',\n  $2,\n  $3::jsonb\nWHERE NOT EXISTS (\n  SELECT 1 FROM external_refs\n  WHERE system = 'rentprog' AND external_id = $2\n)\nRETURNING entity_id;",
        "options": {
          "queryReplacement": "={{ $json.table_name.slice(0, -1) }},={{ $json.rentprog_id }},={{ $json.payload_json }}"
        }
      },
      "id": "insert-entity",
      "name": "Insert Entity",
      "type": "n8n-nodes-base.postgres",
      "typeVersion": 2.4,
      "position": [1440, 200],
      "credentials": {
        "postgres": {
          "id": "3I9fyXVlGg4Vl4LZ",
          "name": "Postgres account"
        }
      }
    },
    {
      "parameters": {
        "operation": "executeQuery",
        "query": "-- Проверяем существование записи и всегда возвращаем результат\nSELECT \n  COALESCE(\n    (SELECT entity_id FROM external_refs WHERE system = 'rentprog' AND external_id = $1 LIMIT 1),\n    NULL\n  ) as entity_id,\n  EXISTS(SELECT 1 FROM external_refs WHERE system = 'rentprog' AND external_id = $1) as exists;",
        "options": {
          "queryReplacement": "={{ $json.rentprog_id }}"
        }
      },
      "id": "check-exists",
      "name": "Check Exists",
      "type": "n8n-nodes-base.postgres",
      "typeVersion": 2.4,
      "position": [1240, 400],
      "credentials": {
        "postgres": {
          "id": "3I9fyXVlGg4Vl4LZ",
          "name": "Postgres account"
        }
      }
    },
    {
      "parameters": {
        "conditions": {
          "options": {
            "caseSensitive": true,
            "leftValue": "",
            "typeValidation": "strict"
          },
          "conditions": [
            {
              "id": "exists-check",
              "leftValue": "={{ $json.exists }}",
              "rightValue": true,
              "operator": {
                "type": "boolean",
                "operation": "equals"
              }
            }
          ],
          "combinator": "and"
        },
        "options": {}
      },
      "id": "if-exists",
      "name": "If Exists",
      "type": "n8n-nodes-base.if",
      "typeVersion": 2,
      "position": [1440, 400]
    },
    {
      "parameters": {
        "mode": "runOnceForAllItems",
        "jsCode": "// Извлекаем последние значения из массивов [old, new]\nconst payload = $('Pass Data').first().json.payload;\nconst updates = {};\n\nfor (const [key, value] of Object.entries(payload)) {\n  if (Array.isArray(value) && value.length === 2) {\n    // Берём последнее значение\n    updates[key] = value[1];\n  } else if (key !== 'id') {\n    updates[key] = value;\n  }\n}\n\nconst entityId = $json.entity_id;\n\nreturn {\n  json: {\n    entity_id: entityId,\n    updates: updates,\n    updates_json: JSON.stringify(updates)\n  }\n};"
      },
      "id": "prepare-update",
      "name": "Prepare Update",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [1640, 300]
    },
    {
      "parameters": {
        "operation": "executeQuery",
        "query": "-- Обновляем данные в external_refs\nUPDATE external_refs\nSET\n  data = data || $1::jsonb,\n  updated_at = NOW()\nWHERE entity_id = $2\nRETURNING entity_id;",
        "options": {
          "queryReplacement": "={{ $json.updates_json }},={{ $json.entity_id }}"
        }
      },
      "id": "update-entity",
      "name": "Update Entity",
      "type": "n8n-nodes-base.postgres",
      "typeVersion": 2.4,
      "position": [1840, 300],
      "credentials": {
        "postgres": {
          "id": "3I9fyXVlGg4Vl4LZ",
          "name": "Postgres account"
        }
      }
    },
    {
      "parameters": {
        "mode": "runOnceForAllItems",
        "jsCode": "// Получаем токен для RentProg API\nconst companyToken = '5y4j4gcs75o9n5s1e2vrxx4a'; // service-center\nconst baseUrl = 'https://rentprog.net/api/v1/public';\n\ntry {\n  const tokenResponse = await this.helpers.httpRequest({\n    method: 'GET',\n    url: `${baseUrl}/get_token`,\n    qs: { company_token: companyToken },\n    json: true,\n    timeout: 10000\n  });\n  \n  const requestToken = tokenResponse?.token;\n  \n  if (!requestToken) {\n    throw new Error('Failed to get token');\n  }\n  \n  const data = $('Pass Data').first().json;\n  \n  return {\n    json: {\n      request_token: requestToken,\n      entity_type: data.entity_type,\n      rentprog_id: data.rentprog_id,\n      payload: data.payload\n    }\n  };\n} catch (error) {\n  throw new Error(`Token error: ${error.message}`);\n}"
      },
      "id": "get-token",
      "name": "Get RentProg Token",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [1640, 500]
    },
    {
      "parameters": {
        "rules": {
          "values": [
            {
              "conditions": {
                "options": {
                  "caseSensitive": true,
                  "leftValue": "",
                  "typeValidation": "strict"
                },
                "conditions": [
                  {
                    "leftValue": "={{ $json.entity_type }}",
                    "rightValue": "car",
                    "operator": {
                      "type": "string",
                      "operation": "equals"
                    }
                  }
                ],
                "combinator": "and"
              },
              "renameOutput": true,
              "outputKey": "car"
            },
            {
              "conditions": {
                "options": {
                  "caseSensitive": true,
                  "leftValue": "",
                  "typeValidation": "strict"
                },
                "conditions": [
                  {
                    "leftValue": "={{ $json.entity_type }}",
                    "rightValue": "client",
                    "operator": {
                      "type": "string",
                      "operation": "equals"
                    }
                  }
                ],
                "combinator": "and"
              },
              "renameOutput": true,
              "outputKey": "client"
            },
            {
              "conditions": {
                "options": {
                  "caseSensitive": true,
                  "leftValue": "",
                  "typeValidation": "strict"
                },
                "conditions": [
                  {
                    "leftValue": "={{ $json.entity_type }}",
                    "rightValue": "booking",
                    "operator": {
                      "type": "string",
                      "operation": "equals"
                    }
                  }
                ],
                "combinator": "and"
              },
              "renameOutput": true,
              "outputKey": "booking"
            }
          ]
        },
        "options": {}
      },
      "id": "switch-entity",
      "name": "Switch by Entity",
      "type": "n8n-nodes-base.switch",
      "typeVersion": 3,
      "position": [1840, 500]
    },
    {
      "parameters": {
        "url": "=https://rentprog.net/api/v1/public/search_cars",
        "authentication": "none",
        "sendQuery": true,
        "queryParameters": {
          "parameters": [
            {
              "name": "query",
              "value": "={{ $json.rentprog_id }}"
            }
          ]
        },
        "sendHeaders": true,
        "headerParameters": {
          "parameters": [
            {
              "name": "Authorization",
              "value": "=Bearer {{ $json.request_token }}"
            }
          ]
        },
        "options": {}
      },
      "id": "fetch-car",
      "name": "Fetch Car",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.2,
      "position": [2040, 400]
    },
    {
      "parameters": {
        "url": "=https://rentprog.net/api/v1/public/search_clients",
        "authentication": "none",
        "sendQuery": true,
        "queryParameters": {
          "parameters": [
            {
              "name": "query",
              "value": "={{ $json.rentprog_id }}"
            }
          ]
        },
        "sendHeaders": true,
        "headerParameters": {
          "parameters": [
            {
              "name": "Authorization",
              "value": "=Bearer {{ $json.request_token }}"
            }
          ]
        },
        "options": {}
      },
      "id": "fetch-client",
      "name": "Fetch Client",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.2,
      "position": [2040, 500]
    },
    {
      "parameters": {
        "url": "=https://rentprog.net/api/v1/public/search_bookings",
        "authentication": "none",
        "sendQuery": true,
        "queryParameters": {
          "parameters": [
            {
              "name": "query",
              "value": "={{ $json.rentprog_id }}"
            }
          ]
        },
        "sendHeaders": true,
        "headerParameters": {
          "parameters": [
            {
              "name": "Authorization",
              "value": "=Bearer {{ $json.request_token }}"
            }
          ]
        },
        "options": {}
      },
      "id": "fetch-booking",
      "name": "Fetch Booking",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.2,
      "position": [2040, 600]
    },
    {
      "parameters": {
        "mode": "runOnceForAllItems",
        "jsCode": "// Извлекаем первый результат из поиска\nconst results = Array.isArray($json) ? $json : [$json];\nconst found = results.find(item => item.id == $('Get RentProg Token').first().json.rentprog_id);\n\nif (!found) {\n  throw new Error('Entity not found in RentProg');\n}\n\nconst data = $('Get RentProg Token').first().json;\n\nreturn {\n  json: {\n    entity_type: data.entity_type,\n    rentprog_id: data.rentprog_id,\n    data: found,\n    data_json: JSON.stringify(found)\n  }\n};"
      },
      "id": "extract-result",
      "name": "Extract Result",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [2240, 500]
    },
    {
      "parameters": {
        "operation": "executeQuery",
        "query": "-- Создаём запись в external_refs из RentProg данных\nINSERT INTO external_refs (\n  entity_type,\n  entity_id,\n  system,\n  external_id,\n  data\n)\nSELECT\n  $1,\n  gen_random_uuid(),\n  'rentprog',\n  $2,\n  $3::jsonb\nWHERE NOT EXISTS (\n  SELECT 1 FROM external_refs\n  WHERE system = 'rentprog' AND external_id = $2\n)\nRETURNING entity_id;",
        "options": {
          "queryReplacement": "={{ $json.entity_type }},={{ $json.rentprog_id }},={{ $json.data_json }}"
        }
      },
      "id": "insert-fetched",
      "name": "Insert Fetched Entity",
      "type": "n8n-nodes-base.postgres",
      "typeVersion": 2.4,
      "position": [2440, 500],
      "credentials": {
        "postgres": {
          "id": "3I9fyXVlGg4Vl4LZ",
          "name": "Postgres account"
        }
      }
    },
    {
      "parameters": {
        "operation": "executeQuery",
        "query": "-- Помечаем запись как удалённую\nUPDATE external_refs\nSET\n  data = jsonb_set(\n    COALESCE(data, '{}'::jsonb),\n    '{_deleted}',\n    'true'::jsonb\n  ),\n  updated_at = NOW()\nWHERE system = 'rentprog'\n  AND external_id = $1\nRETURNING entity_id;",
        "options": {
          "queryReplacement": "={{ $json.rentprog_id }}"
        }
      },
      "id": "mark-deleted",
      "name": "Mark as Deleted",
      "type": "n8n-nodes-base.postgres",
      "typeVersion": 2.4,
      "position": [1240, 600],
      "credentials": {
        "postgres": {
          "id": "3I9fyXVlGg4Vl4LZ",
          "name": "Postgres account"
        }
      }
    },
    {
      "parameters": {
        "respondWith": "json",
        "responseBody": "={{ { ok: true, operation: $json.operation || 'completed', entity_id: $json.entity_id || null } }}",
        "options": {}
      },
      "id": "respond-success",
      "name": "Respond Success",
      "type": "n8n-nodes-base.respondToWebhook",
      "typeVersion": 1.1,
      "position": [2640, 400]
    }
  ],
  "connections": {
    "Webhook (Service Center)": {
      "main": [
        [
          {
            "node": "Parse Webhook",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Parse Webhook": {
      "main": [
        [
          {
            "node": "Save to Events",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Save to Events": {
      "main": [
        [
          {
            "node": "Pass Data",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Pass Data": {
      "main": [
        [
          {
            "node": "Switch by Operation",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Switch by Operation": {
      "main": [
        [
          {
            "node": "Prepare Create",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "Check Exists",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "Mark as Deleted",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Prepare Create": {
      "main": [
        [
          {
            "node": "Insert Entity",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Insert Entity": {
      "main": [
        [
          {
            "node": "Respond Success",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Check Exists": {
      "main": [
        [
          {
            "node": "If Exists",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "If Exists": {
      "main": [
        [
          {
            "node": "Prepare Update",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "Get RentProg Token",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Prepare Update": {
      "main": [
        [
          {
            "node": "Update Entity",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Update Entity": {
      "main": [
        [
          {
            "node": "Respond Success",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Get RentProg Token": {
      "main": [
        [
          {
            "node": "Switch by Entity",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Switch by Entity": {
      "main": [
        [
          {
            "node": "Fetch Car",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "Fetch Client",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "Fetch Booking",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Fetch Car": {
      "main": [
        [
          {
            "node": "Extract Result",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Fetch Client": {
      "main": [
        [
          {
            "node": "Extract Result",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Fetch Booking": {
      "main": [
        [
          {
            "node": "Extract Result",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Extract Result": {
      "main": [
        [
          {
            "node": "Insert Fetched Entity",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Insert Fetched Entity": {
      "main": [
        [
          {
            "node": "Respond Success",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Mark as Deleted": {
      "main": [
        [
          {
            "node": "Respond Success",
            "type": "main",
            "index": 0
          }
        ]
      ]
    }
  },
  "settings": {
    "executionOrder": "v1",
    "saveDataSuccessExecution": "all",
    "saveDataErrorExecution": "all",
    "saveManualExecutions": true
  }
};

console.log('\n🔄 Восстановление полной структуры workflow (20 нод)...\n');

const data = JSON.stringify(fullWorkflow);

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
  
  res.on('data', (chunk) => {
    responseData += chunk;
  });
  
  res.on('end', () => {
    console.log(`📊 Status: ${res.statusCode}\n`);
    
    if (res.statusCode === 200) {
      console.log('✅ Workflow восстановлен!');
      console.log('📍 URL: https://n8n.rentflow.rentals/workflow/PbDKuU06H7s2Oem8\n');
      console.log('🔍 Проверьте:');
      console.log('   - 20 нод должны быть видны');
      console.log('   - Все connections восстановлены');
      console.log('   - Settings сохранены (saveDataSuccessExecution: all)\n');
    } else {
      console.log('❌ Ошибка:', responseData);
    }
  });
});

req.on('error', (err) => {
  console.error('❌ Ошибка запроса:', err.message);
});

req.write(data);
req.end();
