#!/usr/bin/env node
/**
 * Проверка состояний (state) автомобилей из RentProg API
 */

const BRANCH_TOKENS = {
  'tbilisi': 'HHVxEiZJpFfWu2oDp5iZ7MxJrNXEMWLu',
  'batumi': 'HbIBFRY0QBVC9I0fCOdXjLjO2J1fRzUH',
  'kutaisi': 'C8cK7w0vG3KJzVb1YRt3C6UrF7zZEH9Y',
  'service-center': '3PUAyNAGjYdU7n5wUmLe2lPMpWRwpQVZ'
};

const BASE_URL = 'https://rentprog.net/api/v1/public';

// Получить request token
async function getRequestToken(branch) {
  const companyToken = BRANCH_TOKENS[branch];
  
  const response = await fetch(`${BASE_URL}/get_token?company_token=${companyToken}`, {
    method: 'GET'
  });
  
  if (!response.ok) {
    throw new Error(`Failed to get token: ${response.status}`);
  }
  
  const data = await response.json();
  return data.token;
}

// Получить машины
async function fetchCars(branch, token) {
  const response = await fetch(`${BASE_URL}/cars?per_page=100`, {
    headers: { 'X-Request-Token': token }
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch cars: ${response.status}`);
  }
  
  const data = await response.json();
  return data.data || [];
}

async function main() {
  const branch = 'tbilisi';
  
  console.log(`🔍 Проверка состояний (state) автомобилей из RentProg API (${branch})\n`);
  
  const token = await getRequestToken(branch);
  console.log('✅ Token получен');
  
  const cars = await fetchCars(branch, token);
  console.log(`✅ Получено ${cars.length} машин\n`);
  
  // Сгруппировать по state
  const stateGroups = {};
  const stateCounts = {};
  
  cars.forEach(car => {
    const state = car.state !== undefined ? String(car.state) : 'undefined';
    
    if (!stateGroups[state]) {
      stateGroups[state] = [];
      stateCounts[state] = 0;
    }
    
    stateGroups[state].push(car.number || car.code || car.id);
    stateCounts[state]++;
  });
  
  console.log('📊 Статусы (state) из RentProg API:');
  console.log('='.repeat(60));
  
  // Сортировать по количеству
  const sortedStates = Object.entries(stateCounts).sort((a, b) => b[1] - a[1]);
  
  sortedStates.forEach(([state, count]) => {
    const examples = stateGroups[state].slice(0, 3).join(', ');
    console.log(`State ${state}: ${count} машин`);
    console.log(`   Примеры: ${examples}`);
  });
  
  console.log('\n' + '='.repeat(60));
  
  // Показать примеры полных данных для каждого state
  console.log('\n📋 Примеры полных данных машин по state:\n');
  
  for (const state of ['0', '1', '2', '3', '4', '5', '6', 'undefined']) {
    if (stateGroups[state] && stateGroups[state].length > 0) {
      const exampleCar = cars.find(c => String(c.state === undefined ? 'undefined' : c.state) === state);
      if (exampleCar) {
        console.log(`\nState ${state} - Пример (${exampleCar.number || exampleCar.code}):`);
        console.log(JSON.stringify({
          id: exampleCar.id,
          number: exampleCar.number,
          code: exampleCar.code,
          state: exampleCar.state,
          model: exampleCar.model,
          deleted: exampleCar.deleted
        }, null, 2));
      }
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('\n📖 Документация по state:');
  console.log('   (1) Можно выдавать – зеленый');
  console.log('   (2) В ремонте – серый');
  console.log('   (3) Критическое состояние – красный');
  console.log('   (4) В долгосрочной аренде – розовый');
  console.log('   (5) Не выдавать – голубой');
  console.log('   (6) Необходимо обслуживание – оранжевый');
}

main().catch(console.error);

