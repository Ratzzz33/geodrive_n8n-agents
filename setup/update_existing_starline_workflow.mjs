#!/usr/bin/env node
/**
 * Обновление существующего Starline API workflow
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const N8N_HOST = process.env.N8N_HOST || 'https://n8n.rentflow.rentals/api/v1';
const N8N_API_KEY = process.env.N8N_API_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI';
const WORKFLOW_ID = process.argv[2] || 'NAn9IcFpFuUFib4W';

function cleanWorkflow(workflow) {
  const cleaned = { ...workflow };
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
  
  if (cleaned.nodes) {
    cleaned.nodes = cleaned.nodes.map(node => {
      const cleanNode = { ...node };
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
      
      if (cleanNode.type !== 'n8n-nodes-base.webhook') {
        delete cleanNode.webhookId;
      }
      
      if (cleanNode.credentials) {
        Object.keys(cleanNode.credentials).forEach(credType => {
          const cred = cleanNode.credentials[credType];
          if (cred && !cred.name && !cred.id) {
            delete cleanNode.credentials[credType];
          }
        });
      }
      
      return cleanNode;
    });
  }
  
  if (!cleaned.settings) {
    cleaned.settings = {};
  }
  if (!cleaned.settings.executionOrder) {
    cleaned.settings.executionOrder = 'v1';
  }
  
  if (cleaned.settings.errorWorkflow) {
    delete cleaned.settings.errorWorkflow;
  }
  
  return cleaned;
}

async function updateWorkflow() {
  console.log(`🔄 Обновляю workflow ${WORKFLOW_ID}...\n`);

  try {
    // Читаем workflow файл
    const workflowPath = join(__dirname, '..', 'n8n-workflows', 'starline-api-sync.json');
    const workflowContent = readFileSync(workflowPath, 'utf8');
    const workflowJson = JSON.parse(workflowContent);

    // Очищаем workflow
    const cleanedWorkflow = cleanWorkflow(workflowJson);

    // Получаем текущий workflow для сохранения credentials
    const getResponse = await fetch(`${N8N_HOST}/workflows/${WORKFLOW_ID}`, {
      headers: {
        'X-N8N-API-KEY': N8N_API_KEY
      }
    });

    if (!getResponse.ok) {
      throw new Error(`Ошибка получения workflow: ${getResponse.statusText}`);
    }

    const currentWorkflow = await getResponse.json();
    const currentData = currentWorkflow.data || currentWorkflow;

    console.log(`📄 Текущий workflow: ${currentData.name}`);
    console.log(`   Нод: ${currentData.nodes?.length || 0}\n`);

    // Восстанавливаем credentials из существующего workflow
    if (currentData.nodes) {
      cleanedWorkflow.nodes = cleanedWorkflow.nodes.map(newNode => {
        const currentNode = currentData.nodes.find(n => 
          n.name === newNode.name && n.type === newNode.type
        );
        if (currentNode && currentNode.credentials) {
          newNode.credentials = currentNode.credentials;
        }
        return newNode;
      });
    }

    console.log(`⚙️  Обновляю workflow...\n`);

    // Обновляем workflow
    const updateResponse = await fetch(`${N8N_HOST}/workflows/${WORKFLOW_ID}`, {
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

    console.log(`✅ Workflow обновлен успешно!`);
    console.log(`   Название: ${cleanedWorkflow.name}`);
    console.log(`   Нод: ${cleanedWorkflow.nodes?.length || 0}`);
    console.log(`   URL: https://n8n.rentflow.rentals/workflow/${WORKFLOW_ID}\n`);

  } catch (error) {
    console.error('❌ Ошибка при обновлении workflow:');
    console.error(error.message);
    if (error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }
    process.exit(1);
  }
}

updateWorkflow();

