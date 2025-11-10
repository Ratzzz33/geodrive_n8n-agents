#!/usr/bin/env node
/**
 * Создать оптимизированный Umnico workflow в n8n
 */

import fs from 'fs';

// Читаем workflow
const workflowFile = fs.readFileSync('n8n-workflows/umnico-chat-scraper-optimized.json', 'utf-8');
const workflow = JSON.parse(workflowFile);

// Формируем команду для импорта через curl
const N8N_HOST = 'https://n8n.rentflow.rentals';
const N8N_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI';

// Подготовить payload
const payload = {
  name: workflow.name,
  nodes: workflow.nodes,
  connections: workflow.connections,
  settings: workflow.settings || { executionOrder: 'v1' },
  tags: workflow.tags
};

// Записать во временный файл для curl
fs.writeFileSync('/tmp/workflow.json', JSON.stringify(payload, null, 2));

console.log(`
📝 Workflow готов для импорта
   
Запустите в терминале:

curl -X POST "${N8N_HOST}/api/v1/workflows" \\
  -H "X-N8N-API-KEY: ${N8N_API_KEY}" \\
  -H "Content-Type: application/json" \\
  -d @/tmp/workflow.json

Или используйте PowerShell:

python setup/server_ssh.py "cd /root/geodrive_n8n-agents && node create_umnico_workflow.mjs"
`);

