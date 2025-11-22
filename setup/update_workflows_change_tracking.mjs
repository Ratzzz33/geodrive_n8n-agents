#!/usr/bin/env node
/**
 * Скрипт для обновления n8n workflows: добавление headers для отслеживания источника изменений
 */

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const WORKFLOWS_DIR = join(__dirname, '..', 'n8n-workflows');

// Workflow и ноды для обновления
const WORKFLOWS_TO_UPDATE = [
  {
    file: 'rentprog-upsert-processor.json',
    nodeId: 'process-event-node',
    nodeName: 'Process Event via Jarvis',
    description: 'Основной workflow обработки событий'
  },
  {
    file: 'rentprog-events-auto-processor.json',
    nodeId: 'process-event',
    nodeName: 'Process Event via Jarvis',
    description: 'Автоматическая обработка событий'
  }
];

function updateHttpRequestNode(node, workflowName) {
  if (node.type !== 'n8n-nodes-base.httpRequest') {
    return false;
  }

  // Проверяем, что это нода для /process-event
  const url = node.parameters?.url || '';
  if (!url.includes('/process-event')) {
    return false;
  }

  console.log(`   ✅ Найдена нода "${node.name}" (${node.id})`);

  // Добавляем headers если их нет
  if (!node.parameters.sendHeaders) {
    node.parameters.sendHeaders = true;
  }

  if (!node.parameters.headerParameters) {
    node.parameters.headerParameters = {};
  }

  if (!node.parameters.headerParameters.parameters) {
    node.parameters.headerParameters.parameters = [];
  }

  // Проверяем, есть ли уже нужные headers
  const existingHeaders = node.parameters.headerParameters.parameters.map(p => p.name);
  const requiredHeaders = ['X-Source', 'X-Workflow-Id', 'X-Workflow-Name', 'X-Execution-Id'];

  let updated = false;

  // Добавляем недостающие headers
  if (!existingHeaders.includes('X-Source')) {
    node.parameters.headerParameters.parameters.push({
      name: 'X-Source',
      value: 'n8n_workflow'
    });
    updated = true;
  }

  if (!existingHeaders.includes('X-Workflow-Id')) {
    node.parameters.headerParameters.parameters.push({
      name: 'X-Workflow-Id',
      value: '={{ $workflow.id }}'
    });
    updated = true;
  }

  if (!existingHeaders.includes('X-Workflow-Name')) {
    node.parameters.headerParameters.parameters.push({
      name: 'X-Workflow-Name',
      value: `={{ $workflow.name || '${workflowName}' }}`
    });
    updated = true;
  }

  if (!existingHeaders.includes('X-Execution-Id')) {
    node.parameters.headerParameters.parameters.push({
      name: 'X-Execution-Id',
      value: '={{ $execution.id }}'
    });
    updated = true;
  }

  // Добавляем eventId в body если его нет
  if (node.parameters.sendBody && node.parameters.bodyParameters) {
    const bodyParams = node.parameters.bodyParameters.parameters || [];
    const hasEventId = bodyParams.some(p => p.name === 'eventId' || p.name === 'event_id');
    
    if (!hasEventId) {
      // Пытаемся найти id из предыдущих нод
      bodyParams.push({
        name: 'eventId',
        value: '={{ $json.id || $json.eventId }}'
      });
      updated = true;
    }
  }

  return updated;
}

async function updateWorkflow(workflowConfig) {
  const filePath = join(WORKFLOWS_DIR, workflowConfig.file);
  
  console.log(`\n📋 Обработка: ${workflowConfig.file}`);
  console.log(`   Описание: ${workflowConfig.description}`);

  try {
    const content = readFileSync(filePath, 'utf-8');
    const workflow = JSON.parse(content);

    let workflowUpdated = false;
    let nodesUpdated = 0;

    // Обновляем ноды
    workflow.nodes.forEach(node => {
      if (node.id === workflowConfig.nodeId || 
          (node.name === workflowConfig.nodeName && node.type === 'n8n-nodes-base.httpRequest')) {
        const updated = updateHttpRequestNode(node, workflow.name);
        if (updated) {
          workflowUpdated = true;
          nodesUpdated++;
          console.log(`   ✅ Нода "${node.name}" обновлена`);
        } else {
          console.log(`   ⚠️  Нода "${node.name}" уже содержит headers`);
        }
      }
    });

    if (workflowUpdated) {
      // Сохраняем обновленный workflow
      const updatedContent = JSON.stringify(workflow, null, 2);
      writeFileSync(filePath, updatedContent, 'utf-8');
      console.log(`   ✅ Workflow сохранен (обновлено нод: ${nodesUpdated})`);
      return true;
    } else {
      console.log(`   ⚠️  Изменений не требуется`);
      return false;
    }

  } catch (error) {
    console.error(`   ❌ Ошибка: ${error.message}`);
    return false;
  }
}

async function main() {
  console.log('🔧 Обновление n8n workflows для отслеживания источника изменений\n');
  console.log(`📁 Директория: ${WORKFLOWS_DIR}\n`);

  let totalUpdated = 0;

  for (const workflowConfig of WORKFLOWS_TO_UPDATE) {
    const updated = await updateWorkflow(workflowConfig);
    if (updated) {
      totalUpdated++;
    }
  }

  console.log(`\n✅ Готово! Обновлено workflow: ${totalUpdated}/${WORKFLOWS_TO_UPDATE.length}`);
  console.log('\n📝 Следующие шаги:');
  console.log('   1. Импортировать обновленные workflow в n8n');
  console.log('   2. Проверить, что headers передаются корректно');
  console.log('   3. Протестировать на реальных данных');
}

main().catch(console.error);

