// Диагностика почему не приходят вебхуки от RentProg
import fetch from 'node-fetch';

const N8N_HOST = 'https://n8n.rentflow.rentals/api/v1';
const N8N_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI';

const headers = {
  'X-N8N-API-KEY': N8N_API_KEY,
  'Content-Type': 'application/json'
};

console.log('🔍 Диагностика проблемы с входящими вебхуками от RentProg...\n');

try {
  // 1. Проверка workflow
  console.log('1️⃣ Проверка workflow "RentProg Webhooks Monitor"...');
  const workflowRes = await fetch(`${N8N_HOST}/workflows/gNXRKIQpNubEazH7`, { headers });
  const workflow = await workflowRes.json();
  
  console.log(`   ✅ Workflow найден: ${workflow.name}`);
  console.log(`   ✅ Active: ${workflow.active ? 'Да' : 'Нет'}`);
  
  const webhookNode = workflow.nodes.find(n => n.type === 'n8n-nodes-base.webhook');
  if (webhookNode) {
    console.log(`   ✅ Webhook нода найдена`);
    console.log(`      Path: ${webhookNode.parameters.path}`);
    console.log(`      Production URL: ${webhookNode.parameters.options?.productionUrl || 'не указан'}`);
    console.log(`      Webhook ID: ${webhookNode.webhookId}`);
  }
  
  // 2. Проверка последних executions
  console.log('\n2️⃣ Проверка последних executions...');
  const executionsRes = await fetch(`${N8N_HOST}/executions?workflowId=gNXRKIQpNubEazH7&limit=10`, { headers });
  const executions = await executionsRes.json();
  
  if (executions.data && executions.data.length > 0) {
    console.log(`   ✅ Найдено executions: ${executions.data.length}`);
    const recent = executions.data.slice(0, 5);
    console.log('\n   Последние 5 executions:');
    recent.forEach(exec => {
      const date = new Date(exec.startedAt).toLocaleString('ru-RU');
      console.log(`      - ID: ${exec.id}, Статус: ${exec.status}, Время: ${date}, Режим: ${exec.mode}`);
    });
  } else {
    console.log('   ⚠️  Нет executions');
  }
  
  // 3. Проверка доступности webhook URL
  console.log('\n3️⃣ Проверка доступности webhook URL...');
  try {
    const webhookTest = await fetch('https://webhook.rentflow.rentals/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ts: new Date().toISOString(),
        branch: 'test',
        type: 'diagnostic',
        payload: { id: 'diagnostic_test' },
        ok: true
      })
    });
    
    console.log(`   ✅ Webhook доступен: ${webhookTest.status} ${webhookTest.statusText}`);
    const responseText = await webhookTest.text();
    console.log(`   Ответ: ${responseText.substring(0, 100)}`);
  } catch (error) {
    console.log(`   ❌ Ошибка при обращении к webhook: ${error.message}`);
  }
  
  // 4. Рекомендации
  console.log('\n📋 Возможные причины почему вебхуки не приходят:');
  console.log('   1. ❓ В RentProg указан неправильный URL');
  console.log('   2. ❓ Nginx не проксирует правильно (проверить логи на сервере)');
  console.log('   3. ❓ SSL сертификат не работает для HTTPS');
  console.log('   4. ❓ Workflow не активен (проверено: активен)');
  console.log('   5. ❓ n8n не слушает на порту 5678');
  console.log('   6. ❓ Firewall блокирует входящие запросы');
  
  console.log('\n🔧 Рекомендации для проверки на сервере:');
  console.log('   1. Проверить логи nginx: tail -50 /var/log/nginx/webhook-access.log');
  console.log('   2. Проверить ошибки nginx: tail -50 /var/log/nginx/webhook-error.log');
  console.log('   3. Проверить логи n8n: docker logs n8n --tail 100 | grep -i webhook');
  console.log('   4. Проверить что n8n слушает: netstat -tlnp | grep 5678');
  console.log('   5. Проверить SSL: curl -vI https://webhook.rentflow.rentals');
  
} catch (error) {
  console.error('❌ Ошибка:', error.message);
  process.exit(1);
}

