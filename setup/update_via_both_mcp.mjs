import fs from 'fs';

const wf = JSON.parse(fs.readFileSync('workflow_for_mcp.json', 'utf8'));
const { id, ...workflowData } = wf;

console.log('📋 Workflow подготовлен для обновления:');
console.log(`   ID: ${id}`);
console.log(`   Name: ${workflowData.name}`);
console.log(`   Nodes: ${workflowData.nodes.length}`);
console.log(`   Connections: ${Object.keys(workflowData.connections).length}`);
console.log('\n✅ Данные готовы для передачи через MCP');
console.log('\n📝 Используйте:');
console.log('   1. Основной MCP: mcp_n8n_n8n_update_workflow');
console.log('   2. Резервный MCP: mcp_n8n-mcp-official_n8n_update_full_workflow');

// Сохраняем упрощенную версию для передачи
const simplified = {
  id,
  name: workflowData.name,
  nodes: workflowData.nodes,
  connections: workflowData.connections,
  settings: workflowData.settings
};

fs.writeFileSync('workflow_mcp_simple.json', JSON.stringify(simplified, null, 2));
console.log('\n✅ Упрощенный workflow сохранен в workflow_mcp_simple.json');

