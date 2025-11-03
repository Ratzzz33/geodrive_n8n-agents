import fs from 'fs';

const newCode = fs.readFileSync('setup/parse_code_updated.js', 'utf8');
const workflow = JSON.parse(fs.readFileSync('n8n-workflows/rentprog-webhooks-monitor.json', 'utf8'));

// Находим ноду "Parse & Validate Format"
const parseNode = workflow.nodes.find(n => n.name === 'Parse & Validate Format');

if (parseNode) {
  parseNode.parameters.jsCode = newCode;
  
  fs.writeFileSync('n8n-workflows/rentprog-webhooks-monitor.json', JSON.stringify(workflow, null, 2), 'utf8');
  
  console.log('✅ jsCode обновлен в Parse & Validate Format');
  console.log('');
  console.log('📝 Добавлены типы событий:');
  console.log('   - booking_update, booking_create, booking_delete');
  console.log('   - car_update, car_create, car_delete');
  console.log('   - client_update, client_create, client_delete');
  console.log('');
  console.log('📝 Добавлено поле "operation":');
  console.log('   - update - обновление существующей сущности');
  console.log('   - create - создание новой сущности');
  console.log('   - delete - удаление (архивация) сущности');
} else {
  console.error('❌ Нода "Parse & Validate Format" не найдена');
}

