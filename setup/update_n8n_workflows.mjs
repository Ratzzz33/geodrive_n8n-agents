// Обновление n8n workflows через API
import fs from 'fs';
import http from 'http';

const N8N_HOST = 'http://46.224.17.15:5678/api/v1';
const N8N_API_KEY = process.env.N8N_API_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI';

const workflows = [
  {
    file: 'n8n-workflows/rentprog-webhooks-monitor.json',
    id: 'gNXRKIQpNubEazH7'
  },
  {
    file: 'n8n-workflows/rentprog-upsert-processor.json',
    id: 'JnMuyk6G1A84pWiK'
  }
];

function updateWorkflow(filePath, workflowId) {
  return new Promise((resolve, reject) => {
    const content = fs.readFileSync(filePath, 'utf8');
    const wf = JSON.parse(content);
    
    // Удаляем системные поля
    delete wf.id;
    delete wf.versionId;
    delete wf.updatedAt;
    delete wf.createdAt;
    delete wf.triggerCount;
    
    const body = JSON.stringify({
      name: wf.name,
      nodes: wf.nodes,
      connections: wf.connections,
      settings: wf.settings || { executionOrder: 'v1' }
    });
    
    const options = {
      hostname: '46.224.17.15',
      port: 5678,
      path: `/api/v1/workflows/${workflowId}`,
      method: 'PUT',
      headers: {
        'X-N8N-API-KEY': N8N_API_KEY,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    };
    
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode === 200) {
          console.log(`✅ Workflow "${wf.name}" обновлен`);
          resolve(JSON.parse(data));
        } else {
          console.error(`❌ Ошибка обновления "${wf.name}": ${res.statusCode}`);
          console.error(data);
          reject(new Error(`HTTP ${res.statusCode}`));
        }
      });
    });
    
    req.on('error', (error) => {
      console.error(`❌ Ошибка запроса для "${wf.name}":`, error.message);
      reject(error);
    });
    
    req.write(body);
    req.end();
  });
}

async function main() {
  console.log('🔄 Обновление n8n workflows...\n');
  
  for (const wf of workflows) {
    try {
      await updateWorkflow(wf.file, wf.id);
    } catch (error) {
      console.error(`Ошибка при обновлении ${wf.file}:`, error.message);
    }
  }
  
  console.log('\n✅ Обновление завершено');
}

main().catch(console.error);

