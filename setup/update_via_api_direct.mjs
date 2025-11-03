import fs from 'fs';
import http from 'http';

const N8N_HOST = 'http://46.224.17.15:5678/api/v1';
const N8N_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI';

const WORKFLOW_ID = 'gNXRKIQpNubEazH7';

async function updateWorkflow() {
  try {
    const wfContent = fs.readFileSync('workflow_for_mcp.json', 'utf8');
    const workflow = JSON.parse(wfContent);
    
    // Удаляем id из объекта, он передается в URL
    const { id, ...workflowData } = workflow;
    
    // Проверка error connection для Trigger Upsert Processor
    const triggerConn = workflowData.connections['Trigger Upsert Processor'];
    if (!triggerConn.error) {
      throw new Error('Error connection для Trigger Upsert Processor отсутствует!');
    }
    console.log('✅ Error connection для Trigger Upsert Processor найден');
    
    const body = JSON.stringify(workflowData);
    const url = new URL(`${N8N_HOST}/workflows/${WORKFLOW_ID}`);
    
    console.log(`\n🔄 Обновление workflow ${WORKFLOW_ID}...`);
    
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
      timeout: 60000
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
              if (result.data) {
                console.log(`   ID: ${result.data.id || WORKFLOW_ID}`);
                console.log(`   Name: ${result.data.name || workflow.name}`);
                console.log(`   Updated: ${result.data.updatedAt || 'unknown'}`);
              } else if (result.success) {
                console.log(`   Updated: ${result.data?.updatedAt || 'unknown'}`);
              }
            } catch (e) {
              console.log('Ответ:', data.substring(0, 200));
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

