import fetch from 'node-fetch';
import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';
const N8N_API = 'https://n8n.rentflow.rentals/api/v1';
const N8N_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI';

const headers = {
  'X-N8N-API-KEY': N8N_API_KEY,
  'Content-Type': 'application/json'
};

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

async function diagnose() {
  console.log('🔍 Диагностика проблем с вебхуками\n');
  
  // 1. Проверка executions
  console.log('1️⃣ Проверка executions в n8n...');
  try {
    const execRes = await fetch(`${N8N_API}/executions?workflowId=gNXRKIQpNubEazH7&limit=10`, { headers });
    const execData = await execRes.json();
    
    const executions = execData.data || [];
    const stuck = executions.filter(e => !e.finished && e.status === 'running');
    const errors = executions.filter(e => e.status === 'error');
    const success = executions.filter(e => e.status === 'success');
    
    console.log(`   Всего executions: ${executions.length}`);
    console.log(`   ✅ Успешных: ${success.length}`);
    console.log(`   ❌ Ошибок: ${errors.length}`);
    console.log(`   ⏸️  Зависших: ${stuck.length}`);
    
    if (stuck.length > 0) {
      console.log('\n   ⚠️ Зависшие executions:');
      stuck.forEach(e => {
        console.log(`     - ID: ${e.id}, создан: ${new Date(e.createdAt).toISOString()}`);
      });
    }
    
    if (errors.length > 0) {
      console.log('\n   ❌ Ошибочные executions:');
      errors.forEach(e => {
        console.log(`     - ID: ${e.id}, остановлен: ${e.stoppedAt ? new Date(e.stoppedAt).toISOString() : 'N/A'}`);
      });
    }
    
  } catch (error) {
    console.error(`   ❌ Ошибка получения executions: ${error.message}`);
  }
  
  // 2. Проверка БД
  console.log('\n2️⃣ Проверка записей в БД...');
  try {
    const events = await sql`SELECT COUNT(*) as cnt FROM events`;
    const unprocessed = await sql`SELECT COUNT(*) as cnt FROM events WHERE processed = FALSE`;
    
    console.log(`   Всего событий: ${events[0].cnt}`);
    console.log(`   Необработанных: ${unprocessed[0].cnt}`);
    
    if (events[0].cnt === 0) {
      console.log('   ⚠️ В БД НЕТ ЗАПИСЕЙ - это основная проблема!');
    }
    
  } catch (error) {
    console.error(`   ❌ Ошибка проверки БД: ${error.message}`);
  }
  
  // 3. Проверка webhook URL
  console.log('\n3️⃣ Проверка webhook URL...');
  const webhookUrl = 'https://webhook.rentflow.rentals/';
  console.log(`   URL: ${webhookUrl}`);
  console.log(`   Ожидаемый путь n8n: /webhook/rentprog-webhook`);
  console.log(`   Nginx должен проксировать: ${webhookUrl} → http://localhost:5678/webhook/rentprog-webhook`);
  
  // 4. Проверка workflow
  console.log('\n4️⃣ Проверка workflow...');
  try {
    const wfRes = await fetch(`${N8N_API}/workflows/gNXRKIQpNubEazH7`, { headers });
    const wfData = await wfRes.json();
    const workflow = wfData.data;
    
    console.log(`   Название: ${workflow.name}`);
    console.log(`   Активен: ${workflow.active ? '✅' : '❌'}`);
    console.log(`   Trigger count: ${workflow.triggerCount || 0}`);
    
    const webhookNode = workflow.nodes.find(n => n.type === 'n8n-nodes-base.webhook');
    if (webhookNode) {
      console.log(`   Webhook path: ${webhookNode.parameters.path}`);
      console.log(`   Production URL: ${webhookNode.parameters.options?.productionUrl || 'не задан'}`);
      console.log(`   Error handling: ${webhookNode.onError || 'не настроен'}`);
    }
    
    const postgresNode = workflow.nodes.find(n => n.name === 'Save Event');
    if (postgresNode) {
      console.log(`   PostgreSQL credentials: ${postgresNode.credentials?.postgres?.name || 'НЕ НАЗНАЧЕНЫ!'}`);
      console.log(`   Error handling: ${postgresNode.onError || 'не настроен'}`);
    }
    
  } catch (error) {
    console.error(`   ❌ Ошибка получения workflow: ${error.message}`);
  }
  
  // 5. Рекомендации
  console.log('\n📋 Рекомендации:');
  console.log('   1. Проверьте PostgreSQL credentials в ноде "Save Event"');
  console.log('   2. Проверьте детали последнего execution в n8n UI');
  console.log('   3. Проверьте логи n8n на сервере: docker logs n8n --tail 100');
  console.log('   4. Проверьте логи Nginx: /var/log/nginx/webhook-access.log');
  console.log('   5. Убедитесь что реальные вебхуки идут на правильный URL');
  
  await sql.end();
}

diagnose().catch(console.error);
