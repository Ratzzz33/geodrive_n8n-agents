#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const workflowPath = path.join(__dirname, '..', 'n8n-workflows', 'rentprog-car-states-reconciliation-v2.json');
const workflow = JSON.parse(fs.readFileSync(workflowPath, 'utf-8'));

// Исправляем credential ID для "Get Cars from DB" - используем тот же, что и в других Postgres узлах
const getCarsFromDBNode = workflow.nodes.find(n => n.id === 'get-cars-from-db');
if (getCarsFromDBNode && getCarsFromDBNode.credentials) {
  // Используем тот же credential, что и в других Postgres узлах
  getCarsFromDBNode.credentials.postgres = {
    "id": "3I9fyXVlGg4Vl4LZ",
    "name": "PostgreSQL (Neon)"
  };
  console.log('✅ Исправлен credential для "Get Cars from DB"');
}

// Сохраняем
fs.writeFileSync(workflowPath, JSON.stringify(workflow, null, 2), 'utf-8');

console.log('\n✅ Workflow готов к импорту!');
console.log('\n📋 Итоговая структура workflow:');
console.log('   ┌─────────────────────────────────────────────────┐');
console.log('   │  Daily at 04:00 Tbilisi (Cron Trigger)          │');
console.log('   └───────────────┬─────────────────────────────────┘');
console.log('                   │');
console.log('       ┌───────────┴───────────┐');
console.log('       │                       │');
console.log('   ┌───▼───┐            ┌──────▼──────┐');
console.log('   │ Get   │            │ Get Cars    │');
console.log('   │ Token │            │ from DB     │');
console.log('   │ (x4)  │            │             │');
console.log('   └───┬───┘            └──────┬──────┘');
console.log('       │                       │');
console.log('   ┌───▼───┐                   │');
console.log('   │ Get   │                   │');
console.log('   │ Cars  │                   │');
console.log('   │ (x4)  │                   │');
console.log('   └───┬───┘                   │');
console.log('       │                       │');
console.log('   ┌───▼───┐                   │');
console.log('   │Flatten│                   │');
console.log('   │ (x4)  │                   │');
console.log('   └───┬───┘                   │');
console.log('       │                       │');
console.log('   ┌───▼───────────┐           │');
console.log('   │ Merge All     │           │');
console.log('   │ API Cars      │           │');
console.log('   └───┬───────────┘           │');
console.log('       │                       │');
console.log('       └───────────┬───────────┘');
console.log('                   │');
console.log('           ┌───────▼───────┐');
console.log('           │ Compare API   │');
console.log('           │ vs DB         │');
console.log('           └───────┬───────┘');
console.log('                   │');
console.log('           ┌───────▼───────┐');
console.log('           │ Prepare       │');
console.log('           │ Report        │');
console.log('           └───────┬───────┘');
console.log('                   │');
console.log('           ┌───────▼───────┐');
console.log('           │ If Has        │');
console.log('           │ Changes       │');
console.log('           └───────┬───────┘');
console.log('                   │');
console.log('           ┌───────▼───────┐');
console.log('           │ Format Alert  │');
console.log('           └───────┬───────┘');
console.log('                   │');
console.log('           ┌───────▼───────┐');
console.log('           │ Send Telegram │');
console.log('           │ Alert         │');
console.log('           └───────────────┘');
console.log('\n✅ Workflow упрощен:');
console.log('   - Убрано сохранение в БД (Upsert Snapshot, Generate SQL Updates, Apply Updates)');
console.log('   - Оставлено только сравнение и отправка уведомлений');
console.log('   - Обновление БД будет делать скрипт restore_cars_from_rentprog.mjs');

