#!/usr/bin/env node
/**
 * Импорт Starline API workflow через MCP n8n (используя n8n API)
 * Следует правилам импорта workflow 2025
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const N8N_HOST = process.env.N8N_HOST || 'https://n8n.rentflow.rentals/api/v1';
const N8N_API_KEY = process.env.N8N_API_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI';

/**
 * Очистка workflow от системных полей (2025 стандарт)
 */
function cleanWorkflow(workflow) {
  const cleaned = { ...workflow };
  
  // Удаляем системные поля workflow уровня
  delete cleaned.id;
  delete cleaned.versionId;
  delete cleaned.updatedAt;
  delete cleaned.createdAt;
  delete cleaned.triggerCount;
  delete cleaned.meta;
  delete cleaned.staticData;
  delete cleaned.pinData;
  delete cleaned.tags;
  delete cleaned.ownerId;
  delete cleaned.sharedWithProjects;
  delete cleaned.isArchived;
  
  // Очищаем ноды
  if (cleaned.nodes) {
    cleaned.nodes = cleaned.nodes.map(node => {
      const cleanNode = { ...node };
      
      // Удаляем системные поля ноды
      delete cleanNode.id;
      delete cleanNode.notes;
      delete cleanNode.notesInFlow;
      delete cleanNode.disabled;
      delete cleanNode.continueOnFail;
      delete cleanNode.alwaysOutputData;
      delete cleanNode.executeOnce;
      delete cleanNode.maxTries;
      delete cleanNode.waitBetweenTries;
      delete cleanNode.retryOnFail;
      
      // webhookId оставляем только для webhook нод
      if (cleanNode.type !== 'n8n-nodes-base.webhook') {
        delete cleanNode.webhookId;
      }
      
      // Очищаем credentials - оставляем только name или id
      if (cleanNode.credentials) {
        Object.keys(cleanNode.credentials).forEach(credType => {
          const cred = cleanNode.credentials[credType];
          if (cred && !cred.name && !cred.id) {
            delete cleanNode.credentials[credType];
          } else if (cred && cred.id && !cred.name) {
            // Оставляем как есть, если есть id
          }
        });
      }
      
      // Очищаем пустые options
      if (cleanNode.parameters?.options) {
        const options = cleanNode.parameters.options;
        // Удаляем вложенные пустые объекты
        if (options.response?.response?.responseFormat) {
          delete options.response.response.responseFormat;
        }
        if (options.response?.response && Object.keys(options.response.response).length === 0) {
          delete options.response.response;
        }
        if (options.response && Object.keys(options.response).length === 0) {
          delete options.response;
        }
      }
      
      return cleanNode;
    });
  }
  
  // Убеждаемся что settings есть
  if (!cleaned.settings) {
    cleaned.settings = {};
  }
  if (!cleaned.settings.executionOrder) {
    cleaned.settings.executionOrder = 'v1';
  }
  
  // Удаляем errorWorkflow из settings (больше не используется)
  if (cleaned.settings.errorWorkflow) {
    delete cleaned.settings.errorWorkflow;
  }
  
  return cleaned;
}

async function importWorkflow() {
  console.log('📥 Импортирую Starline API workflow через MCP n8n...\n');

  try {
    // Читаем workflow файл
    const workflowPath = join(__dirname, '..', 'n8n-workflows', 'starline-api-sync.json');
    const workflowContent = readFileSync(workflowPath, 'utf8');
    const workflowJson = JSON.parse(workflowContent);

    // Меняем название
    workflowJson.name = 'API Starline parser 1 min';

    // Очищаем workflow
    const cleanedWorkflow = cleanWorkflow(workflowJson);

    console.log(`📄 Workflow: ${cleanedWorkflow.name}`);
    console.log(`   Нод: ${cleanedWorkflow.nodes?.length || 0}`);
    console.log(`   Execution Order: ${cleanedWorkflow.settings.executionOrder}\n`);

    // Проверяем существующие workflow
    console.log('🔍 Проверяю существующие workflow...');
    const listResponse = await fetch(`${N8N_HOST}/workflows`, {
      headers: {
        'X-N8N-API-KEY': N8N_API_KEY
      }
    });

    if (!listResponse.ok) {
      throw new Error(`Ошибка получения списка workflows: ${listResponse.statusText}`);
    }

    const listData = await listResponse.json();
    // Пробуем разные варианты структуры ответа
    const existingWorkflows = listData.data?.data || listData.data || listData || [];
    
    // ВСЕГДА используем фиксированный ID 34DYNGsToUYrCvDj
    const TARGET_WORKFLOW_ID = '34DYNGsToUYrCvDj';
    const existingWorkflow = existingWorkflows.find(wf => wf && wf.id === TARGET_WORKFLOW_ID);

    if (existingWorkflow) {
      console.log(`📌 Найден целевой workflow (ID: ${TARGET_WORKFLOW_ID})`);
      console.log('   Обновляю существующий workflow...\n');

      // Получаем текущий workflow для сохранения credentials
      const getResponse = await fetch(`${N8N_HOST}/workflows/${TARGET_WORKFLOW_ID}`, {
        headers: {
          'X-N8N-API-KEY': N8N_API_KEY
        }
      });

      if (!getResponse.ok) {
        throw new Error(`Ошибка получения workflow: ${getResponse.statusText}`);
      }

      const currentWorkflow = await getResponse.json();
      const currentData = currentWorkflow.data || currentWorkflow;

      // Восстанавливаем credentials из существующего workflow
      if (currentData.nodes) {
        cleanedWorkflow.nodes = cleanedWorkflow.nodes.map(newNode => {
          const currentNode = currentData.nodes.find(n => n.name === newNode.name && n.type === newNode.type);
          if (currentNode && currentNode.credentials) {
            newNode.credentials = currentNode.credentials;
          }
          return newNode;
        });
      }

      // Обновляем workflow
      const updateResponse = await fetch(`${N8N_HOST}/workflows/${TARGET_WORKFLOW_ID}`, {
        method: 'PUT',
        headers: {
          'X-N8N-API-KEY': N8N_API_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: cleanedWorkflow.name,
          nodes: cleanedWorkflow.nodes,
          connections: cleanedWorkflow.connections,
          settings: cleanedWorkflow.settings
        })
      });

      if (!updateResponse.ok) {
        const errorText = await updateResponse.text();
        throw new Error(`Ошибка обновления workflow: ${updateResponse.status} - ${errorText}`);
      }

      const updateResult = await updateResponse.json();
      const workflowId = TARGET_WORKFLOW_ID;

      console.log(`✅ Workflow обновлен успешно!`);
      console.log(`   ID: ${workflowId}`);
      console.log(`   URL: https://n8n.rentflow.rentals/workflow/${workflowId}\n`);

      return workflowId;

    } else {
      // Workflow не найден - это не должно происходить, но на всякий случай создаем
      console.log('⚠️  Целевой workflow не найден!');
      console.log('   Создаю новый workflow с фиксированным ID...\n');
      console.log('   ⚠️  ВНИМАНИЕ: Это не должно происходить! Проверьте ID workflow.\n');

      const createResponse = await fetch(`${N8N_HOST}/workflows`, {
        method: 'POST',
        headers: {
          'X-N8N-API-KEY': N8N_API_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(cleanedWorkflow)
      });

      if (!createResponse.ok) {
        const errorText = await createResponse.text();
        throw new Error(`Ошибка создания workflow: ${createResponse.status} - ${errorText}`);
      }

      const createResult = await createResponse.json();
      const workflowId = createResult.data?.id || createResult.id || createResult.data?.data?.id;

      if (!workflowId) {
        console.error('⚠️  Структура ответа:', JSON.stringify(createResult, null, 2));
        throw new Error('Не удалось получить ID созданного workflow');
      }

      console.log(`✅ Workflow создан успешно!`);
      console.log(`   ID: ${workflowId}`);
      console.log(`   URL: https://n8n.rentflow.rentals/workflow/${workflowId}\n`);
      console.log(`   ⚠️  ВНИМАНИЕ: Создан новый workflow, но должен использоваться ${TARGET_WORKFLOW_ID}\n`);

      return workflowId;
    }

  } catch (error) {
    console.error('❌ Ошибка при импорте workflow:');
    console.error(error.message);
    if (error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }
    process.exit(1);
  }
}

importWorkflow();

