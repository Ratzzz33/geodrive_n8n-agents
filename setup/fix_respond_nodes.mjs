import fs from 'fs';

console.log('\n🔧 Исправление Respond nodes...\n');

const wfPath = 'n8n-workflows/rentprog-upsert-processor-fixed.json';
const wf = JSON.parse(fs.readFileSync(wfPath, 'utf8'));

const respondNodes = wf.nodes.filter(n => n.type === 'n8n-nodes-base.respondToWebhook');

for (const node of respondNodes) {
  const oldBody = node.parameters.responseBody;
  
  if (node.name === 'Respond Tbilisi') {
    node.parameters.responseBody = '{"ok":true,"branch":"tbilisi"}';
  } else if (node.name === 'Respond Batumi') {
    node.parameters.responseBody = '{"ok":true,"branch":"batumi"}';
  } else if (node.name === 'Respond Kutaisi') {
    node.parameters.responseBody = '{"ok":true,"branch":"kutaisi"}';
  } else if (node.name === 'Respond Service Center') {
    node.parameters.responseBody = '{"ok":true,"branch":"service-center"}';
  } else if (node.name === 'Respond Not Found') {
    node.parameters.responseBody = '{"ok":false,"error":"Not found in any branch"}';
  }
  
  console.log(`✅ ${node.name}:`);
  console.log(`   Было: ${oldBody}`);
  console.log(`   Стало: ${node.parameters.responseBody}`);
  console.log('');
}

fs.writeFileSync(wfPath, JSON.stringify(wf, null, 2), 'utf8');

console.log('💾 Файл сохранен!');
console.log('🚀 Загрузить в n8n: node setup/upload_via_api.mjs\n');

