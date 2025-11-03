import fs from 'fs';
import { spawn } from 'child_process';

const wfFile = 'n8n-workflows/rentprog-webhooks-monitor.json';
const wfContent = fs.readFileSync(wfFile, 'utf8');
const wfJson = JSON.parse(wfContent);

const workflow = {
  id: 'gNXRKIQpNubEazH7',
  name: wfJson.name,
  nodes: wfJson.nodes,
  connections: wfJson.connections,
  settings: wfJson.settings
};

console.log(`✅ Workflow подготовлен: ${workflow.name}`);
console.log(`   Нод: ${workflow.nodes.length}`);
console.log(`   Есть нода "Alert: Parse Error": ${workflow.nodes.some(n => n.name === 'Alert: Parse Error')}`);
console.log(`   Error connections от Parse & Validate Format: ${workflow.connections['Parse & Validate Format']?.error ? 'есть' : 'нет'}`);
console.log(`   Error connections от If Known Format: ${workflow.connections['If Known Format']?.error ? 'есть' : 'нет'}`);
console.log(`   Error connections от Auto Process: ${workflow.connections['Auto Process']?.error ? 'есть' : 'нет'}`);

// Сохраняем в файл для проверки
fs.writeFileSync('temp_workflow_mcp.json', JSON.stringify(workflow, null, 2));
console.log('\n✅ Workflow сохранен в temp_workflow_mcp.json для ручной проверки');
console.log('\n⚠️  Обновление через MCP требует прямого вызова инструмента');
console.log('   Воспользуйтесь инструкцией выше или обновите вручную через n8n UI');

