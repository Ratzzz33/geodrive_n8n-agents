import fetch from 'node-fetch';

const N8N_HOST = 'https://n8n.rentflow.rentals/api/v1';
const N8N_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI';
const WORKFLOW_ID = 'Nc5GFhh5Ikhv1ivK';

async function fixHealthTableQuery() {
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
      console.error('Response keys:', Object.keys(workflow || {}));
      return;
    }
    
    // Находим ноду "Log to Health Table"
    const healthNode = workflow.nodes.find(n => n.name === 'Log to Health Table');
    
    if (!healthNode) {
      console.error('❌ Нода "Log to Health Table" не найдена');
      return;
    }
    
    console.log('📋 Текущий SQL запрос:');
    console.log(healthNode.parameters.query);
    console.log('\n📋 Текущие queryParams:');
    console.log(healthNode.parameters.additionalFields?.queryParams);
    
    // Обновляем queryParams для использования правильных полей
    healthNode.parameters.additionalFields = {
      queryParams: "={{ [$json.status === 'success' ? true : false, $json.error_count > 0 ? 'Errors: ' + $json.error_count : 'OK'] }}"
    };
    
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
      console.log('📋 Новый queryParams:');
      console.log(healthNode.parameters.additionalFields.queryParams);
    } else {
      console.error('❌ Ошибка обновления workflow:', result);
    }
    
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    console.error(error.stack);
  }
}

fixHealthTableQuery();

