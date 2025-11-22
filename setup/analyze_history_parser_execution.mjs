#!/usr/bin/env node

/**
 * Analyze history parser execution
 */

import fs from 'fs';
import path from 'path';

const executionFile = path.join(process.env.HOME || process.env.USERPROFILE, '.cursor', 'projects', 'c-Users-33pok-geodrive-n8n-agents', 'agent-tools', 'e7d40a15-e333-4605-9188-5d368cf47885.txt');

async function analyze() {
  try {
    console.log('🔍 Анализ execution парсера истории...\n');

    if (!fs.existsSync(executionFile)) {
      console.log('❌ Файл execution не найден');
      return;
    }

    // Читаем файл построчно, чтобы избежать проблем с большим JSON
    const content = fs.readFileSync(executionFile, 'utf-8');
    
    // Парсим JSON
    let data;
    try {
      data = JSON.parse(content);
    } catch (error) {
      console.log('❌ Ошибка парсинга JSON:', error.message);
      return;
    }

    const runData = data.data?.resultData?.runData || {};
    const summary = data.data?.summary || {};

    console.log('📊 Общая информация:\n');
    console.log(`Статус: ${data.data?.status || 'unknown'}`);
    console.log(`Начало: ${data.data?.startedAt || 'unknown'}`);
    console.log(`Окончание: ${data.data?.stoppedAt || 'unknown'}`);
    console.log(`Длительность: ${data.data?.duration || 0}ms`);
    console.log(`Всего нод: ${summary.totalNodes || 0}`);
    console.log(`Выполнено нод: ${summary.executedNodes || 0}`);
    console.log(`Всего items: ${summary.totalItems || 0}`);

    // Проверяем ключевые ноды
    const keyNodes = [
      'Get Tbilisi',
      'Get Batumi',
      'Get Kutaisi',
      'Get Service',
      'Merge & Process',
      'Save to History1',
      'Save to History Audit',
      'Format Result'
    ];

    console.log('\n📋 Статус нод:\n');
    keyNodes.forEach(nodeName => {
      const nodeData = runData[nodeName];
      if (nodeData && nodeData[0]) {
        const nodeInfo = nodeData[0];
        const status = nodeInfo.status || 'unknown';
        const itemsInput = nodeInfo.itemsInput || 0;
        const itemsOutput = nodeInfo.itemsOutput || 0;
        const executionTime = nodeInfo.executionTime || 0;
        
        console.log(`${nodeName}:`);
        console.log(`  Статус: ${status}`);
        console.log(`  Items: ${itemsInput} → ${itemsOutput}`);
        console.log(`  Время: ${executionTime}ms`);
        
        // Проверяем ошибки
        if (nodeInfo.error) {
          console.log(`  ❌ Ошибка: ${nodeInfo.error.message || JSON.stringify(nodeInfo.error)}`);
        }
        console.log('');
      } else {
        console.log(`${nodeName}: ❌ Нода не найдена или не выполнена\n`);
      }
    });

    // Проверяем данные ноды "Format Result"
    const formatNode = runData['Format Result'];
    if (formatNode && formatNode[0]?.data?.output?.[0]?.[0]) {
      const result = formatNode[0].data.output[0][0].json;
      console.log('📊 Результат парсинга:\n');
      console.log(`Сообщение: ${result.message || 'N/A'}`);
      console.log(`Успешно: ${result.success ? '✅' : '❌'}`);
      console.log(`Сохранено: ${result.saved_count || 0}`);
      console.log(`Ошибок: ${result.error_count || 0}`);
      
      if (result.by_branch) {
        console.log('\nПо филиалам:');
        Object.entries(result.by_branch).forEach(([branch, stats]) => {
          console.log(`  ${branch}: ${stats.success} ✓ / ${stats.error} ✗`);
        });
      }
      
      if (result.error_details) {
        console.log('\nДетали ошибок:');
        Object.entries(result.error_details).forEach(([branch, errors]) => {
          console.log(`  ${branch}:`);
          errors.forEach((err, idx) => {
            console.log(`    ${idx + 1}. ${err.reason}: ${err.message}`);
          });
        });
      }
    }

    // Проверяем данные ноды "Merge & Process"
    const mergeNode = runData['Merge & Process'];
    if (mergeNode && mergeNode[0]?.data?.output?.[0]) {
      const items = mergeNode[0].data.output[0];
      console.log(`\n📋 Обработано операций: ${items.length}`);
      
      // Статистика по филиалам
      const byBranch = {};
      items.forEach(item => {
        const branch = item.json?.branch || 'unknown';
        if (!byBranch[branch]) {
          byBranch[branch] = { total: 0, errors: 0, operations: 0 };
        }
        byBranch[branch].total++;
        if (item.json?.error) {
          byBranch[branch].errors++;
        } else if (item.json?.operation_id) {
          byBranch[branch].operations++;
        }
      });
      
      console.log('\nСтатистика по филиалам:');
      Object.entries(byBranch).forEach(([branch, stats]) => {
        console.log(`  ${branch}: ${stats.operations} операций, ${stats.errors} ошибок`);
      });
    }

    // Проверяем данные ноды "Save to History1"
    const saveNode = runData['Save to History1'];
    if (saveNode && saveNode[0]?.data?.output?.[0]) {
      const savedItems = saveNode[0].data.output[0];
      console.log(`\n💾 Сохранено в history: ${savedItems.length} записей`);
      
      // Проверяем ошибки сохранения
      const saveErrors = savedItems.filter(item => item.error || (item.json && item.json.error));
      if (saveErrors.length > 0) {
        console.log(`❌ Ошибок при сохранении: ${saveErrors.length}`);
        saveErrors.slice(0, 5).forEach((err, idx) => {
          console.log(`  ${idx + 1}. ${err.error?.message || JSON.stringify(err.json?.error || err)}`);
        });
      }
    }

    // Проверяем данные ноды "Save to History Audit"
    const auditNode = runData['Save to History Audit'];
    if (auditNode && auditNode[0]?.data?.output?.[0]) {
      const auditItems = auditNode[0].data.output[0];
      console.log(`\n📝 Сохранено в history_audit: ${auditItems.length} записей`);
      
      const auditErrors = auditItems.filter(item => item.error || (item.json && item.json.error));
      if (auditErrors.length > 0) {
        console.log(`❌ Ошибок при сохранении в audit: ${auditErrors.length}`);
      }
    }

    console.log('\n' + '═'.repeat(60));
    console.log('📊 ИТОГОВЫЙ ВЫВОД:\n');
    
    const finalStatus = data.data?.status;
    if (finalStatus === 'success') {
      console.log('✅ Execution завершен успешно');
    } else if (finalStatus === 'error') {
      console.log('❌ Execution завершен с ошибкой');
    } else {
      console.log(`⚠️ Execution статус: ${finalStatus}`);
    }

  } catch (error) {
    console.error('❌ Ошибка:', error);
    throw error;
  }
}

analyze().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

