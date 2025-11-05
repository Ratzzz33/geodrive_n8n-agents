import fs from 'fs';

console.log('🔧 Исправление всех ошибок в workflow...\n');

const wfPath = 'n8n-workflows/rentprog-upsert-processor-fixed.json';
const wf = JSON.parse(fs.readFileSync(wfPath, 'utf8'));

let fixed = 0;

// 1. Исправляем Webhook Trigger
const webhook = wf.nodes.find(n => n.name === 'Webhook Trigger');
if (webhook) {
  webhook.parameters.onError = 'continueRegularOutput';
  console.log('✅ 1. Webhook Trigger: добавлен onError');
  fixed++;
}

// 2. Исправляем Try ноды - URL с конкатенацией
const tryNodes = wf.nodes.filter(n => n.name.startsWith('Try '));
for (const node of tryNodes) {
  // Было: "=https://...search_{{ $json.entity_type }}s?query={{ $json.rentprog_id }}"
  // Стало: ="https://...search_" & $json.entity_type & "s?query=" & $json.rentprog_id
  node.parameters.url = '="https://rentprog.net/api/v1/public/search_" & $json.entity_type & "s?query=" & $json.rentprog_id';
  console.log(`✅ 2. ${node.name}: исправлен URL (конкатенация)`);
  fixed++;
}

// 3. Исправляем Save ноды - queryReplacement
const saveNodes = wf.nodes.filter(n => n.name.startsWith('Save ') && n.name.includes('Data'));
for (const node of saveNodes) {
  // Было: "={{ $('Get RentProg Tokens').item.json.entity_type }},={{ $json[0].id }}"
  // Стало: ="=" & $('Get RentProg Tokens').item.json.entity_type & ",=" & $json[0].id
  node.parameters.options.queryReplacement = '="=" & $("Get RentProg Tokens").item.json.entity_type & ",=" & $json[0].id';
  console.log(`✅ 3. ${node.name}: исправлен queryReplacement`);
  fixed++;
}

// 4. Исправляем Alert: Not Found
const alert = wf.nodes.find(n => n.name === 'Alert: Not Found');
if (alert) {
  // Добавляем operation
  alert.parameters.operation = 'sendMessage';
  
  // Исправляем text - убираем вложенные выражения
  // Простой текст без динамических вставок
  alert.parameters.text = '❌ Не удалось найти сущность ни в одном филиале!\n\nПопытки:\n• Tbilisi: не найдено\n• Batumi: не найдено\n• Kutaisi: не найдено\n• Service Center: не найдено\n\nВозможно, сущность была удалена или ID некорректен.';
  
  console.log('✅ 4. Alert: Not Found: добавлена operation и упрощен text');
  fixed++;
}

// Сохраняем
fs.writeFileSync(wfPath, JSON.stringify(wf, null, 2), 'utf8');

console.log('\n' + '═'.repeat(70));
console.log(`\n✅ Исправлено ${fixed} ошибок!`);
console.log('\n📝 Основные изменения:');
console.log('   1. Webhook: добавлен onError');
console.log('   2. Try nodes: URL через конкатенацию (&)');
console.log('   3. Save nodes: queryReplacement через конкатенацию');
console.log('   4. Alert: добавлена operation и упрощен text');
console.log('\n💾 Файл: n8n-workflows/rentprog-upsert-processor-fixed.json');
console.log('\n🚀 Следующий шаг: загрузить в n8n');

