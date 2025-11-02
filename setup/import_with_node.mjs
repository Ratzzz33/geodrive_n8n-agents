/**
 * Импорт workflow через Node.js с новым API ключом
 */

import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const N8N_HOST = 'http://46.224.17.15:5678/api/v1';
const N8N_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI';

async function importWorkflow() {
  console.log('🚀 Импорт: RentProg Upsert Processor\n');

  const filePath = path.join(__dirname, '..', 'n8n-workflows', 'rentprog-upsert-processor.json');
  const workflowData = JSON.parse(fs.readFileSync(filePath, 'utf8'));

  // Удаляем поля, которые n8n API не принимает при создании
  delete workflowData.id;
  delete workflowData.versionId;
  delete workflowData.updatedAt;
  delete workflowData.createdAt;

  const headers = {
    'X-N8N-API-KEY': N8N_API_KEY,
    'Content-Type': 'application/json',
  };

  try {
    console.log('📝 Отправка workflow в n8n...');
    
    const response = await axios.post(
      `${N8N_HOST}/workflows`,
      workflowData,
      { headers, timeout: 30000 }
    );

    const newId = response.data.data.id;
    console.log('\n✅ Workflow создан успешно!');
    console.log(`📋 ID: ${newId}`);
    console.log(`🔗 URL: http://46.224.17.15:5678/workflow/${newId}`);
    console.log('\n📝 Следующие шаги:');
    console.log('1. Откройте workflow в n8n');
    console.log('2. Назначьте PostgreSQL credentials в каждой ноде');
    console.log('3. Активируйте workflow');

  } catch (error) {
    console.error('\n❌ Ошибка создания workflow');
    
    if (error.response) {
      console.error(`Статус: ${error.response.status}`);
      console.error('Ответ API:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error('Ошибка:', error.message);
    }
    
    process.exit(1);
  }
}

importWorkflow().catch(console.error);

