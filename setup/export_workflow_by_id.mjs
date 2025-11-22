#!/usr/bin/env node
/**
 * Экспорт workflow по ID в локальный файл (JSON)
 * Используется когда MCP недоступен и нужно аккуратно обновить workflow.
 */

import fetch from 'node-fetch';
import { writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const N8N_HOST = process.env.N8N_HOST || 'https://n8n.rentflow.rentals/api/v1';
const N8N_API_KEY =
  process.env.N8N_API_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI';

const headers = {
  'X-N8N-API-KEY': N8N_API_KEY,
  'Content-Type': 'application/json',
};

async function exportWorkflow(workflowId, outputPath) {
  if (!workflowId) {
    throw new Error('Не указан ID workflow. Пример: node setup/export_workflow_by_id.mjs <workflowId>');
  }

  console.log(`🔍 Получаю workflow ${workflowId}...`);

  const response = await fetch(`${N8N_HOST}/workflows/${workflowId}`, {
    method: 'GET',
    headers,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`HTTP ${response.status}: ${response.statusText}\n${text}`);
  }

  const json = await response.json();
  const workflow = json.data || json; // GET /workflows/:id возвращает объект напрямую

  const safeName = workflow.name.replace(/[^\w\-]+/g, '_');
  const targetPath =
    outputPath ||
    join(__dirname, '..', 'n8n-workflows', `${safeName}_${workflowId}.json`);

  mkdirSync(dirname(targetPath), { recursive: true });
  writeFileSync(targetPath, JSON.stringify(workflow, null, 2), 'utf8');

  console.log(`✅ Workflow сохранен в ${targetPath}`);
  return targetPath;
}

const workflowId = process.argv[2];
const outputPath = process.argv[3];

exportWorkflow(workflowId, outputPath).catch((error) => {
  console.error('❌ Ошибка при экспорте workflow:', error.message);
  process.exit(1);
});

