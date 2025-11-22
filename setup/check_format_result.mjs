#!/usr/bin/env node
import 'dotenv/config';

const N8N_HOST = 'https://n8n.rentflow.rentals/api/v1';
const N8N_API_KEY = process.env.N8N_API_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI';
const WORKFLOW_ID = 'P3BnmX7Nrmh1cusF';

async function main() {
  const response = await fetch(`${N8N_HOST}/workflows/${WORKFLOW_ID}`, {
    headers: { 'X-N8N-API-KEY': N8N_API_KEY }
  });
  
  const data = await response.json();
  const workflow = data.data || data;
  
  const formatNode = workflow.nodes.find(n => n.name === 'Format Result');
  
  if (!formatNode) {
    console.log('❌ Format Result нода не найдена!');
    return;
  }
  
  console.log('='.repeat(80));
  console.log('АНАЛИЗ НОДЫ "FORMAT RESULT"');
  console.log('='.repeat(80));
  
  console.log('\nТип ноды:', formatNode.type);
  console.log('Версия:', formatNode.typeVersion);
  
  console.log('\n--- КОД НОДЫ ---\n');
  console.log(formatNode.parameters.jsCode);
  console.log('\n--- КОНЕЦ КОДА ---\n');
  
  console.log('Длина кода:', formatNode.parameters.jsCode?.length, 'символов');
  
  // Анализ проблем
  console.log('\n' + '='.repeat(80));
  console.log('ОБНАРУЖЕННЫЕ ПРОБЛЕМЫ:');
  console.log('='.repeat(80));
  
  const code = formatNode.parameters.jsCode || '';
  
  let issues = [];
  
  // Проверка 1: Отсутствие return
  if (!code.includes('return')) {
    issues.push('❌ КРИТИЧНО: Нет оператора return! Нода будет висеть бесконечно.');
  }
  
  // Проверка 2: Асинхронные операции без await
  if (code.includes('async') && !code.includes('await')) {
    issues.push('⚠️ Есть async но нет await - возможна проблема с завершением.');
  }
  
  // Проверка 3: Бесконечные циклы
  if (code.includes('while(true)') || code.includes('while (true)')) {
    issues.push('❌ КРИТИЧНО: Обнаружен бесконечный цикл while(true)!');
  }
  
  // Проверка 4: Тяжелые операции
  if (code.includes('JSON.stringify') && code.includes('filter')) {
    issues.push('⚠️ Тяжелые операции: JSON.stringify + filter на больших данных.');
  }
  
  // Проверка 5: Множественные циклы
  const forEachCount = (code.match(/forEach/g) || []).length;
  if (forEachCount > 2) {
    issues.push(`⚠️ Слишком много циклов forEach: ${forEachCount} шт.`);
  }
  
  if (issues.length === 0) {
    console.log('\n✅ Явных проблем не обнаружено в коде.');
  } else {
    issues.forEach(issue => console.log('\n' + issue));
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('РЕКОМЕНДАЦИИ:');
  console.log('='.repeat(80));
  
  console.log(`
1. ОБЯЗАТЕЛЬНО должен быть return в конце кода:
   return [{ json: { ... } }];

2. Код должен быть синхронным (без async/await если не нужно).

3. Минимизировать операции на больших массивах (15824 items).

4. Использовать простой подсчёт вместо детального форматирования.

5. Проверить что нода не ждёт каких-то внешних событий.
  `);
}

main().catch(console.error);

