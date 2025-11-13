import fetch from 'node-fetch';

const N8N_HOST = 'https://n8n.rentflow.rentals/api/v1';
const N8N_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI';
const WORKFLOW_ID = 'Nc5GFhh5Ikhv1ivK';

async function updateTimeout() {
  try {
    // Получаем текущий workflow
    const getResponse = await fetch(`${N8N_HOST}/workflows/${WORKFLOW_ID}`, {
      headers: {
        'X-N8N-API-KEY': N8N_API_KEY
      }
    });
    
    const workflow = await getResponse.json();
    
    if (!workflow || !workflow.nodes) {
      console.error('❌ Не удалось получить workflow');
      return;
    }
    
    // Находим ноду "Update GPS Data"
    const updateNode = workflow.nodes.find(n => n.name === 'Update GPS Data');
    
    if (!updateNode) {
      console.error('❌ Нода "Update GPS Data" не найдена');
      return;
    }
    
    console.log('📋 Текущий timeout:', updateNode.parameters.options?.timeout || 'не установлен');
    
    // Обновляем timeout
    if (!updateNode.parameters.options) {
      updateNode.parameters.options = {};
    }
    updateNode.parameters.options.timeout = 240000; // 4 минуты
    
    console.log('📋 Новый timeout:', updateNode.parameters.options.timeout);
    
    // Обновляем workflow
    const updateResponse = await fetch(`${N8N_HOST}/workflows/${WORKFLOW_ID}`, {
      method: 'PUT',
      headers: {
        'X-N8N-API-KEY': N8N_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: workflow.name,
        nodes: workflow.nodes,
        connections: workflow.connections,
        settings: workflow.settings
      })
    });
    
    const result = await updateResponse.json();
    
    if (result && result.id === WORKFLOW_ID) {
      console.log('\n✅ Workflow обновлен успешно!');
      console.log('📋 Timeout увеличен до 240 секунд (4 минуты)');
    } else {
      console.error('❌ Ошибка обновления workflow:', result);
    }
    
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    console.error(error.stack);
  }
}

updateTimeout();

