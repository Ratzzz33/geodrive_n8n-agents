import fs from 'fs';

console.log('📤 Загрузка обновленного workflow в n8n...\n');

// Читаем JSON
const wf = JSON.parse(fs.readFileSync('n8n-workflows/rentprog-upsert-processor-fixed.json', 'utf8'));

console.log('✅ JSON загружен');
console.log(`   Nodes: ${wf.nodes.length}`);
console.log(`   Connections: ${Object.keys(wf.connections).length} узлов\n`);

console.log('🚀 Используйте MCP tool для загрузки:\n');
console.log('mcp_n8n-mcp-official_n8n_update_full_workflow({\n');
console.log('  id: "fijJpRlLjgpxSJE7",\n');
console.log('  name: "RentProg Upsert Processor (Fixed)",\n');
console.log('  nodes: [...],\n');
console.log('  connections: {...},\n');
console.log('  settings: { executionOrder: "v1" }\n');
console.log('})\n');

console.log('📝 Или через прямой API запрос');

