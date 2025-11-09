/**
 * Добавление execution_id и execution_url в N8N processor workflows
 */

import fs from 'fs';
import path from 'path';

const WORKFLOWS_DIR = 'n8n-workflows';
const PROCESSOR_WORKFLOWS = [
  'service-center-processor.json',
  'tbilisi-processor.json',
  'batumi-processor.json',
  'kutaisi-processor.json'
];

function updateWorkflow(workflowPath) {
  console.log(`\n📝 Обновление: ${path.basename(workflowPath)}`);
  
  const content = fs.readFileSync(workflowPath, 'utf8');
  const workflow = JSON.parse(content);
  
  let updated = false;

  // 1. Обновляем "Parse Webhook" ноду - добавляем execution данные
  const parseWebhookNode = workflow.nodes.find(n => n.name === 'Parse Webhook');
  if (parseWebhookNode) {
    console.log('   ✓ Нашли ноду "Parse Webhook"');
    
    // Проверяем, есть ли уже упоминание execution_id в коде
    if (!parseWebhookNode.parameters.jsCode.includes('execution_id')) {
      console.log('   → Добавляем execution_id и execution_url в return statement');
      
      // Добавляем в return statement
      const oldCode = parseWebhookNode.parameters.jsCode;
      const newCode = oldCode.replace(
        /return\s+\{\s+json:\s+\{/,
        `return {
  json: {
    execution_id: $execution.id,
    execution_url: \`\${$env.N8N_HOST || 'https://n8n.rentflow.rentals'}/workflow/\${$workflow.id}/executions/\${$execution.id}\`,`
      );
      
      parseWebhookNode.parameters.jsCode = newCode;
      updated = true;
      console.log('   ✅ Код обновлен');
    } else {
      console.log('   ⚠️  execution_id уже есть в коде');
    }
  }

  // 2. Обновляем "Save to Events" ноду - добавляем новые колонки в SQL
  const saveToEventsNode = workflow.nodes.find(n => n.name === 'Save to Events');
  if (saveToEventsNode) {
    console.log('   ✓ Нашли ноду "Save to Events"');
    
    const currentQuery = saveToEventsNode.parameters.query;
    
    if (!currentQuery.includes('execution_id')) {
      console.log('   → Добавляем execution_id и execution_url в SQL');
      
      // Обновляем SQL запрос
      const newQuery = currentQuery
        .replace(
          'event_hash,\n  processed',
          'event_hash,\n  execution_id,\n  execution_url,\n  processed'
        )
        .replace(
          'VALUES (\n  $1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9, false',
          'VALUES (\n  $1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9, $10, $11, false'
        );
      
      saveToEventsNode.parameters.query = newQuery;
      
      // Обновляем queryReplacement
      const currentReplacement = saveToEventsNode.parameters.options.queryReplacement;
      const newReplacement = currentReplacement.replace(
        ',={{ $json.event_hash }}',
        ',={{ $json.event_hash }},={{ $json.execution_id }},={{ $json.execution_url }}'
      );
      
      saveToEventsNode.parameters.options.queryReplacement = newReplacement;
      
      updated = true;
      console.log('   ✅ SQL запрос обновлен');
    } else {
      console.log('   ⚠️  execution_id уже есть в SQL');
    }
  }

  // Сохраняем обновленный workflow
  if (updated) {
    fs.writeFileSync(workflowPath, JSON.stringify(workflow, null, 2), 'utf8');
    console.log('   💾 Файл сохранен');
    return true;
  } else {
    console.log('   ⏭️  Изменения не требуются');
    return false;
  }
}

// Обрабатываем все processor workflows
console.log('🔧 Добавление execution tracking в processor workflows\n');
console.log('=' .repeat(60));

let updatedCount = 0;

for (const workflowFile of PROCESSOR_WORKFLOWS) {
  const workflowPath = path.join(WORKFLOWS_DIR, workflowFile);
  
  if (fs.existsSync(workflowPath)) {
    const wasUpdated = updateWorkflow(workflowPath);
    if (wasUpdated) updatedCount++;
  } else {
    console.log(`\n⚠️  Файл не найден: ${workflowPath}`);
  }
}

console.log('\n' + '='.repeat(60));
console.log(`\n✅ Обработано: ${PROCESSOR_WORKFLOWS.length} workflows`);
console.log(`   Обновлено: ${updatedCount}`);
console.log(`   Пропущено: ${PROCESSOR_WORKFLOWS.length - updatedCount}\n`);

console.log('📋 Следующие шаги:');
console.log('   1. Проверьте изменения в git diff');
console.log('   2. Загрузите обновленные workflows в N8N');
console.log('   3. Активируйте workflows');
console.log('   4. Проверьте, что новые события содержат execution_id и execution_url\n');

console.log('💡 Для загрузки в N8N:');
console.log('   python setup/update_workflows_via_api.py\n');

console.log('🔍 Для проверки:');
console.log(`   SELECT 
     id,
     event_name,
     rentprog_id,
     execution_id,
     execution_url
   FROM events
   WHERE execution_id IS NOT NULL
   ORDER BY id DESC
   LIMIT 5;`);


