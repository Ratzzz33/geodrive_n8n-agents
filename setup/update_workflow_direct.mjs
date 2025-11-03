import fs from 'fs';
import https from 'https';
import http from 'http';

const N8N_HOST = 'http://46.224.17.15:5678/api/v1';
const N8N_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI';

const WORKFLOW_ID = 'gNXRKIQpNubEazH7';

async function updateWorkflow() {
  try {
    const wfContent = fs.readFileSync('n8n-workflows/rentprog-webhooks-monitor.json', 'utf8');
    const wfJson = JSON.parse(wfContent);
    
    const workflow = {
      id: WORKFLOW_ID,
      name: wfJson.name,
      nodes: wfJson.nodes,
      connections: wfJson.connections,
      settings: wfJson.settings
    };
    
    const body = JSON.stringify(workflow);
    const url = new URL(`${N8N_HOST}/workflows/${WORKFLOW_ID}`);
    
    console.log(`Обновление workflow ${WORKFLOW_ID}...`);
    
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: 'PUT',
      headers: {
        'X-N8N-API-KEY': N8N_API_KEY,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      },
      timeout: 30000
    };
    
    return new Promise((resolve, reject) => {
      const req = http.request(options, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          if (res.statusCode === 200 || res.statusCode === 201) {
            console.log('✅ Workflow успешно обновлен!');
            try {
              const result = JSON.parse(data);
              console.log(`ID: ${result.data?.id || WORKFLOW_ID}`);
            } catch (e) {
              console.log(data);
            }
            resolve();
          } else {
            console.error(`❌ Ошибка: ${res.statusCode}`);
            console.error(data);
            reject(new Error(`HTTP ${res.statusCode}: ${data}`));
          }
        });
      });
      
      req.on('error', (error) => {
        console.error('❌ Ошибка запроса:', error.message);
        reject(error);
      });
      
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Timeout'));
      });
      
      req.write(body);
      req.end();
    });
    
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    throw error;
  }
}

updateWorkflow().catch(console.error);

