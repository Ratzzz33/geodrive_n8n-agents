#!/usr/bin/env node
/**
 * Получить состояния машин через Jarvis API на сервере
 */

import { apiFetch } from '../dist/integrations/rentprog.js';

async function main() {
  console.log('🔍 Получение машин через Jarvis API\n');
  
  try {
    const branch = 'tbilisi';
    const cars = await apiFetch(branch, '/cars', { per_page: 100 });
    
    console.log(`✅ Получено ${cars.length} машин из ${branch}\n`);
    
    // Группировка по state
    const stateGroups = {};
    cars.forEach(car => {
      const state = car.state !== undefined ? String(car.state) : 'undefined';
      if (!stateGroups[state]) {
        stateGroups[state] = [];
      }
      stateGroups[state].push(car.number || car.code || car.id);
    });
    
    console.log('📊 Статусы (state) из RentProg API:');
    console.log('='.repeat(60));
    
    Object.entries(stateGroups)
      .sort((a, b) => b[1].length - a[1].length)
      .forEach(([state, plates]) => {
        console.log(`State ${state}: ${plates.length} машин`);
        console.log(`   Примеры: ${plates.slice(0, 3).join(', ')}`);
      });
    
    console.log('\n' + '='.repeat(60));
    console.log('\n📖 Документация по state:');
    console.log('   (1) Можно выдавать – зеленый');
    console.log('   (2) В ремонте – серый');
    console.log('   (3) Критическое состояние – красный');
    console.log('   (4) В долгосрочной аренде – розовый');
    console.log('   (5) Не выдавать – голубой');
    console.log('   (6) Необходимо обслуживание – оранжевый');
    
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    process.exit(1);
  }
}

main();

