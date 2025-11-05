import fs from 'fs';

console.log('\n🔧 Исправление: /cars/{id} → /all_cars_full + фильтр\n');

const wfPath = 'n8n-workflows/rentprog-upsert-processor-fixed.json';
const wf = JSON.parse(fs.readFileSync(wfPath, 'utf8'));

// Меняем все Try nodes
const tryNodes = wf.nodes.filter(n => n.name.startsWith('Try '));

for (const node of tryNodes) {
  console.log(`✅ ${node.name}:`);
  console.log(`   Старый URL: ${node.parameters.url}`);
  
  // Меняем URL на /all_{type}_full
  // Было: ="https://rentprog.net/api/v1/public/" & $json.entity_type & "s/" & $json.rentprog_id
  // Стало: ="https://rentprog.net/api/v1/public/all_" & $json.entity_type & "s_full"
  
  // Для bookings используем /all_bookings (без _full)
  node.parameters.url = '="https://rentprog.net/api/v1/public/all_" & $json.entity_type & "s_full"';
  
  console.log(`   Новый URL: ${node.parameters.url}`);
  console.log('');
}

// Меняем If nodes - теперь нужно искать в массиве
const ifNodes = wf.nodes.filter(n => n.name.includes('Success'));

for (const node of ifNodes) {
  console.log(`✅ ${node.name}:`);
  console.log(`   Старая проверка: $json.id !== undefined`);
  
  // Меняем проверку: ищем в массиве
  // Было: $json.id !== undefined && $json.id !== null
  // Стало: Array.isArray($json) && $json.find(item => item.id == $('Get RentProg Tokens').item.json.rentprog_id) !== undefined
  node.parameters.conditions.conditions[0].leftValue = '={{ Array.isArray($json) && $json.length > 0 }}';
  
  console.log(`   Новая проверка: Array.isArray && length > 0`);
  console.log('');
}

// Меняем Save nodes - нужно добавить Code node для поиска в массиве
// Но сначала просто исправим queryReplacement
const saveNodes = wf.nodes.filter(n => n.name.startsWith('Save ') && n.name.includes('Data'));

for (const node of saveNodes) {
  console.log(`✅ ${node.name}:`);
  console.log(`   Требуется добавить Filter node ПЕРЕД Save!`);
  console.log('');
}

fs.writeFileSync(wfPath, JSON.stringify(wf, null, 2), 'utf8');

console.log('💾 Файл сохранен!');
console.log('\n⚠️  ВАЖНО: Нужно добавить Filter nodes!');
console.log('\n📝 Архитектура:');
console.log('   Try Branch → Returns array');
console.log('   If Success → Check array.length > 0');
console.log('   Filter Code → найти item.id == rentprog_id');
console.log('   Save Data → сохранить найденный item');
console.log('\n🚀 Или упростить: использовать один Code node после Get Tokens!\n');

