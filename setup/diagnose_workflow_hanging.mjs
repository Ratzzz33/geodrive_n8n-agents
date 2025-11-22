#!/usr/bin/env node
import 'dotenv/config';

const N8N_HOST = 'https://n8n.rentflow.rentals/api/v1';
const N8N_API_KEY = process.env.N8N_API_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi5mil074-cMhnuJJLI5lN6MP7FQEcI';
const WORKFLOW_ID = 'P3BnmX7Nrmh1cusF';

async function main() {
  console.log('='.repeat(80));
  console.log('ДИАГНОСТИКА ЗАВИСАНИЯ WORKFLOW');
  console.log('='.repeat(80));
  
  // Получить workflow
  const wfResponse = await fetch(`${N8N_HOST}/workflows/${WORKFLOW_ID}`, {
    headers: { 'X-N8N-API-KEY': N8N_API_KEY }
  });
  const wfData = await wfResponse.json();
  const workflow = wfData.data || wfData;
  
  console.log(`\nWorkflow: "${workflow.name}"`);
  console.log(`Active: ${workflow.active}`);
  console.log(`Total nodes: ${workflow.nodes.length}`);
  
  // Получить последний execution
  const execResponse = await fetch(`${N8N_HOST}/executions?workflowId=${WORKFLOW_ID}&limit=1`, {
    headers: { 'X-N8N-API-KEY': N8N_API_KEY }
  });
  const execData = await execResponse.json();
  const lastExecution = execData.data?.[0];
  
  if (!lastExecution) {
    console.log('\n❌ Нет executions для анализа');
    return;
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('ПОСЛЕДНИЙ EXECUTION');
  console.log('='.repeat(80));
  console.log(`ID: ${lastExecution.id}`);
  console.log(`Status: ${lastExecution.status}`);
  console.log(`Started: ${lastExecution.startedAt}`);
  console.log(`Stopped: ${lastExecution.stoppedAt || 'RUNNING...'}`);
  
  if (lastExecution.status === 'running') {
    const startTime = new Date(lastExecution.startedAt);
    const now = new Date();
    const duration = Math.floor((now - startTime) / 1000);
    console.log(`Duration: ${duration}s (${Math.floor(duration / 60)}m ${duration % 60}s)`);
  }
  
  // Проанализировать connections
  console.log('\n' + '='.repeat(80));
  console.log('АНАЛИЗ CONNECTIONS');
  console.log('='.repeat(80));
  
  const formatNode = workflow.nodes.find(n => n.name === 'Format Result');
  const ifErrorNode = workflow.nodes.find(n => n.name === 'If Error');
  const successNode = workflow.nodes.find(n => n.name === 'Success');
  const sendAlertNode = workflow.nodes.find(n => n.name === 'Send Alert');
  
  console.log('\nНоды:');
  console.log(`  Format Result: ${formatNode ? '✅' : '❌'}`);
  console.log(`  If Error: ${ifErrorNode ? '✅' : '❌'}`);
  console.log(`  Success: ${successNode ? '✅' : '❌'}`);
  console.log(`  Send Alert: ${sendAlertNode ? '✅' : '❌'}`);
  
  // Проверить connections от Format Result
  const formatConnections = workflow.connections['Format Result'];
  console.log('\n--- Connections от "Format Result" ---');
  if (formatConnections) {
    console.log(JSON.stringify(formatConnections, null, 2));
  } else {
    console.log('❌ НЕТ CONNECTIONS!');
  }
  
  // Проверить connections от If Error
  const ifErrorConnections = workflow.connections['If Error'];
  console.log('\n--- Connections от "If Error" ---');
  if (ifErrorConnections) {
    console.log(JSON.stringify(ifErrorConnections, null, 2));
  } else {
    console.log('⚠️ Нет connections (возможно конечная нода)');
  }
  
  // Проверить If Error настройки
  if (ifErrorNode) {
    console.log('\n--- Настройки "If Error" ---');
    console.log('Type:', ifErrorNode.type);
    console.log('Parameters:', JSON.stringify(ifErrorNode.parameters, null, 2));
  }
  
  // Найти ноды без исходящих connections
  console.log('\n' + '='.repeat(80));
  console.log('НОДЫ БЕЗ ИСХОДЯЩИХ CONNECTIONS (тупики):');
  console.log('='.repeat(80));
  
  const nodesWithoutOutput = workflow.nodes.filter(node => {
    const conns = workflow.connections[node.name];
    return !conns || Object.keys(conns).length === 0;
  });
  
  if (nodesWithoutOutput.length > 0) {
    nodesWithoutOutput.forEach(node => {
      console.log(`  - ${node.name} (${node.type})`);
    });
  } else {
    console.log('  Все ноды имеют исходящие connections');
  }
  
  // ДИАГНОЗ
  console.log('\n' + '='.repeat(80));
  console.log('🔍 ДИАГНОЗ:');
  console.log('='.repeat(80));
  
  let issues = [];
  
  if (!formatConnections) {
    issues.push('❌ КРИТИЧНО: Format Result НЕ подключена к следующим нодам!');
  }
  
  if (formatConnections && !formatConnections.main) {
    issues.push('❌ КРИТИЧНО: Format Result не имеет main connections!');
  }
  
  if (lastExecution.status === 'running') {
    issues.push('⚠️ Execution до сих пор в статусе "running"');
  }
  
  if (nodesWithoutOutput.length === 0) {
    issues.push('⚠️ Нет нод-тупиков - может быть циклическая зависимость?');
  }
  
  if (issues.length > 0) {
    issues.forEach(issue => console.log('\n' + issue));
  } else {
    console.log('\n✅ Явных проблем в структуре не обнаружено');
    console.log('   Возможно проблема в логике самих нод или timeout');
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('РЕКОМЕНДАЦИИ:');
  console.log('='.repeat(80));
  console.log(`
1. Проверь что Format Result подключена к If Error
2. Проверь что If Error имеет два выхода (true → Send Alert, false → Success)
3. Проверь что Success и Send Alert - конечные ноды (без исходящих)
4. Если execution висит > 5 минут - останови его вручную
5. Проверь настройки timeout в Settings workflow
  `);
}

main().catch(console.error);

