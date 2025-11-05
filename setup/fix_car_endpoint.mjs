import fs from 'fs';

console.log('\n🔧 Исправление endpoints: /search_* → /{entity}/{id}\n');

const wfPath = 'n8n-workflows/rentprog-upsert-processor-fixed.json';
const wf = JSON.parse(fs.readFileSync(wfPath, 'utf8'));

// Находим все HTTP Request ноды для поиска
const tryNodes = wf.nodes.filter(n => n.name.startsWith('Try '));

for (const node of tryNodes) {
  console.log(`✅ ${node.name}:`);
  console.log(`   Старый URL: ${node.parameters.url}`);
  
  // Меняем с /search_{type}s?query={id} на /{type}/{id}
  // Было: ="https://rentprog.net/api/v1/public/search_" & $json.entity_type & "s?query=" & $json.rentprog_id
  // Стало: ="https://rentprog.net/api/v1/public/" & $json.entity_type & "s/" & $json.rentprog_id
  node.parameters.url = '="https://rentprog.net/api/v1/public/" & $json.entity_type & "s/" & $json.rentprog_id';
  
  console.log(`   Новый URL: ${node.parameters.url}`);
  console.log('');
}

// Также нужно изменить проверку успеха: вместо массива теперь объект!
const ifNodes = wf.nodes.filter(n => n.name.includes('Success'));

for (const node of ifNodes) {
  console.log(`✅ ${node.name}:`);
  console.log(`   Старая проверка: Array.isArray($json) && $json.length > 0`);
  
  // Меняем с проверки массива на проверку объекта
  // Было: Array.isArray($json) && $json.length > 0
  // Стало: $json.id !== undefined && $json.id !== null
  node.parameters.conditions.conditions[0].leftValue = '={{ $json.id !== undefined && $json.id !== null }}';
  
  console.log(`   Новая проверка: $json.id !== undefined && $json.id !== null`);
  console.log('');
}

// И изменяем Save nodes: извлекаем ID не из массива, а из объекта
const saveNodes = wf.nodes.filter(n => n.name.startsWith('Save ') && n.name.includes('Data'));

for (const node of saveNodes) {
  console.log(`✅ ${node.name}:`);
  console.log(`   Старый queryReplacement: ${node.parameters.options.queryReplacement}`);
  
  // Было: ="=" & $("Get RentProg Tokens").item.json.entity_type & ",=" & $json[0].id
  // Стало: ="=" & $("Get RentProg Tokens").item.json.entity_type & ",=" & $json.id
  node.parameters.options.queryReplacement = '="=" & $("Get RentProg Tokens").item.json.entity_type & ",=" & $json.id';
  
  console.log(`   Новый queryReplacement: ${node.parameters.options.queryReplacement}`);
  console.log('');
}

fs.writeFileSync(wfPath, JSON.stringify(wf, null, 2), 'utf8');

console.log('💾 Файл сохранен!');
console.log('\n📝 Изменения:');
console.log('   1. URL: /search_cars?query={id} → /cars/{id}');
console.log('   2. Success check: Array.isArray → $json.id !== undefined');
console.log('   3. Save: $json[0].id → $json.id');
console.log('\n🚀 Загрузить в n8n и протестировать!\n');

