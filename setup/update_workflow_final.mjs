import fs from 'fs';

const wfFile = 'workflow_for_mcp.json';
const wfContent = fs.readFileSync(wfFile, 'utf8');
const workflow = JSON.parse(wfContent);

console.log('📋 Workflow для обновления:');
console.log(`   ID: ${workflow.id}`);
console.log(`   Name: ${workflow.name}`);
console.log(`   Nodes: ${workflow.nodes.length}`);
console.log(`   Connections: ${Object.keys(workflow.connections).length}`);

// Проверка всех error connections
console.log('\n✅ Проверка error connections:');
const errorNodes = [
  'Parse & Validate Format',
  'If Known Format', 
  'Auto Process',
  'Trigger Upsert Processor'
];

errorNodes.forEach(nodeName => {
  const conn = workflow.connections[nodeName];
  if (conn && conn.error) {
    console.log(`   ✅ ${nodeName}: error → ${conn.error[0][0].node}`);
  } else {
    console.log(`   ❌ ${nodeName}: error connection отсутствует!`);
  }
});

console.log('\n✅ Workflow готов к обновлению через MCP');
console.log('   Используйте: mcp_n8n-mcp-official_n8n_update_full_workflow');

