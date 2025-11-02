/**
 * Импорт только нового workflow: RentProg Upsert Processor
 */

import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const N8N_HOST = 'http://46.224.17.15:5678/api/v1';
const N8N_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYxOTUzNjIzLCJleHAiOjE3NjQ0Nzg4MDB9.RJQy3rXOo0_x_S41IFEGFfAhlVvPaB5dNBYKheP_csM';

async function importNewWorkflow() {
  console.log('🚀 Импорт нового workflow: RentProg Upsert Processor\n');
  console.log(`📍 N8N Host: ${N8N_HOST}\n`);

  const fileName = 'rentprog-upsert-processor.json';
  const filePath = path.join(__dirname, '..', 'n8n-workflows', fileName);
  
  try {
    const workflowData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    
    console.log(`📥 Импортирую ${workflowData.name}...`);
    
    const headers = {
      'X-N8N-API-KEY': N8N_API_KEY,
      'Content-Type': 'application/json',
    };

    // Проверяем существование
    const existing = await axios.get(`${N8N_HOST}/workflows`, { 
      headers,
      timeout: 10000
    });
    
    const existingWorkflow = existing.data.data?.find((w) => w.name === workflowData.name);
    
    if (existingWorkflow) {
      console.log(`   ⚠️  Workflow уже существует (ID: ${existingWorkflow.id}), обновляю...`);
      
      await axios.put(
        `${N8N_HOST}/workflows/${existingWorkflow.id}`,
        {
          ...workflowData,
          id: existingWorkflow.id,
        },
        { headers, timeout: 10000 }
      );
      
      console.log(`   ✅ Workflow обновлен`);
      console.log(`   📋 ID: ${existingWorkflow.id}`);
      return existingWorkflow.id;
    } else {
      console.log('   ℹ️  Создаю новый workflow...');
      
      const response = await axios.post(
        `${N8N_HOST}/workflows`,
        workflowData,
        { headers, timeout: 10000 }
      );
      
      const newId = response.data.data.id;
      console.log(`   ✅ Workflow создан`);
      console.log(`   📋 ID: ${newId}`);
      return newId;
    }
  } catch (error) {
    if (error.response) {
      console.error(`   ❌ Ошибка API: ${error.response.status} ${error.response.statusText}`);
      console.error(`   Ответ:`, JSON.stringify(error.response.data, null, 2));
    } else if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') {
      console.error(`   ❌ Ошибка подключения: ${error.message}`);
      console.error(`   💡 Проверьте доступность n8n: http://46.224.17.15:5678`);
    } else {
      console.error(`   ❌ Ошибка: ${error.message}`);
    }
    throw error;
  }
}

async function main() {
  try {
    await importNewWorkflow();
    console.log('\n✅ Импорт завершен успешно!');
  } catch (error) {
    console.error('\n❌ Импорт не удался');
    console.error('\n📝 Альтернатива: импортируйте вручную через UI n8n');
    console.error('   1. Откройте: http://46.224.17.15:5678');
    console.error('   2. Workflows → Import from File');
    console.error('   3. Выберите: n8n-workflows/rentprog-upsert-processor.json');
    console.error('   4. Назначьте credentials и активируйте');
    process.exit(1);
  }
}

main().catch(console.error);

