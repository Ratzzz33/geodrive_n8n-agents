import https from 'https';
import fs from 'fs';

const N8N_HOST = 'https://n8n.rentflow.rentals/api/v1';
const N8N_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI';
const WORKFLOW_ID = 'gNXRKIQpNubEazH7';

console.log('🔧 Исправление knownEventTypes...\n');

// Читаем workflow
const workflow = JSON.parse(fs.readFileSync('n8n-workflows/rentprog-webhooks-monitor.json', 'utf8'));

// Находим ноду Parse & Validate Format
const parseNode = workflow.nodes.find(n => n.name === 'Parse & Validate Format' || n.id === 'parse-validate-node');

if (!parseNode) {
  console.error('❌ Не найдена нода "Parse & Validate Format"');
  process.exit(1);
}

console.log('✅ Нода найдена:', parseNode.name);

// Меняем knownEventTypes на пустой массив
const oldCode = parseNode.parameters.jsCode;

// Заменяем заполненный массив на пустой
const newCode = oldCode.replace(
  /const knownEventTypes = \[\s*'booking_update',[\s\S]*?'client_create', 'client_delete'\s*\];/,
  'const knownEventTypes = [];  // Пусто - все вебхуки считаются неизвестными'
);

if (oldCode === newCode) {
  console.log('⚠️  Изменений не требуется - knownEventTypes уже пуст');
} else {
  parseNode.parameters.jsCode = newCode;
  
  console.log('✅ knownEventTypes очищен');
  console.log('   ВСЕ вебхуки теперь будут считаться неизвестными');
  console.log('   и отправляться в Telegram для обучения\n');
  
  // Сохраняем в файл
  fs.writeFileSync(
    'n8n-workflows/rentprog-webhooks-monitor.json',
    JSON.stringify(workflow, null, 2)
  );
  
  console.log('💾 Изменения сохранены в файл\n');
  console.log('📤 Обновляем workflow в n8n...');
  
  // Подготавливаем данные для n8n API
  const payload = JSON.stringify({
    name: workflow.name,
    nodes: workflow.nodes,
    connections: workflow.connections,
    settings: workflow.settings || {},
    active: true
  });
  
  const options = {
    method: 'PUT',
    headers: {
      'X-N8N-API-KEY': N8N_API_KEY,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload)
    }
  };
  
  const req = https.request(`${N8N_HOST}/workflows/${WORKFLOW_ID}`, options, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      if (res.statusCode === 200) {
        console.log('✅ Workflow успешно обновлен в n8n!');
        console.log('\n🎉 Теперь ВСЕ вебхуки будут приходить в Telegram');
        console.log('   Можете начинать обучать систему распознавать их\n');
      } else {
        console.error(`❌ Ошибка ${res.statusCode}:`, data);
      }
    });
  });
  
  req.on('error', err => {
    console.error('❌ Ошибка запроса:', err.message);
  });
  
  req.write(payload);
  req.end();
}

