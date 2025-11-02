/**
 * Импорт нового workflow "RentProg Upsert Processor" в n8n через API
 */

import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const N8N_HOST = process.env.N8N_HOST || 'http://46.224.17.15:5678/api/v1';
const N8N_API_KEY = process.env.N8N_API_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYxOTUzNjIzLCJleHAiOjE3NjQ0Nzg4MDB9.RJQy3rXOo0_x_S41IFEGFfAhlVvPaB5dNBYKheP_csM';

const headers = {
  'X-N8N-API-KEY': N8N_API_KEY,
  'Content-Type': 'application/json',
};

async function importUpsertWorkflow() {
  try {
    const filePath = path.join(__dirname, '..', 'n8n-workflows', 'rentprog-upsert-processor.json');
    const workflowData = JSON.parse(fs.readFileSync(filePath, 'utf8'));

    console.log(`📥 Импортирую ${workflowData.name}...`);

    // Проверяем существующие workflow
    const existing = await axios.get(`${N8N_HOST}/workflows`, { headers });
    const existingWorkflow = existing.data.data?.find((w) => w.name === workflowData.name);

    let workflowId;

    if (existingWorkflow) {
      console.log(`   ⚠️  Workflow уже существует (ID: ${existingWorkflow.id}), обновляю...`);
      
      // Получаем существующий workflow для сохранения credentials
      const existingData = await axios.get(`${N8N_HOST}/workflows/${existingWorkflow.id}`, { headers });
      const existingNodes = existingData.data.data?.nodes || [];
      
      // Сохраняем credentials из существующих нод
      const updatedNodes = workflowData.nodes.map((node) => {
        const existingNode = existingNodes.find((n) => n.name === node.name);
        if (existingNode && existingNode.credentials) {
          node.credentials = existingNode.credentials;
        }
        return node;
      });

      const updatedWorkflow = {
        ...workflowData,
        id: existingWorkflow.id,
        nodes: updatedNodes,
        active: existingWorkflow.active || false,
      };

      await axios.put(`${N8N_HOST}/workflows/${existingWorkflow.id}`, updatedWorkflow, { headers });
      workflowId = existingWorkflow.id;
      console.log(`   ✅ Workflow обновлен`);
    } else {
      // Создаем новый workflow
      const response = await axios.post(`${N8N_HOST}/workflows`, workflowData, { headers });
      workflowId = response.data.data.id;
      console.log(`   ✅ Workflow создан (ID: ${workflowId})`);
    }

    // Активируем workflow
    console.log(`   🔄 Активирую workflow...`);
    await axios.post(`${N8N_HOST}/workflows/${workflowId}/activate`, {}, { headers });
    console.log(`   ✅ Workflow активирован`);

    return workflowId;
  } catch (error) {
    console.error(`   ❌ Ошибка импорта workflow:`, error.response?.data || error.message);
    throw error;
  }
}

async function main() {
  console.log('🚀 Импорт RentProg Upsert Processor workflow\n');
  console.log(`📍 N8N Host: ${N8N_HOST}\n`);

  try {
    await importUpsertWorkflow();
    console.log('\n✅ Импорт завершен!');
  } catch (error) {
    console.error('\n❌ Ошибка выполнения:', error.message);
    if (error.response) {
      console.error('   Ответ API:', JSON.stringify(error.response.data, null, 2));
    }
    process.exit(1);
  }
}

main().catch(console.error);

