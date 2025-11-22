#!/usr/bin/env node

/**
 * Analyze execution data to find which bookings were processed
 */

import fs from 'fs';
import path from 'path';

const executionFile = path.join(process.env.HOME || process.env.USERPROFILE, '.cursor', 'projects', 'c-Users-33pok-geodrive-n8n-agents', 'agent-tools', '78197483-d4b6-4097-917e-32faf9e2e20d.txt');

const missingIds = [
  '515042', '515008', '514944', '514378', '513772', '511419',
  '515310', '515285', '515271', '515201', '515117', '515049',
  '514919', '514480', '514303', '514030', '513985', '513928',
  '512915', '512491', '511974', '511520'
];

async function analyze() {
  try {
    console.log('🔍 Анализ execution данных...\n');

    if (!fs.existsSync(executionFile)) {
      console.log('❌ Файл execution не найден');
      console.log(`   Путь: ${executionFile}`);
      return;
    }

    const content = fs.readFileSync(executionFile, 'utf-8');
    const data = JSON.parse(content);

    // Найти ноду "Process All Bookings"
    const processNode = data.data?.resultData?.runData?.['Process All Bookings'];
    if (!processNode) {
      console.log('❌ Нода "Process All Bookings" не найдена');
      return;
    }

    const output = processNode[0]?.data?.main?.[0];
    if (!output) {
      console.log('❌ Данные ноды "Process All Bookings" не найдены');
      return;
    }

    console.log(`✅ Найдено записей в ноде: ${output.length}\n`);

    // Проверить, какие брони из missingIds есть в execution
    const foundInExecution = [];
    const notFoundInExecution = [];

    missingIds.forEach(id => {
      const found = output.some(item => {
        const json = item.json;
        return json.rentprog_id === id || 
               json.rentprog_id === String(id) ||
               json.number === id ||
               (json.data && (json.data.id === id || json.data.id === Number(id)));
      });

      if (found) {
        foundInExecution.push(id);
      } else {
        notFoundInExecution.push(id);
      }
    });

    console.log('📊 Результаты проверки:\n');
    console.log(`✅ Найдено в execution: ${foundInExecution.length}`);
    foundInExecution.forEach(id => {
      console.log(`   - #${id}`);
    });

    console.log(`\n❌ НЕ найдено в execution: ${notFoundInExecution.length}`);
    notFoundInExecution.forEach(id => {
      console.log(`   - #${id}`);
    });

    // Проверить ноду "Save to DB"
    const saveNode = data.data?.resultData?.runData?.['Save to DB'];
    if (saveNode) {
      const saveOutput = saveNode[0]?.data?.main?.[0];
      if (saveOutput) {
        console.log(`\n📋 Сохранено в БД: ${saveOutput.length} записей`);
        
        // Проверить, какие из missingIds были сохранены
        const savedIds = [];
        saveOutput.forEach(item => {
          const json = item.json;
          const id = json.rentprog_id || json.number;
          if (id && missingIds.includes(String(id))) {
            savedIds.push(String(id));
          }
        });

        if (savedIds.length > 0) {
          console.log(`\n✅ Сохранены в БД (из missingIds): ${savedIds.length}`);
          savedIds.forEach(id => {
            console.log(`   - #${id}`);
          });
        }
      }
    }

    // Проверить пропущенные брони
    const skippedNode = data.data?.resultData?.runData?.['Check Skipped Bookings'];
    if (skippedNode) {
      const skippedOutput = skippedNode[0]?.data?.main?.[0];
      if (skippedOutput) {
        skippedOutput.forEach(item => {
          if (item.json._skipped_bookings) {
            const skipped = item.json._skipped_bookings;
            console.log(`\n⚠️ Пропущенные брони: ${skipped.length}`);
            skipped.forEach((booking, idx) => {
              console.log(`   ${idx + 1}. ${booking.reason}`);
              console.log(`      Филиал: ${booking.branch}`);
              console.log(`      Клиент: ${booking.client_name}`);
              console.log(`      Авто: ${booking.car_name}`);
            });
          }
        });
      }
    }

    // Итоговый вывод
    console.log('\n' + '═'.repeat(60));
    console.log('📊 ИТОГОВЫЙ ВЫВОД:\n');

    if (notFoundInExecution.length > 0) {
      console.log('❌ ПРОБЛЕМА: Брони не попали в execution');
      console.log('\nВозможные причины:');
      console.log('   1. Брони не были получены из RentProg API');
      console.log('   2. Брони были отфильтрованы в ноде "Process All Bookings"');
      console.log('   3. Брони не соответствуют фильтру active=true');
      console.log('   4. Брони не соответствуют фильтру start_date_from="2025-10-14"');
    } else if (foundInExecution.length > 0) {
      console.log('✅ Брони найдены в execution');
      console.log('   Проверьте ноду "Save to DB" - возможно, ошибка при сохранении');
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

