#!/usr/bin/env node
/**
 * Обновление интервала триггера в Starline API workflow
 */

const N8N_HOST = process.env.N8N_HOST || 'https://n8n.rentflow.rentals/api/v1';
const N8N_API_KEY = process.env.N8N_API_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI';
const WORKFLOW_ID = process.argv[2] || 'NAn9IcFpFuUFib4W';

async function updateInterval() {
  console.log(`🔄 Обновляю интервал триггера в workflow ${WORKFLOW_ID}...\n`);

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

    // Находим Schedule Trigger ноду
    const scheduleNode = workflowData.nodes.find(n => 
      n.type === 'n8n-nodes-base.scheduleTrigger' || 
      n.name?.toLowerCase().includes('minute') ||
      n.name?.toLowerCase().includes('schedule')
    );

    if (!scheduleNode) {
      throw new Error('Schedule Trigger нода не найдена');
    }

    console.log(`🔍 Найдена нода триггера: ${scheduleNode.name}`);
    console.log(`   Текущий интервал: ${scheduleNode.parameters?.rule?.interval?.[0]?.expression || 'не указан'}\n`);

    // Обновляем интервал на 1 минуту
    if (!scheduleNode.parameters) {
      scheduleNode.parameters = {};
    }
    if (!scheduleNode.parameters.rule) {
      scheduleNode.parameters.rule = {};
    }
    if (!scheduleNode.parameters.rule.interval) {
      scheduleNode.parameters.rule.interval = [];
    }

    scheduleNode.parameters.rule.interval = [{
      field: 'cronExpression',
      expression: '*/1 * * * *' // Каждую минуту
    }];

    // Обновляем название ноды
    scheduleNode.name = 'Every 1 Minute';

    console.log(`⚙️  Обновляю интервал на: */1 * * * * (каждую минуту)\n`);

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
    console.log(`   Интервал: каждую минуту (*/1 * * * *)`);
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

updateInterval();

