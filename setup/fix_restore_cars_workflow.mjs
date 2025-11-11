#!/usr/bin/env node
/**
 * Исправление workflow "Обновление данных авто по филиалам раз в 3 часа"
 * Добавляет недостающий параметр operation в Telegram узел
 */

const N8N_HOST = process.env.N8N_HOST || 'https://n8n.rentflow.rentals/api/v1';
const N8N_API_KEY = process.env.N8N_API_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI';

const WORKFLOW_ID = 'TqJ3ZkUWdlRCbaRt';

async function fixWorkflow() {
  try {
    console.log('🔧 Получаю текущий workflow...\n');

    // Получаем текущий workflow
    const getResponse = await fetch(`${N8N_HOST}/workflows/${WORKFLOW_ID}`, {
      method: 'GET',
      headers: {
        'X-N8N-API-KEY': N8N_API_KEY
      }
    });

    if (!getResponse.ok) {
      throw new Error(`HTTP ${getResponse.status}: ${await getResponse.text()}`);
    }

    const workflow = await getResponse.json();
    const wfData = workflow.data || workflow;

    console.log('📋 Текущий workflow получен');
    console.log(`   Название: ${wfData.name || 'N/A'}`);
    console.log(`   Узлов: ${wfData.nodes?.length || 0}\n`);

    // Исправляем Telegram узел
    const telegramNode = wfData.nodes.find(n => n.id === 'send-telegram');
    if (telegramNode) {
      console.log('🔧 Исправляю Telegram узел...');
      
      // Добавляем operation если его нет
      if (!telegramNode.parameters.operation) {
        telegramNode.parameters.operation = 'sendMessage';
        console.log('   ✅ Добавлен параметр operation: sendMessage');
      }

      // Исправляем chatId (убираем "=" в начале если есть)
      if (telegramNode.parameters.chatId && telegramNode.parameters.chatId.startsWith('=')) {
        // Оставляем как есть, это выражение
      } else if (!telegramNode.parameters.chatId || telegramNode.parameters.chatId === '=-5004140602') {
        telegramNode.parameters.chatId = "={{ $env.TELEGRAM_ALERT_CHAT_ID || '-5004140602' }}";
        console.log('   ✅ Исправлен chatId');
      }

      // Исправляем parseMode
      if (telegramNode.parameters.additionalFields) {
        if (!telegramNode.parameters.additionalFields.parse_mode) {
          telegramNode.parameters.additionalFields.parse_mode = 'Markdown';
          console.log('   ✅ Добавлен parse_mode: Markdown');
        }
      } else {
        telegramNode.parameters.additionalFields = {
          parse_mode: 'Markdown'
        };
        console.log('   ✅ Создан additionalFields с parse_mode');
      }
    }

    // Подготавливаем данные для обновления
    const updateData = {
      name: wfData.name,
      nodes: wfData.nodes,
      connections: wfData.connections,
      settings: wfData.settings || { executionOrder: 'v1' }
    };

    console.log('\n💾 Обновляю workflow...\n');

    // Обновляем workflow
    const updateResponse = await fetch(`${N8N_HOST}/workflows/${WORKFLOW_ID}`, {
      method: 'PUT',
      headers: {
        'X-N8N-API-KEY': N8N_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(updateData)
    });

    if (!updateResponse.ok) {
      const errorText = await updateResponse.text();
      throw new Error(`HTTP ${updateResponse.status}: ${errorText}`);
    }

    const result = await updateResponse.json();
    console.log('✅ Workflow успешно обновлен!');
    console.log(`   ID: ${result.data.id}`);
    console.log(`   URL: https://n8n.rentflow.rentals/workflow/${result.data.id}\n`);

    // Валидируем workflow
    console.log('🔍 Проверяю валидность workflow...\n');
    const validateResponse = await fetch(`${N8N_HOST}/workflows/${WORKFLOW_ID}/validate`, {
      method: 'POST',
      headers: {
        'X-N8N-API-KEY': N8N_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(updateData)
    });

    if (validateResponse.ok) {
      const validation = await validateResponse.json();
      if (validation.valid) {
        console.log('✅ Workflow валиден!');
      } else {
        console.log('⚠️  Workflow имеет ошибки:');
        if (validation.errors) {
          validation.errors.forEach(err => {
            console.log(`   - ${err.nodeName}: ${err.message}`);
          });
        }
      }
    }

  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

fixWorkflow();

