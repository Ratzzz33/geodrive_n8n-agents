import { readFileSync } from 'fs';

const N8N_HOST = "https://n8n.rentflow.rentals/api/v1";
const N8N_API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI";

console.log('🤖 Импорт Error Handler - AI Agent workflow...\n');

try {
  // Читаем workflow файл
  const wfContent = readFileSync('n8n-workflows/error-handler-ai-agent.json', 'utf8');
  const wfJson = JSON.parse(wfContent);

  // Удаляем лишние поля
  delete wfJson.id;
  delete wfJson.versionId;
  delete wfJson.updatedAt;
  delete wfJson.createdAt;

  // Готовим минимальный объект для n8n API
  const workflow = {
    name: wfJson.name,
    nodes: wfJson.nodes,
    connections: wfJson.connections,
    settings: wfJson.settings || { executionOrder: "v1" }
  };

  // Отправляем в n8n
  const response = await fetch(`${N8N_HOST}/workflows`, {
    method: 'POST',
    headers: {
      'X-N8N-API-KEY': N8N_API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(workflow)
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`HTTP ${response.status}: ${error}`);
  }

  const result = await response.json();
  const workflowId = result.data?.id || result.id;

  console.log('✅ Workflow импортирован успешно!');
  console.log(`   ID: ${workflowId}`);
  console.log(`   URL: https://n8n.rentflow.rentals/workflow/${workflowId}`);
  console.log('\n📝 Важные заметки:');
  console.log('   1. Проверьте credentials в workflow:');
  console.log('      - PostgreSQL (Neon)');
  console.log('      - Telegram Bot (@n8n_alert_geodrive_bot)');
  console.log('      - OpenAI API Key');
  console.log('      - GitHub OAuth2 (опционально)');
  console.log('\n   2. Протестируйте workflow через Test Execution');
  console.log('\n   3. Добавьте этот workflow как Error Workflow в другие workflows');
  console.log(`      Settings → Error Workflow → ${wfJson.name}`);
  
  // Сохраняем ID для использования в следующих скриптах
  const idMapping = { errorWorkflowId: workflowId };
  await import('fs').then(fs => 
    fs.promises.writeFile(
      'setup/workflow_ids.json',
      JSON.stringify(idMapping, null, 2)
    )
  );
  
  console.log('\n✅ ID сохранен в setup/workflow_ids.json');

} catch (error) {
  console.error('❌ Ошибка импорта:', error.message);
  process.exit(1);
}

