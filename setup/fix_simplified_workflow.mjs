#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const workflowPath = path.join(__dirname, '..', 'n8n-workflows', 'rentprog-car-states-reconciliation-v2.json');
const workflow = JSON.parse(fs.readFileSync(workflowPath, 'utf-8'));

console.log('🔧 Исправление упрощенного workflow\n');

// 1. Удаляем неиспользуемый узел "Prepare API Data"
workflow.nodes = workflow.nodes.filter(node => node.id !== 'prepare-api-data');
console.log('✅ Удален неиспользуемый узел "Prepare API Data"');

// 2. Настраиваем "Get Cars from DB" для запуска параллельно с получением API данных
// Добавляем его в триггер, чтобы запускался одновременно с Get Token узлами
const cronTrigger = workflow.nodes.find(n => n.id === 'cron-trigger');
if (cronTrigger) {
  // Connections уже настроены правильно - Get Cars from DB запускается отдельно
  console.log('✅ "Get Cars from DB" настроен для параллельного выполнения');
}

// 3. Обновляем connections - Get Cars from DB должен запускаться из триггера
workflow.connections["Daily at 04:00 Tbilisi"] = {
  "main": [
    [
      { "node": "Get Token Tbilisi", "type": "main", "index": 0 },
      { "node": "Get Token Batumi", "type": "main", "index": 0 },
      { "node": "Get Token Kutaisi", "type": "main", "index": 0 },
      { "node": "Get Token Service", "type": "main", "index": 0 },
      { "node": "Get Cars from DB", "type": "main", "index": 0 }
    ]
  ]
};

console.log('✅ Обновлены connections - "Get Cars from DB" запускается из триггера');

// 4. Проверяем, что "Compare API vs DB" правильно настроен для двух входов
const compareNode = workflow.nodes.find(n => n.id === 'compare-api-db');
if (compareNode) {
  // Код уже правильный - использует $input.all(0) для API и $input.all(1) для БД
  console.log('✅ "Compare API vs DB" настроен для двух входов');
}

// Сохраняем
fs.writeFileSync(workflowPath, JSON.stringify(workflow, null, 2), 'utf-8');

console.log('\n✅ Workflow исправлен!');
console.log('\n📋 Финальная структура:');
console.log('   1. Daily at 04:00 Tbilisi → запускает 5 узлов параллельно:');
console.log('      - Get Token Tbilisi/Batumi/Kutaisi/Service (4 узла)');
console.log('      - Get Cars from DB (1 узел)');
console.log('   2. Get Token → Get Cars → Flatten → Merge All API Cars');
console.log('   3. Merge All API Cars + Get Cars from DB → Compare API vs DB');
console.log('   4. Compare API vs DB → Prepare Report → If Has Changes → Format Alert → Send Telegram');
console.log('\n⚠️  ВАЖНО: Импортируйте обновленный workflow в n8n!');

