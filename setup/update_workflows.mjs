import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const N8N_HOST = 'https://n8n.rentflow.rentals/api/v1';
const N8N_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI7ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI';

const headers = {
  'X-N8N-API-KEY': N8N_API_KEY,
  'Content-Type': 'application/json',
};

// Маппинг имен workflow на ID и файлы
const workflows = [
  {
    name: 'RentProg Webhooks Monitor',
    id: 'gNXRKIQpNubEazH7',
    file: 'rentprog-webhooks-monitor.json',
  },
  {
    name: 'RentProg Upsert Processor',
    id: 'JnMuyk6G1A84pWiK',
    file: 'rentprog-upsert-processor.json',
  },
  {
    name: 'Health & Status',
    id: 'vNOWh8H7o5HL7fJ3',
    file: 'health-status.json',
  },
  {
    name: 'Sync Progress',
    id: 'TNg2dX78ovQrgWdL',
    file: 'sync-progress.json',
  },
];

async function updateWorkflow(wf) {
  console.log(`\n🔄 Обновление: ${wf.name} (${wf.id})`);
  
  const filePath = path.join(__dirname, '..', 'n8n-workflows', wf.file);
  const content = fs.readFileSync(filePath, 'utf8');
  const wfJson = JSON.parse(content);
  
  // Удаляем системные поля
  delete wfJson.id;
  delete wfJson.versionId;
  delete wfJson.updatedAt;
  delete wfJson.createdAt;
  delete wfJson.triggerCount;
  
  // Получаем текущий workflow для сохранения активного статуса
  try {
    const getResponse = await fetch(`${N8N_HOST}/workflows/${wf.id}`, {
      method: 'GET',
      headers,
    });
    
    if (!getResponse.ok) {
      throw new Error(`Не удалось получить workflow: ${getResponse.statusText}`);
    }
    
    const current = await getResponse.json();
    const isActive = current.data?.active || false;
    
    // Подготавливаем данные для обновления
    const updateData = {
      id: wf.id,
      name: wfJson.name,
      nodes: wfJson.nodes,
      connections: wfJson.connections,
      settings: wfJson.settings || { executionOrder: 'v1' },
      active: isActive, // Сохраняем текущий статус активности
    };
    
    // Отправляем обновление
    const updateResponse = await fetch(`${N8N_HOST}/workflows/${wf.id}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(updateData),
    });
    
    if (!updateResponse.ok) {
      const errorText = await updateResponse.text();
      throw new Error(`Ошибка обновления: ${updateResponse.status} - ${errorText}`);
    }
    
    const result = await updateResponse.json();
    console.log(`  ✅ Обновлен успешно (active: ${result.data?.active || false})`);
    
    return { success: true, active: result.data?.active || false };
  } catch (error) {
    console.error(`  ❌ Ошибка: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function main() {
  console.log('🚀 Обновление workflow в n8n');
  console.log(`📍 Host: ${N8N_HOST}\n`);
  
  const results = [];
  
  for (const wf of workflows) {
    const result = await updateWorkflow(wf);
    results.push({ workflow: wf.name, ...result });
  }
  
  console.log('\n📊 Результаты:');
  results.forEach(r => {
    if (r.success) {
      console.log(`  ✅ ${r.workflow}: обновлен (active: ${r.active})`);
    } else {
      console.log(`  ❌ ${r.workflow}: ошибка - ${r.error}`);
    }
  });
  
  // Активируем "RentProg Upsert Processor" если не активен
  const upsertWf = workflows.find(w => w.name === 'RentProg Upsert Processor');
  if (upsertWf) {
    try {
      const getResponse = await fetch(`${N8N_HOST}/workflows/${upsertWf.id}`, {
        method: 'GET',
        headers,
      });
      
      if (getResponse.ok) {
        const current = await getResponse.json();
        if (!current.data?.active) {
          console.log('\n🔌 Активация RentProg Upsert Processor...');
          const activateResponse = await fetch(`${N8N_HOST}/workflows/${upsertWf.id}/activate`, {
            method: 'POST',
            headers,
            body: '{}',
          });
          
          if (activateResponse.ok) {
            console.log('  ✅ Активирован');
          } else {
            console.log('  ⚠️ Не удалось активировать');
          }
        }
      }
    } catch (error) {
      console.log(`  ⚠️ Ошибка активации: ${error.message}`);
    }
  }
  
  console.log('\n✅ Обновление завершено');
}

main().catch(console.error);
