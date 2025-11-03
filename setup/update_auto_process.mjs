import fs from 'fs';

const workflow = JSON.parse(fs.readFileSync('n8n-workflows/rentprog-webhooks-monitor.json', 'utf8'));

// Находим ноду "Auto Process"
const autoProcessNode = workflow.nodes.find(n => n.name === 'Auto Process');

if (autoProcessNode) {
  // Обновляем bodyParameters - добавляем operation
  autoProcessNode.parameters.bodyParameters.parameters.push({
    "name": "operation",
    "value": "={{ $json.operation }}"
  });
  
  fs.writeFileSync('n8n-workflows/rentprog-webhooks-monitor.json', JSON.stringify(workflow, null, 2), 'utf8');
  
  console.log('✅ Нода "Auto Process" обновлена');
  console.log('   Добавлен параметр: operation');
} else {
  console.error('❌ Нода "Auto Process" не найдена');
}

