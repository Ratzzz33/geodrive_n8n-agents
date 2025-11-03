import fs from 'fs';

const wf = JSON.parse(fs.readFileSync('workflow_for_mcp.json', 'utf8'));

console.log('📦 Восстановление полного workflow:');
console.log(`   ID: ${wf.id}`);
console.log(`   Name: ${wf.name}`);
console.log(`   Nodes: ${wf.nodes.length}`);
console.log(`   Connections: ${Object.keys(wf.connections).length}`);
console.log('');
console.log('✅ Workflow готов для передачи через резервный MCP');
console.log('   Используйте: mcp_n8n-mcp-official_n8n_update_full_workflow');
console.log('');
console.log('📝 Структура:');
wf.nodes.forEach((node, idx) => {
  console.log(`   ${idx + 1}. ${node.name} (${node.type})`);
});

