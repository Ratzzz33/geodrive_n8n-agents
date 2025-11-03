// Этот файл показывает структуру для резервного MCP
// Но MCP инструменты не могут читать большие массивы напрямую
// Используем резервный MCP через n8n_update_full_workflow

import fs from 'fs';

const wf = JSON.parse(fs.readFileSync('workflow_for_mcp.json', 'utf8'));
const { id, ...rest } = wf;

console.log('✅ Workflow для резервного MCP:');
console.log(`   ID: ${id}`);
console.log(`   Name: ${rest.name}`);
console.log(`   Nodes: ${rest.nodes.length}`);
console.log(`   Connections: ${Object.keys(rest.connections).length}`);
console.log(`\n⚠️  Для резервного MCP нужно передать весь объект:`);
console.log(`   {`);
console.log(`     id: "${id}",`);
console.log(`     name: "${rest.name}",`);
console.log(`     nodes: [11 нод],`);
console.log(`     connections: {10 connections},`);
console.log(`     settings: ${JSON.stringify(rest.settings)}`);
console.log(`   }`);

