#!/usr/bin/env node
/**
 * Импорт workflow в n8n с учетом изменений API 2025 года
 * 
 * Изменения 2025:
 * - Обязательные поля: name, nodes, connections, settings
 * - НЕ передавать: id, versionId, updatedAt, createdAt, triggerCount, meta, staticData, pinData, tags
 * - webhookId должен быть уникальным или генерироваться автоматически
 * - credentials должны быть привязаны после создания workflow
 */

import https from 'https';
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
  // Удаляем все системные поля
  const cleaned = { ...workflow };
  
  // Системные поля workflow уровня
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
  
  // Очищаем ноды от системных полей
  if (cleaned.nodes) {
    cleaned.nodes = cleaned.nodes.map(node => {
      const cleanNode = { ...node };
      
      // Удаляем системные поля ноды
      delete cleanNode.id; // ID будет сгенерирован автоматически
      // webhookId оставляем только если это webhook нода и он уникален
      // Иначе n8n сгенерирует его автоматически
      if (cleanNode.type === 'n8n-nodes-base.webhook' && cleanNode.webhookId) {
        // Оставляем webhookId для webhook нод - n8n проверит уникальность
      } else {
        delete cleanNode.webhookId;
      }
      delete cleanNode.notesInFlow;
      delete cleanNode.notes;
      delete cleanNode.disabled;
      delete cleanNode.continueOnFail;
      delete cleanNode.alwaysOutputData;
      delete cleanNode.executeOnce;
      delete cleanNode.maxTries;
      delete cleanNode.waitBetweenTries;
      delete cleanNode.retryOnFail;
      
      // Credentials - в 2025 году n8n требует либо id, либо name
      // Если есть id, оставляем как есть
      // Если только name, оставляем name (n8n найдет по имени)
      // Если нет ни того ни другого, удаляем
      if (cleanNode.credentials) {
        const cleanedCreds = {};
        for (const [key, cred] of Object.entries(cleanNode.credentials)) {
          if (cred.id) {
            // Оставляем id если есть
            cleanedCreds[key] = { id: cred.id };
          } else if (cred.name) {
            // Оставляем name для поиска по имени
            cleanedCreds[key] = { name: cred.name };
          }
          // Если нет ни id ни name - пропускаем
        }
        if (Object.keys(cleanedCreds).length > 0) {
          cleanNode.credentials = cleanedCreds;
        } else {
          delete cleanNode.credentials;
        }
      }
      
      // Очищаем пустые или неправильные options в parameters
      if (cleanNode.parameters && cleanNode.parameters.options) {
        // Удаляем пустые вложенные объекты в options
        const cleanOptions = (obj) => {
          if (typeof obj !== 'object' || obj === null) return obj;
          if (Array.isArray(obj)) return obj.map(cleanOptions);
          
          const cleaned = {};
          for (const [key, value] of Object.entries(obj)) {
            if (value === null || value === undefined) continue;
            if (typeof value === 'object' && Object.keys(value).length === 0) continue;
            cleaned[key] = cleanOptions(value);
          }
          return Object.keys(cleaned).length > 0 ? cleaned : undefined;
        };
        
        const cleanedOptions = cleanOptions(cleanNode.parameters.options);
        if (cleanedOptions && Object.keys(cleanedOptions).length > 0) {
          cleanNode.parameters.options = cleanedOptions;
        } else {
          delete cleanNode.parameters.options;
        }
      }
      
      // ⚠️ ИСПРАВЛЕНИЕ: Schedule Trigger - конвертируем hours в cronExpression
      if (cleanNode.type === 'n8n-nodes-base.scheduleTrigger' && cleanNode.parameters?.rule?.interval) {
        const interval = cleanNode.parameters.rule.interval;
        if (Array.isArray(interval) && interval.length > 0) {
          const firstInterval = interval[0];
          // Если используется hours с hoursInterval и hours.start/end - конвертируем в cronExpression
          if (firstInterval.field === 'hours' && firstInterval.hoursInterval && cleanNode.parameters.rule.hours) {
            const start = cleanNode.parameters.rule.hours.start || 0;
            const end = cleanNode.parameters.rule.hours.end || 23;
            // Конвертируем в cron: каждый час с start до end
            cleanNode.parameters.rule.interval = [{
              field: 'cronExpression',
              expression: `0 ${start}-${end} * * *`
            }];
            // Удаляем старую структуру hours
            delete cleanNode.parameters.rule.hours;
            console.log(`  ⚠️  Schedule Trigger: конвертирован hours (${start}-${end}) в cronExpression`);
          }
        }
      }
      
      // ⚠️ ИСПРАВЛЕНИЕ: HTTP Request - удаляем вложенный response.response.responseFormat
      if (cleanNode.type === 'n8n-nodes-base.httpRequest' && cleanNode.parameters?.options) {
        const options = cleanNode.parameters.options;
        // Проверяем наличие вложенной структуры response.response.responseFormat
        if (options.response?.response?.responseFormat) {
          // Удаляем вложенную структуру
          delete options.response.response;
          // Если response стал пустым - удаляем его
          if (Object.keys(options.response).length === 0) {
            delete options.response;
          }
          console.log(`  ⚠️  HTTP Request: удален вложенный response.response.responseFormat`);
        }
      }
      
      // ⚠️ ИСПРАВЛЕНИЕ: IF нода - добавляем id к условиям если его нет
      if (cleanNode.type === 'n8n-nodes-base.if' && cleanNode.typeVersion >= 2) {
        const conditions = cleanNode.parameters?.conditions?.conditions;
        if (Array.isArray(conditions)) {
          let hasChanges = false;
          conditions.forEach((condition, index) => {
            if (!condition.id) {
              // Генерируем уникальный id на основе leftValue или индекса
              const idBase = condition.leftValue 
                ? condition.leftValue.replace(/[^a-zA-Z0-9]/g, '').substring(0, 20) || 'condition'
                : `condition-${index}`;
              condition.id = `${idBase}-${index}`;
              hasChanges = true;
            }
          });
          if (hasChanges) {
            console.log(`  ⚠️  IF нода: добавлены id к условиям`);
          }
        }
      }
      
      return cleanNode;
    });
  }
  
  // Обеспечиваем обязательные поля
  if (!cleaned.settings) {
    cleaned.settings = { executionOrder: 'v1' };
  } else if (!cleaned.settings.executionOrder) {
    cleaned.settings.executionOrder = 'v1';
  }
  
  // ⚠️ КРИТИЧНО: Удаляем errorWorkflow из settings (больше не используем)
  // errorWorkflow вызывал ошибки "Could not find workflow" при открытии
  if (cleaned.settings.errorWorkflow) {
    delete cleaned.settings.errorWorkflow;
  }
  
  // Минимальная структура для API
  return {
    name: cleaned.name,
    nodes: cleaned.nodes || [],
    connections: cleaned.connections || {},
    settings: cleaned.settings
  };
}

/**
 * HTTP запрос к n8n API
 */
function n8nRequest(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${N8N_HOST}${path}`);
    const options = {
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname + url.search,
      method,
      headers: {
        'X-N8N-API-KEY': N8N_API_KEY,
        'Content-Type': 'application/json'
      },
      rejectUnauthorized: false
    };
    
    if (data) {
      const body = JSON.stringify(data);
      options.headers['Content-Length'] = Buffer.byteLength(body);
    }
    
    const req = https.request(options, (res) => {
      let responseData = '';
      res.on('data', chunk => responseData += chunk);
      res.on('end', () => {
        try {
          const result = res.statusCode >= 200 && res.statusCode < 300
            ? JSON.parse(responseData)
            : { error: responseData, statusCode: res.statusCode };
          resolve({ statusCode: res.statusCode, data: result });
        } catch (e) {
          resolve({ statusCode: res.statusCode, data: responseData, error: e.message });
        }
      });
    });
    
    req.on('error', reject);
    
    if (data) {
      req.write(JSON.stringify(data));
    }
    
    req.end();
  });
}

/**
 * Импорт workflow
 */
async function importWorkflow(filePath) {
  console.log(`\n📥 Импорт workflow: ${filePath}`);
  
  // Читаем файл
  const workflowContent = readFileSync(filePath, 'utf8');
  const workflow = JSON.parse(workflowContent);
  
  console.log(`   Название: ${workflow.name}`);
  console.log(`   Нод: ${workflow.nodes?.length || 0}`);
  
  // Очищаем workflow
  const cleanData = cleanWorkflow(workflow);
  
  // Проверяем существование
  const existingResponse = await n8nRequest('GET', '/workflows');
  if (existingResponse.statusCode !== 200) {
    throw new Error(`Ошибка получения списка workflow: ${existingResponse.statusCode}`);
  }
  
  const existingWorkflow = existingResponse.data.data?.find(w => w.name === workflow.name);
  
  if (existingWorkflow) {
    console.log(`   ⚠️  Workflow уже существует (ID: ${existingWorkflow.id}), обновляю...`);
    
    // Получаем текущий workflow для сохранения credentials
    const currentResponse = await n8nRequest('GET', `/workflows/${existingWorkflow.id}`);
    if (currentResponse.statusCode === 200 && currentResponse.data.data) {
      const currentNodes = currentResponse.data.data.nodes || [];
      
      // Восстанавливаем credentials из существующих нод
      cleanData.nodes = cleanData.nodes.map(node => {
        const existingNode = currentNodes.find(n => n.name === node.name && n.type === node.type);
        if (existingNode && existingNode.credentials) {
          node.credentials = existingNode.credentials;
        }
        return node;
      });
      
      // ⚠️ Удаляем errorWorkflow из settings существующего workflow (если есть)
      if (currentResponse.data.data.settings?.errorWorkflow) {
        delete cleanData.settings.errorWorkflow;
      }
    }
    
    // Обновляем
    const updateResponse = await n8nRequest('PUT', `/workflows/${existingWorkflow.id}`, cleanData);
    
    if (updateResponse.statusCode >= 200 && updateResponse.statusCode < 300) {
      console.log(`   ✅ Workflow обновлен`);
      return { id: existingWorkflow.id, action: 'updated' };
    } else {
      throw new Error(`Ошибка обновления: ${updateResponse.statusCode}\n${JSON.stringify(updateResponse.data, null, 2)}`);
    }
  } else {
    // Создаем новый
    console.log(`   ➕ Создаю новый workflow...`);
    
    const createResponse = await n8nRequest('POST', '/workflows', cleanData);
    
    if (createResponse.statusCode >= 200 && createResponse.statusCode < 300) {
      const workflowId = createResponse.data.data?.id || createResponse.data.id;
      console.log(`   ✅ Workflow создан (ID: ${workflowId})`);
      console.log(`   🔗 URL: https://n8n.rentflow.rentals/workflow/${workflowId}`);
      return { id: workflowId, action: 'created' };
    } else {
      throw new Error(`Ошибка создания: ${createResponse.statusCode}\n${JSON.stringify(createResponse.data, null, 2)}`);
    }
  }
}

// Main
const workflowFile = process.argv[2] || join(__dirname, '..', 'n8n-workflows', 'rentprog-upsert-processor.json');

importWorkflow(workflowFile)
  .then(result => {
    console.log(`\n✅ Импорт завершен: ${result.action}`);
    process.exit(0);
  })
  .catch(error => {
    console.error(`\n❌ Ошибка импорта:`, error.message);
    process.exit(1);
  });

