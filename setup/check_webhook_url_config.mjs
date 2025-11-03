// Проверка конфигурации webhook URL в n8n
import fetch from 'node-fetch';

const N8N_HOST = 'https://n8n.rentflow.rentals/api/v1';
const N8N_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI';

const headers = {
  'X-N8N-API-KEY': N8N_API_KEY,
  'Content-Type': 'application/json'
};

console.log('🔍 Проверка конфигурации webhook URL...\n');

try {
  // Получаем workflow
  const workflowRes = await fetch(`${N8N_HOST}/workflows/gNXRKIQpNubEazH7`, { headers });
  const workflow = await workflowRes.json();
  
  const webhookNode = workflow.nodes.find(n => n.type === 'n8n-nodes-base.webhook');
  
  if (webhookNode) {
    console.log('📋 Конфигурация Webhook ноды:');
    console.log(`   Path: ${webhookNode.parameters.path}`);
    console.log(`   Production URL: ${webhookNode.parameters.options?.productionUrl || 'не указан'}`);
    console.log(`   Webhook ID: ${webhookNode.webhookId}`);
    
    // Формируем полный URL как это делает n8n
    const productionUrl = webhookNode.parameters.options?.productionUrl || '';
    const path = webhookNode.parameters.path;
    
    // n8n формирует URL как: productionUrl + /webhook/ + path
    let fullUrl = '';
    if (productionUrl) {
      // Если productionUrl заканчивается на /, убираем
      const baseUrl = productionUrl.endsWith('/') ? productionUrl.slice(0, -1) : productionUrl;
      fullUrl = `${baseUrl}/webhook/${path}`;
    } else {
      // Если нет productionUrl, используется значение из переменной окружения WEBHOOK_URL
      fullUrl = `[WEBHOOK_URL из env]/webhook/${path}`;
    }
    
    console.log(`\n🔗 Полный webhook URL (как в n8n UI):`);
    console.log(`   ${fullUrl}`);
    
    console.log(`\n📝 Что должно быть в RentProg:`);
    console.log(`   ✅ Правильно: https://webhook.rentflow.rentals (без пути)`);
    console.log(`   ❌ Неправильно: ${fullUrl} (с путем)`);
    
    console.log(`\n⚙️ Архитектура:`);
    console.log(`   RentProg → https://webhook.rentflow.rentals/`);
    console.log(`   ↓ (Nginx proxy)`);
    console.log(`   http://localhost:5678/webhook/${path}`);
    console.log(`   ↓ (n8n webhook node)`);
    console.log(`   Workflow: ${workflow.name}`);
    
  } else {
    console.log('❌ Webhook нода не найдена');
  }
  
} catch (error) {
  console.error('❌ Ошибка:', error.message);
  process.exit(1);
}

