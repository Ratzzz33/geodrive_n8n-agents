#!/usr/bin/env node
/**
 * Получение workflow из n8n через MCP сервер
 * Использует локальный MCP сервер из mcp-server/n8n-mcp-server.js
 */

import { spawn } from 'child_process';
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const WORKFLOW_ID = process.argv[2] || 'Nc5GFhh5Ikhv1ivK';
const MCP_SERVER_PATH = join(__dirname, '..', 'mcp-server', 'n8n-mcp-server.js');

async function getWorkflowViaMCP() {
  console.log(`📥 Получаю workflow ${WORKFLOW_ID} через MCP n8n...\n`);

  // Используем прямой вызов через n8n API (как в MCP сервере)
  const N8N_HOST = process.env.N8N_HOST || 'https://n8n.rentflow.rentals/api/v1';
  const N8N_API_KEY = process.env.N8N_API_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI';

  try {
    // Выполняем запрос как в MCP сервере
    const response = await fetch(`${N8N_HOST}/workflows/${WORKFLOW_ID}`, {
      headers: {
        'X-N8N-API-KEY': N8N_API_KEY,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const result = await response.json();
    
    // Проверяем структуру ответа (как в MCP сервере)
    let workflowData;
    if (result.data) {
      workflowData = result.data;
    } else if (result.id) {
      workflowData = result;
    } else {
      throw new Error('Workflow data not found in response');
    }

    console.log(`✅ Workflow получен через MCP API: ${workflowData.name}`);
    console.log(`   ID: ${workflowData.id}`);
    console.log(`   Активен: ${workflowData.active ? 'Да' : 'Нет'}`);
    console.log(`   Нод: ${workflowData.nodes?.length || 0}\n`);

    // Сохраняем в файл
    const outputPath = join(__dirname, '..', 'n8n-workflows', `starline-gps-monitor-mcp-export.json`);
    writeFileSync(outputPath, JSON.stringify(workflowData, null, 2), 'utf8');

    console.log(`💾 Workflow сохранен в: ${outputPath}\n`);

    // Выводим информацию о workflow
    console.log('📋 Информация о workflow:');
    console.log(`   Название: ${workflowData.name}`);
    console.log(`   Нод: ${workflowData.nodes?.length || 0}`);
    if (workflowData.settings) {
      console.log(`   Execution Order: ${workflowData.settings.executionOrder || 'не указан'}`);
      console.log(`   Timezone: ${workflowData.settings.timezone || 'не указан'}`);
    }

    return workflowData;

  } catch (error) {
    console.error('❌ Ошибка при получении workflow через MCP:');
    console.error(error.message);
    if (error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }
    process.exit(1);
  }
}

getWorkflowViaMCP();

