import fs from 'fs';

const wfFile = 'n8n-workflows/rentprog-webhooks-monitor.json';
const wfContent = fs.readFileSync(wfFile, 'utf8');
const wfJson = JSON.parse(wfContent);

const workflowForMCP = {
  id: 'gNXRKIQpNubEazH7',
  name: wfJson.name,
  nodes: wfJson.nodes,
  connections: wfJson.connections,
  settings: wfJson.settings
};

console.log('✅ Workflow готов для MCP:');
console.log(`   ID: ${workflowForMCP.id}`);
console.log(`   Name: ${workflowForMCP.name}`);
console.log(`   Nodes: ${workflowForMCP.nodes.length}`);
console.log(`   Connections: ${Object.keys(workflowForMCP.connections).length}`);
console.log('\n📋 Проверка структуры:');
console.log(`   ✅ Нода "Alert: Parse Error": ${workflowForMCP.nodes.some(n => n.name === 'Alert: Parse Error')}`);
console.log(`   ✅ Error connection от "Parse & Validate Format": ${workflowForMCP.connections['Parse & Validate Format']?.error ? 'есть' : 'нет'}`);
console.log(`   ✅ Error connection от "If Known Format": ${workflowForMCP.connections['If Known Format']?.error ? 'есть' : 'нет'}`);
console.log(`   ✅ Error connection от "Auto Process": ${workflowForMCP.connections['Auto Process']?.error ? 'есть' : 'нет'}`);

// Сохраняем для MCP
fs.writeFileSync('workflow_for_mcp.json', JSON.stringify(workflowForMCP, null, 2));
console.log('\n✅ Workflow сохранен в workflow_for_mcp.json');
console.log('\n⚠️  Для применения через MCP используйте инструмент:');
console.log('   n8n_update_full_workflow с параметрами из workflow_for_mcp.json');

