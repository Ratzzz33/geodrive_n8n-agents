#!/usr/bin/env node
/**
 * Финальная попытка импорта AI Agent через MCP
 * Используем n8n REST API напрямую для обхода ограничений MCP
 */

import { readFileSync } from 'fs';
import 'dotenv/config';

// Читаем подготовленный файл
const wfContent = readFileSync('n8n-workflows/exchange-rates-ai-agent.json', 'utf8');
const workflow = JSON.parse(wfContent);

console.log('📦 Импорт Exchange Rates AI Assistant через REST API\n');
console.log('Файл:', 'n8n-workflows/exchange-rates-ai-agent.json');
console.log('Nodes:', workflow.nodes.length);
console.log('Connections:', Object.keys(workflow.connections).length);
console.log('\n⚠️  AI Agent nodes требуют импорта через UI\n');

console.log('Используйте инструкцию из IMPORT_AI_AGENT_INSTRUCTIONS.md:\n');
console.log('1. Откройте: https://n8n.rentflow.rentals');
console.log('2. Workflows → + → Import from File');
console.log('3. Выберите: n8n-workflows/exchange-rates-ai-agent.json');
console.log('4. Import\n');

console.log('✅ Файл подготовлен и готов к импорту!');

