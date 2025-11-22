#!/usr/bin/env node
/**
 * Обновление аутентификации в Starline API workflow
 * Исправляет authentication согласно правилам n8n 2025
 */

const N8N_HOST = process.env.N8N_HOST || 'https://n8n.rentflow.rentals/api/v1';
const N8N_API_KEY = process.env.N8N_API_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI';
const WORKFLOW_ID = process.argv[2] || 'NAn9IcFpFuUFib4W';

async function updateAuth() {
  console.log(`🔧 Обновляю аутентификацию в workflow ${WORKFLOW_ID}...\n`);

  try {
    // Получаем текущий workflow
    const getResponse = await fetch(`${N8N_HOST}/workflows/${WORKFLOW_ID}`, {
      headers: {
        'X-N8N-API-KEY': N8N_API_KEY
      }
    });

    if (!getResponse.ok) {
      throw new Error(`Ошибка получения workflow: ${getResponse.statusText}`);
    }

    const workflow = await getResponse.json();
    const workflowData = workflow.data || workflow;

    console.log(`📄 Workflow: ${workflowData.name}`);
    console.log(`   Нод: ${workflowData.nodes?.length || 0}\n`);

    let updated = false;

    // Обновляем все HTTP Request ноды
    workflowData.nodes = workflowData.nodes.map(node => {
      if (node.type === 'n8n-nodes-base.httpRequest') {
        const params = node.parameters || {};
        
        // Проверяем, есть ли genericCredentialType
        if (params.authentication === 'genericCredentialType' || params.genericAuthType) {
          console.log(`   🔧 Исправляю ноду: ${node.name}`);
          console.log(`      Было: authentication = ${params.authentication}, genericAuthType = ${params.genericAuthType}`);
          
          // Убираем genericCredentialType
          delete params.genericAuthType;
          
          // Устанавливаем authentication: "none" если используется динамический токен через headers
          if (params.sendHeaders && params.headerParameters?.parameters?.some(p => p.name === 'Authorization')) {
            params.authentication = 'none';
            console.log(`      Стало: authentication = "none" (токен через headers)`);
          } else {
            params.authentication = 'none';
            console.log(`      Стало: authentication = "none"`);
          }
          
          updated = true;
        }
      }
      return node;
    });

    if (!updated) {
      console.log('✅ Все ноды уже правильно настроены\n');
      return;
    }

    console.log('\n⚙️  Обновляю workflow...\n');

    // Обновляем workflow
    const updateResponse = await fetch(`${N8N_HOST}/workflows/${WORKFLOW_ID}`, {
      method: 'PUT',
      headers: {
        'X-N8N-API-KEY': N8N_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: workflowData.name,
        nodes: workflowData.nodes,
        connections: workflowData.connections,
        settings: workflowData.settings
      })
    });

    if (!updateResponse.ok) {
      const errorText = await updateResponse.text();
      throw new Error(`Ошибка обновления workflow: ${updateResponse.status} - ${errorText}`);
    }

    console.log(`✅ Workflow обновлен успешно!`);
    console.log(`   Аутентификация исправлена согласно правилам n8n 2025`);
    console.log(`   URL: https://n8n.rentflow.rentals/workflow/${WORKFLOW_ID}\n`);

  } catch (error) {
    console.error('❌ Ошибка при обновлении workflow:');
    console.error(error.message);
    if (error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }
    process.exit(1);
  }
}

updateAuth();

