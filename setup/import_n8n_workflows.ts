/**
 * Скрипт для импорта workflow в n8n через API
 */

import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const N8N_HOST = process.env.N8N_HOST || 'http://46.224.17.15:5678/api/v1';
const N8N_API_KEY = process.env.N8N_API_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYxOTUzNjIzLCJleHAiOjE3NjQ0Nzg4MDB9.RJQy3rXOo0_x_S41IFEGFfAhlVvPaB5dNBYKheP_csM';

const WORKFLOWS_DIR = path.join(__dirname, '..', 'n8n-workflows');
const WORKFLOW_FILES = [
  'rentprog-webhooks-monitor.json',
  'sync-progress.json',
  'health-status.json',
];

async function importWorkflow(fileName: string) {
  const filePath = path.join(WORKFLOWS_DIR, fileName);
  const workflowData = JSON.parse(fs.readFileSync(filePath, 'utf8'));

  try {
    console.log(`📥 Импортирую ${workflowData.name}...`);
    
    // Проверяем, существует ли workflow с таким именем
    const existing = await axios.get(`${N8N_HOST}/workflows`, {
      headers: {
        'X-N8N-API-KEY': N8N_API_KEY,
      },
    });

    const existingWorkflow = existing.data.data?.find((w: any) => w.name === workflowData.name);
    
    if (existingWorkflow) {
      console.log(`   ⚠️  Workflow "${workflowData.name}" уже существует (ID: ${existingWorkflow.id})`);
      console.log(`   🔄 Обновляю...`);
      
      // Обновляем существующий workflow
      await axios.put(
        `${N8N_HOST}/workflows/${existingWorkflow.id}`,
        {
          ...workflowData,
          id: existingWorkflow.id,
        },
        {
          headers: {
            'X-N8N-API-KEY': N8N_API_KEY,
            'Content-Type': 'application/json',
          },
        }
      );
      
      console.log(`   ✅ Workflow обновлен`);
      return existingWorkflow.id;
    } else {
      // Создаем новый workflow
      const response = await axios.post(
        `${N8N_HOST}/workflows`,
        workflowData,
        {
          headers: {
            'X-N8N-API-KEY': N8N_API_KEY,
            'Content-Type': 'application/json',
          },
        }
      );
      
      console.log(`   ✅ Workflow создан (ID: ${response.data.data.id})`);
      return response.data.data.id;
    }
  } catch (error: any) {
    if (error.response) {
      console.error(`   ❌ Ошибка API: ${error.response.status} ${error.response.statusText}`);
      console.error(`   Ответ:`, JSON.stringify(error.response.data, null, 2));
    } else {
      console.error(`   ❌ Ошибка: ${error.message}`);
    }
    throw error;
  }
}

async function main() {
  console.log('🚀 Импорт workflow в n8n\n');
  console.log(`📍 N8N Host: ${N8N_HOST}\n`);

  const results: Array<{ name: string; id?: string; error?: string }> = [];

  for (const fileName of WORKFLOW_FILES) {
    try {
      const workflowId = await importWorkflow(fileName);
      results.push({ name: fileName, id: workflowId });
    } catch (error: any) {
      results.push({ name: fileName, error: error.message });
    }
    console.log('');
  }

  console.log('📊 Результаты импорта:');
  results.forEach(result => {
    if (result.id) {
      console.log(`   ✅ ${result.name}: ID ${result.id}`);
    } else {
      console.log(`   ❌ ${result.name}: ${result.error}`);
    }
  });
}

main().catch(console.error);

