#!/usr/bin/env node

/**
 * Find missing bookings in execution data
 */

import fs from 'fs';
import path from 'path';

const executionFile = path.join(process.env.HOME || process.env.USERPROFILE, '.cursor', 'projects', 'c-Users-33pok-geodrive-n8n-agents', 'agent-tools', '78197483-d4b6-4097-917e-32faf9e2e20d.txt');

const missingIds = [
  '514378', '513772', '511419', '515201', '514480', '514303',
  '514030', '513985', '513928', '512915', '512491', '511974', '511520'
];

async function find() {
  try {
    console.log('🔍 Поиск отсутствующих броней в execution...\n');

    if (!fs.existsSync(executionFile)) {
      console.log('❌ Файл execution не найден');
      return;
    }

    const content = fs.readFileSync(executionFile, 'utf-8');
    const data = JSON.parse(content);

    const runData = data.data?.resultData?.runData || {};

    // Проверить каждую ноду
    const nodesToCheck = [
      'Get Tbilisi Active',
      'Get Batumi Active',
      'Get Kutaisi Active',
      'Get Service Active',
      'Process All Bookings',
      'Save to DB'
    ];

    const foundInNodes = {};
    const notFoundInNodes = {};

    missingIds.forEach(id => {
      foundInNodes[id] = [];
      notFoundInNodes[id] = [];
    });

    nodesToCheck.forEach(nodeName => {
      const nodeData = runData[nodeName];
      if (!nodeData || !nodeData[0]?.data?.main?.[0]) {
        console.log(`⚠️ Нода "${nodeName}" не найдена или пуста`);
        return;
      }

      const items = nodeData[0].data.main[0];
      console.log(`\n📋 Нода "${nodeName}": ${items.length} items`);

      missingIds.forEach(id => {
        const found = items.some(item => {
          const json = item.json;
          
          // Проверка в разных форматах
          if (json.id === id || json.id === Number(id)) return true;
          if (json.rentprog_id === id || json.rentprog_id === String(id)) return true;
          if (json.number === id || json.number === Number(id)) return true;
          
          // Проверка в вложенных структурах
          if (json.bookings?.data) {
            return json.bookings.data.some(b => 
              b.id === id || b.id === Number(id) || 
              b.attributes?.id === id || b.attributes?.id === Number(id)
            );
          }
          
          if (json.attributes) {
            return json.attributes.id === id || json.attributes.id === Number(id);
          }
          
          if (json.data) {
            const dataObj = typeof json.data === 'string' ? JSON.parse(json.data) : json.data;
            return dataObj.id === id || dataObj.id === Number(id);
          }
          
          return false;
        });

        if (found) {
          foundInNodes[id].push(nodeName);
        } else {
          notFoundInNodes[id].push(nodeName);
        }
      });
    });

    // Итоговый отчет
    console.log('\n' + '═'.repeat(60));
    console.log('📊 РЕЗУЛЬТАТЫ ПОИСКА:\n');

    missingIds.forEach(id => {
      if (foundInNodes[id].length > 0) {
        console.log(`✅ Бронь #${id}:`);
        console.log(`   Найдена в нодах: ${foundInNodes[id].join(', ')}`);
        
        // Проверить, в какой ноде потерялась
        const allNodes = ['Get Tbilisi Active', 'Get Batumi Active', 'Get Kutaisi Active', 'Get Service Active', 'Process All Bookings', 'Save to DB'];
        const lostIn = allNodes.filter(n => 
          !foundInNodes[id].includes(n) && 
          allNodes.indexOf(n) > allNodes.indexOf(foundInNodes[id][foundInNodes[id].length - 1])
        );
        
        if (lostIn.length > 0) {
          console.log(`   ❌ Потеряна после: ${lostIn.join(' → ')}`);
        }
      } else {
        console.log(`❌ Бронь #${id}: НЕ найдена ни в одной ноде`);
      }
      console.log('');
    });

    // Статистика
    const foundCount = missingIds.filter(id => foundInNodes[id].length > 0).length;
    const notFoundCount = missingIds.filter(id => foundInNodes[id].length === 0).length;

    console.log('═'.repeat(60));
    console.log('📊 СТАТИСТИКА:\n');
    console.log(`Всего проверено: ${missingIds.length}`);
    console.log(`Найдено в execution: ${foundCount}`);
    console.log(`НЕ найдено в execution: ${notFoundCount}`);

    // Детальный анализ для первой найденной брони
    const firstFound = missingIds.find(id => foundInNodes[id].length > 0);
    if (firstFound) {
      console.log(`\n🔍 Детальный анализ брони #${firstFound}:`);
      
      // Найти данные в ноде "Process All Bookings"
      const processNode = runData['Process All Bookings'];
      if (processNode && processNode[0]?.data?.main?.[0]) {
        const processItems = processNode[0].data.main[0];
        const bookingItem = processItems.find(item => {
          const json = item.json;
          return json.rentprog_id === firstFound || json.rentprog_id === String(firstFound);
        });
        
        if (bookingItem) {
          console.log(`\n✅ Найдена в "Process All Bookings":`);
          console.log(`   rentprog_id: ${bookingItem.json.rentprog_id}`);
          console.log(`   number: ${bookingItem.json.number}`);
          console.log(`   branch: ${bookingItem.json.branch}`);
          console.log(`   start_at: ${bookingItem.json.start_at}`);
          console.log(`   end_at: ${bookingItem.json.end_at}`);
        }
      }
      
      // Проверить "Save to DB"
      const saveNode = runData['Save to DB'];
      if (saveNode && saveNode[0]?.data?.main?.[0]) {
        const saveItems = saveNode[0].data.main[0];
        const savedItem = saveItems.find(item => {
          const json = item.json;
          return json.rentprog_id === firstFound || json.rentprog_id === String(firstFound);
        });
        
        if (savedItem) {
          console.log(`\n✅ Найдена в "Save to DB":`);
          console.log(`   rentprog_id: ${savedItem.json.rentprog_id}`);
        } else {
          console.log(`\n❌ НЕ найдена в "Save to DB" - потеряна при сохранении!`);
        }
      }
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

