#!/usr/bin/env node

import fetch from 'node-fetch';

const N8N_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI';
const WORKFLOW_ID = 'w8g8cJb0ccReaqIE';

async function checkWorkflow() {
  try {
    console.log('🔍 Получаю workflow парсинга касс...\n');
    
    const response = await fetch(`https://n8n.rentflow.rentals/api/v1/workflows/${WORKFLOW_ID}`, {
      headers: {
        'X-N8N-API-KEY': N8N_API_KEY
      }
    });
    
    const workflow = await response.json();
    
    console.log('📋 Workflow:', workflow.name);
    console.log('🔄 Active:', workflow.active);
    console.log('📊 Nodes:', workflow.nodes.length);
    console.log('');
    
    // Найти HTTP Request ноды
    const httpNodes = workflow.nodes.filter(n => n.type === 'n8n-nodes-base.httpRequest');
    
    console.log('🌐 HTTP Request nodes:\n');
    httpNodes.forEach(node => {
      console.log(`  📍 ${node.name}:`);
      console.log(`     URL: ${node.parameters?.url || 'N/A'}`);
      
      // Извлечь per_page из jsonBody
      if (node.parameters?.jsonBody) {
        const jsonBody = node.parameters.jsonBody;
        const perPageMatch = jsonBody.match(/"per_page"\s*:\s*(\d+)/);
        const pageMatch = jsonBody.match(/"page"\s*:\s*(\d+)/);
        
        if (perPageMatch) {
          console.log(`     per_page: ${perPageMatch[1]}`);
        }
        if (pageMatch) {
          console.log(`     page: ${pageMatch[1]}`);
        }
      }
      console.log('');
    });
    
    // Проверить последние executions
    console.log('⏱️ Проверяю последние executions...\n');
    
    const execResponse = await fetch(`https://n8n.rentflow.rentals/api/v1/executions?workflowId=${WORKFLOW_ID}&limit=5`, {
      headers: {
        'X-N8N-API-KEY': N8N_API_KEY
      }
    });
    
    const execData = await execResponse.json();
    
    if (execData.data && execData.data.length > 0) {
      console.log('📊 Последние 5 executions:\n');
      execData.data.forEach((exec, idx) => {
        console.log(`  [${idx + 1}] Execution #${exec.id}`);
        console.log(`      Status: ${exec.status}`);
        console.log(`      Started: ${exec.startedAt}`);
        console.log(`      Stopped: ${exec.stoppedAt || 'N/A'}`);
        console.log('');
      });
    } else {
      console.log('❌ Нет executions для этого workflow');
    }
    
  } catch (error) {
    console.error('❌ Ошибка:', error);
    process.exit(1);
  }
}

checkWorkflow();

