import fs from 'fs';

console.log('🔧 Исправление endpoints в Upsert Processor workflow...\n');

// Читаем текущий workflow
const wfPath = 'n8n-workflows/rentprog-upsert-processor-fixed.json';
const wf = JSON.parse(fs.readFileSync(wfPath, 'utf8'));

console.log('📋 Workflow:', wf.name);
console.log(`   Nodes: ${wf.nodes.length}\n`);

// Находим и обновляем HTTP Request ноды
const tryNodes = wf.nodes.filter(n => n.name.startsWith('Try '));

console.log(`🔍 Найдено ${tryNodes.length} Try nodes:\n`);

for (const node of tryNodes) {
  const branch = node.name.replace('Try ', '').toLowerCase().replace(' ', '-');
  console.log(`   • ${node.name}`);
  
  // Старый URL (неработающий)
  const oldUrl = node.parameters.url;
  console.log(`     Старый: ${oldUrl}`);
  
  // Новый URL (через search)
  const newUrl = "=https://rentprog.net/api/v1/public/search_{{ $json.entity_type }}s?query={{ $json.rentprog_id }}";
  node.parameters.url = newUrl;
  console.log(`     Новый: ${newUrl}`);
  
  // Убираем sendHeaders, используем authentication
  if (node.parameters.sendHeaders) {
    delete node.parameters.sendHeaders;
  }
  if (node.parameters.headerParameters) {
    delete node.parameters.headerParameters;
  }
  
  // Добавляем правильную аутентификацию
  node.parameters.authentication = 'genericCredentialType';
  node.parameters.genericAuthType = 'httpHeaderAuth';
  
  // Добавляем параметры авторизации через sendQuery
  if (!node.parameters.sendQuery) {
    node.parameters.sendQuery = true;
  }
  
  // ВАЖНО: Используем sendHeaders правильно
  node.parameters.sendHeaders = true;
  node.parameters.headerParameters = {
    parameters: [
      {
        name: 'Authorization',
        value: `=Bearer {{ $json.tokens.${branch === 'service-center' ? "['service-center']" : branch} }}`
      }
    ]
  };
  
  console.log(`     ✅ Обновлен\n`);
}

// Обновляем If Success ноды - search возвращает массив!
const ifNodes = wf.nodes.filter(n => n.name.includes('If ') && n.name.includes('Success'));

console.log(`🔍 Обновление ${ifNodes.length} If Success nodes:\n`);

for (const node of ifNodes) {
  console.log(`   • ${node.name}`);
  
  // Search возвращает массив, нужно проверить что массив не пустой
  const condition = node.parameters.conditions.conditions[0];
  
  // Старая проверка: $json.id !== undefined
  // Новая проверка: Array.isArray($json) && $json.length > 0
  condition.leftValue = "={{ Array.isArray($json) && $json.length > 0 }}";
  
  console.log(`     Условие: массив не пустой\n`);
}

// Обновляем Save ноды - нужно взять первый элемент массива
const saveNodes = wf.nodes.filter(n => n.name.startsWith('Save ') && n.name.includes('Data'));

console.log(`🔍 Обновление ${saveNodes.length} Save nodes:\n`);

for (const node of saveNodes) {
  console.log(`   • ${node.name}`);
  
  // Search возвращает массив, берем первый элемент
  // Было: {{ $json.id }}
  // Стало: {{ $json[0].id }}
  const query = node.parameters.query;
  const newQuery = query.replace('={{ $json.id }}', '={{ $json[0].id }}');
  node.parameters.query = newQuery;
  
  console.log(`     ✅ Обновлен query для массива\n`);
}

// Сохраняем
fs.writeFileSync(wfPath, JSON.stringify(wf, null, 2), 'utf8');

console.log('═'.repeat(70));
console.log('\n✅ Workflow обновлен!\n');
console.log('📝 Изменения:');
console.log('   1. HTTP Request: /bookings/{id} → /search_bookings?query={id}');
console.log('   2. If Success: проверка на непустой массив');
console.log('   3. Save Data: берем первый элемент массива $json[0].id\n');
console.log('💾 Файл: n8n-workflows/rentprog-upsert-processor-fixed.json');
console.log('\n🚀 Следующий шаг: обновить workflow в n8n через MCP');

