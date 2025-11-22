#!/usr/bin/env node

console.log('📤 Создаю workflow для парсинга автомобилей через стандартный импорт...');

// Используем стандартный скрипт импорта
import { readFileSync } from 'fs';
import { execSync } from 'child_process';

try {
  // Читаем созданный workflow
  const workflow = JSON.parse(readFileSync('n8n-workflows/cars-parser-hourly.json', 'utf8'));
  
  // Добавляем уникальные id для всех нод
  workflow.nodes = workflow.nodes.map((node, index) => ({
    ...node,
    id: node.id || `node-${index}-${Date.now()}`
  }));
  
  console.log(`✅ Подготовлено ${workflow.nodes.length} нод`);
  console.log('📝 Запуск импорта через setup/import_workflow_2025.mjs...');
  
  // Используем существующий проверенный скрипт импорта
  const result = execSync('node setup/import_workflow_2025.mjs n8n-workflows/cars-parser-hourly.json', {
    encoding: 'utf-8',
    stdio: 'pipe'
  });
  
  console.log(result);
  console.log('✅ Workflow успешно создан!');
  
} catch (error) {
  console.error('❌ Ошибка:', error.message);
  if (error.stderr) {
    console.error('Stderr:', error.stderr.toString());
  }
  if (error.stdout) {
    console.log('Stdout:', error.stdout.toString());
  }
  process.exit(1);
}

