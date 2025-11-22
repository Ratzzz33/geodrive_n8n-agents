#!/usr/bin/env node

/**
 * Минимальная правка: увеличиваем per_page с 50 до 500
 * чтобы получать больше записей за один запрос
 */

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const WORKFLOW_FILE = join(__dirname, '..', 'n8n-workflows', '_RentProg__Active_Bookings.json');

console.log('📝 Увеличиваем per_page в HTTP Request нодах...\n');

// Читаем workflow
const workflowContent = readFileSync(WORKFLOW_FILE, 'utf-8');
const workflow = JSON.parse(workflowContent);

// Находим все HTTP Request ноды для филиалов
const httpNodes = workflow.nodes.filter(node => 
  node.type === 'n8n-nodes-base.httpRequest' &&
  ['Get Tbilisi Active', 'Get Batumi Active', 'Get Kutaisi Active', 'Get Service Active'].includes(node.name)
);

console.log(`Найдено ${httpNodes.length} HTTP Request нод:\n`);

let changedCount = 0;

httpNodes.forEach(node => {
  const jsonBody = node.parameters.jsonBody;
  
  // Заменяем per_page:50 на per_page:500
  if (jsonBody && jsonBody.includes('"per_page":50')) {
    node.parameters.jsonBody = jsonBody.replace('"per_page":50', '"per_page":500');
    console.log(`✅ ${node.name}: per_page 50 → 500`);
    changedCount++;
  } else if (jsonBody && jsonBody.includes('"per_page":500')) {
    console.log(`⏭️  ${node.name}: уже per_page=500`);
  } else {
    console.log(`⚠️  ${node.name}: не найден per_page в jsonBody`);
  }
});

if (changedCount > 0) {
  // Сохраняем
  writeFileSync(WORKFLOW_FILE, JSON.stringify(workflow, null, 2), 'utf-8');
  console.log(`\n✅ Обновлено ${changedCount} нод`);
  console.log(`📁 Файл: ${WORKFLOW_FILE}`);
} else {
  console.log(`\n⏭️  Изменений не требуется`);
}

