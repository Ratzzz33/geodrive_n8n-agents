#!/usr/bin/env node

/**
 * Detailed check of execution nodes
 */

import fs from 'fs';
import path from 'path';

const executionFile = path.join(process.env.HOME || process.env.USERPROFILE, '.cursor', 'projects', 'c-Users-33pok-geodrive-n8n-agents', 'agent-tools', 'e7d40a15-e333-4605-9188-5d368cf47885.txt');

async function check() {
  try {
    console.log('🔍 Детальная проверка нод execution...\n');

    if (!fs.existsSync(executionFile)) {
      console.log('❌ Файл execution не найден');
      return;
    }

    const content = fs.readFileSync(executionFile, 'utf-8');
    const data = JSON.parse(content);

    // Проверяем структуру данных
    console.log('Структура данных:');
    console.log(`  data.data: ${!!data.data}`);
    console.log(`  data.data.nodes: ${!!data.data?.nodes}`);
    console.log(`  data.data.resultData: ${!!data.data?.resultData}`);
    console.log(`  data.data.resultData?.runData: ${!!data.data?.resultData?.runData}`);
    
    // В summary mode данные в data.data.nodes
    const runData = data.data?.nodes || data.data?.resultData?.runData || {};
    console.log(`\nНайдено нод в runData: ${Object.keys(runData).length}`);
    console.log(`Ноды: ${Object.keys(runData).join(', ')}`);

    // Проверяем ключевые ноды
    const keyNodes = ['Get Tbilisi', 'Get Batumi', 'Get Kutaisi', 'Get Service', 'Merge & Process', 'Save to History1', 'Format Result'];
    
    keyNodes.forEach(nodeName => {
      const nodeData = runData[nodeName];
      if (nodeData) {
        const nodeInfo = nodeData;
        console.log(`\n📋 ${nodeName}:`);
        console.log(`  Статус: ${nodeInfo.status || 'unknown'}`);
        console.log(`  Items: ${nodeInfo.itemsInput || 0} → ${nodeInfo.itemsOutput || 0}`);
        console.log(`  Время: ${nodeInfo.executionTime || 0}ms`);
        
        // Проверяем наличие данных
        if (nodeInfo.data?.output) {
          const output = nodeInfo.data.output;
          console.log(`  Output массивов: ${output.length}`);
          if (output[0] && output[0].length) {
            console.log(`  Items в первом массиве: ${output[0].length}`);
            
            // Для "Merge & Process" ищем операции по броням
            if (nodeName === 'Merge & Process') {
              const bookingOps = output[0].filter(item => {
                const desc = item.json?.description || '';
                return desc.includes('бронь') || desc.includes('booking');
              });
              console.log(`  Операций по броням: ${bookingOps.length}`);
              
              // Ищем конкретные брони
              const missingIds = ['514378', '513772', '511419', '515201', '514480', '514303', '514030', '513985', '513928', '512915', '512491', '511974', '511520'];
              missingIds.forEach(id => {
                const found = output[0].some(item => {
                  const desc = item.json?.description || '';
                  return desc.includes(id);
                });
                if (found) {
                  console.log(`    ✅ Найдена операция для брони #${id}`);
                }
              });
            }
            
            // Показываем первый item для примера
            if (output[0][0]?.json) {
              const keys = Object.keys(output[0][0].json);
              console.log(`  Ключи в первом item: ${keys.slice(0, 10).join(', ')}${keys.length > 10 ? '...' : ''}`);
            }
          }
        }
        
        if (nodeInfo.error) {
          console.log(`  ❌ Ошибка: ${nodeInfo.error.message || JSON.stringify(nodeInfo.error)}`);
        }
      } else {
        console.log(`\n📋 ${nodeName}: ❌ Нода не найдена`);
      }
    });

    // Специальная проверка для "Format Result"
    const formatNode = runData['Format Result'];
    if (formatNode && formatNode[0]?.data?.output?.[0]?.[0]?.json) {
      const result = formatNode[0].data.output[0][0].json;
      console.log('\n' + '═'.repeat(60));
      console.log('📊 РЕЗУЛЬТАТ ПАРСИНГА:\n');
      console.log(result.message || 'N/A');
      console.log(`\nУспешно: ${result.success ? '✅' : '❌'}`);
      console.log(`Сохранено: ${result.saved_count || 0}`);
      console.log(`Ошибок: ${result.error_count || 0}`);
    }

  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    if (error.stack) {
      console.error('Stack:', error.stack.split('\n').slice(0, 5).join('\n'));
    }
  }
}

check().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

