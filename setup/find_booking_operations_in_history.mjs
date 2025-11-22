#!/usr/bin/env node

/**
 * Find booking operations in history parser execution
 */

import fs from 'fs';
import path from 'path';

const executionFile = path.join(process.env.HOME || process.env.USERPROFILE, '.cursor', 'projects', 'c-Users-33pok-geodrive-n8n-agents', 'agent-tools', 'e7d40a15-e333-4605-9188-5d368cf47885.txt');

const missingIds = [
  '514378', '513772', '511419', '515201', '514480', '514303',
  '514030', '513985', '513928', '512915', '512491', '511974', '511520'
];

async function find() {
  try {
    console.log('🔍 Поиск операций по отсутствующим броням в execution...\n');

    if (!fs.existsSync(executionFile)) {
      console.log('❌ Файл execution не найден');
      return;
    }

    const content = fs.readFileSync(executionFile, 'utf-8');
    const data = JSON.parse(content);

    const runData = data.data?.nodes || {};

    // Проверяем ноду "Merge & Process"
    const mergeNode = runData['Merge & Process'];
    if (!mergeNode || !mergeNode.data?.output?.[0]) {
      console.log('❌ Нода "Merge & Process" не найдена или пуста');
      return;
    }

    const items = mergeNode.data.output[0];
    console.log(`Всего операций в "Merge & Process": ${items.length}\n`);

    // Ищем операции по отсутствующим броням
    const found = {};
    const notFound = [];

    missingIds.forEach(id => {
      const foundOps = items.filter(item => {
        const desc = item.json?.description || '';
        const entityId = item.json?.entity_id || '';
        return desc.includes(id) || entityId === id;
      });

      if (foundOps.length > 0) {
        found[id] = foundOps;
        console.log(`✅ Бронь #${id}: найдено ${foundOps.length} операций`);
        foundOps.forEach((op, idx) => {
          console.log(`   [${idx + 1}] ${op.json.operation_type || 'unknown'} | ${op.json.description?.substring(0, 80) || 'N/A'}...`);
          console.log(`      operation_id: ${op.json.operation_id || 'NULL'}`);
          console.log(`      entity_id: ${op.json.entity_id || 'NULL'}`);
          console.log(`      branch: ${op.json.branch || 'NULL'}`);
        });
      } else {
        notFound.push(id);
      }
    });

    console.log('\n' + '═'.repeat(60));
    console.log('📊 РЕЗУЛЬТАТЫ:\n');
    console.log(`Найдено операций: ${Object.keys(found).length} из ${missingIds.length}`);
    console.log(`НЕ найдено: ${notFound.length}`);

    if (notFound.length > 0) {
      console.log('\n❌ Брони без операций в execution:');
      notFound.forEach(id => {
        console.log(`   - #${id}`);
      });
    }

    // Проверяем ноду "Save to History1"
    const saveNode = runData['Save to History1'];
    if (saveNode && saveNode.data?.output?.[0]) {
      const savedItems = saveNode.data.output[0];
      console.log(`\n💾 Сохранено в "Save to History1": ${savedItems.length} записей`);
      
      // Проверяем, какие из найденных операций были сохранены
      Object.keys(found).forEach(id => {
        const ops = found[id];
        console.log(`\nБронь #${id}:`);
        ops.forEach(op => {
          const opId = op.json.operation_id;
          // Проверяем, была ли эта операция сохранена
          // (в summary mode детали сохранения могут быть не видны)
          console.log(`   Операция ${opId}: должна быть сохранена в history`);
        });
      });
    }

    // Итоговый вывод
    console.log('\n' + '═'.repeat(60));
    console.log('📊 ИТОГОВЫЙ ВЫВОД:\n');

    if (Object.keys(found).length > 0) {
      console.log('✅ Некоторые брони найдены в execution');
      console.log('   Операции по этим броням должны быть сохранены в history');
      console.log('   Проверьте таблицу history для этих operation_id');
    }

    if (notFound.length > 0) {
      console.log('\n❌ Некоторые брони НЕ найдены в execution');
      console.log('   Возможные причины:');
      console.log('   1. Операции по этим броням не попали в API ответ');
      console.log('   2. Операции были отфильтрованы');
      console.log('   3. Операции были в более старых страницах (не попали в первые 100)');
    }

  } catch (error) {
    console.error('❌ Ошибка:', error);
    throw error;
  }
}

find().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

