import fs from 'fs';

const wfFile = 'workflow_for_mcp.json';
const wfContent = fs.readFileSync(wfFile, 'utf8');
const workflow = JSON.parse(wfContent);

console.log('📋 Workflow для обновления через MCP:');
console.log(`   ID: ${workflow.id}`);
console.log(`   Name: ${workflow.name}`);
console.log(`   Nodes: ${workflow.nodes.length}`);
console.log(`   Connections: ${Object.keys(workflow.connections).length}`);

// Проверяем ключевые элементы
const hasAlertNode = workflow.nodes.some(n => n.name === 'Alert: Parse Error');
const hasErrorConnections = 
  workflow.connections['Parse & Validate Format']?.error &&
  workflow.connections['If Known Format']?.error &&
  workflow.connections['Auto Process']?.error;

console.log('\n✅ Проверка структуры:');
console.log(`   ${hasAlertNode ? '✅' : '❌'} Нода "Alert: Parse Error"`);
console.log(`   ${hasErrorConnections ? '✅' : '❌'} Error connections настроены`);

if (hasAlertNode && hasErrorConnections) {
  console.log('\n✅ ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ! Workflow готов к обновлению.');
  console.log('\n⚠️  Для применения используйте MCP инструмент:');
  console.log('   n8n_update_full_workflow');
  console.log('   с параметрами:');
  console.log(`   - id: "${workflow.id}"`);
  console.log(`   - name: "${workflow.name}"`);
  console.log(`   - nodes: [${workflow.nodes.length} нод]`);
  console.log(`   - connections: [объект connections]`);
  console.log(`   - settings: ${JSON.stringify(workflow.settings)}`);
} else {
  console.log('\n❌ ОШИБКА: Workflow не готов к обновлению!');
}

