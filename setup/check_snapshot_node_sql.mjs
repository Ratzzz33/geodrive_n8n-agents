import fs from 'fs';

const workflowFile = 'c:/Users/33pok/.cursor/projects/c-Users-33pok-geodrive-n8n-agents/agent-tools/c7d11d8b-9dc6-489f-96b1-ad20770ff969.txt';
const rawData = JSON.parse(fs.readFileSync(workflowFile, 'utf8'));

// MCP возвращает { data: { ...workflow } }, поэтому берем data
const workflow = rawData.data || rawData;

console.log('🔍 Проверка ноды "Save Snapshot"...\n');

if (!workflow.nodes) {
  console.log('❌ Поле nodes не найдено в workflow');
  console.log('   Структура данных:', Object.keys(workflow).join(', '));
  process.exit(1);
}

const node = workflow.nodes.find(n => n.name === 'Save Snapshot');

if (!node) {
  console.log('❌ Нода "Save Snapshot" не найдена');
  process.exit(1);
}

if (!node.parameters || !node.parameters.query) {
  console.log('❌ SQL запрос не найден в параметрах ноды');
  process.exit(1);
}

const query = node.parameters.query;

console.log('📊 Результаты проверки:');
console.log('   fetched_at найден:', query.includes('fetched_at') ? '✅ ДА' : '❌ НЕТ');
console.log('   updated_at найден:', query.includes('updated_at') ? '⚠️  ДА (плохо!)' : '✅ НЕТ');

console.log('\n📝 Фрагменты SQL запроса:\n');

// Ищем все упоминания fetched_at и updated_at
const lines = query.split('\n');
lines.forEach((line, idx) => {
  if (line.includes('fetched_at') || line.includes('updated_at')) {
    console.log(`   Строка ${idx + 1}: ${line.trim()}`);
  }
});

if (query.includes('fetched_at') && !query.includes('updated_at')) {
  console.log('\n✅ ОТЛИЧНО! SQL запрос использует правильную колонку fetched_at');
  console.log('   Workflow готов к тестированию!');
} else if (query.includes('updated_at')) {
  console.log('\n❌ ОШИБКА! SQL запрос все еще содержит updated_at');
  console.log('   Обновление workflow НЕ применилось корректно!');
} else {
  console.log('\n⚠️  Ни fetched_at, ни updated_at не найдены в запросе');
}
