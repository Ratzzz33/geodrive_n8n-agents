#!/usr/bin/env node
/**
 * Проверка данных скорости для Maserati WQ686WQ из n8n execution
 */

import 'dotenv/config';

// Данные из execution 12295
const executionData = {
  "ok": true,
  "updated": 105,
  "errors": [],
  "details": [
    // Здесь должны быть все 105 машин
  ],
  "timestamp": "2025-11-14T04:00:33.620Z"
};

async function checkMaseratiSpeed() {
  try {
    console.log('\n🔍 АНАЛИЗ EXECUTION 12295 - Starline GPS Monitor\n');
    console.log('═'.repeat(100));

    // Получаем полные данные через fetch к n8n API
    const N8N_API_KEY = process.env.N8N_API_KEY;
    const N8N_HOST = 'https://n8n.rentflow.rentals/api/v1';

    const response = await fetch(`${N8N_HOST}/executions/12295`, {
      headers: {
        'X-N8N-API-KEY': N8N_API_KEY
      }
    });

    const execution = await response.json();
    
    // Ищем ноду Update GPS Data
    const updateGpsData = execution.data?.resultData?.runData?.['Update GPS Data'];
    
    if (!updateGpsData || !updateGpsData[0]?.data?.main?.[0]) {
      console.log('❌ Не найдены данные Update GPS Data');
      return;
    }

    const mainData = updateGpsData[0].data.main[0][0].json;
    
    console.log(`\n📊 ОБЩАЯ СТАТИСТИКА:`);
    console.log(`   Обновлено машин: ${mainData.updated}`);
    console.log(`   Ошибок: ${mainData.errors.length}`);
    console.log(`   Timestamp: ${mainData.timestamp}`);
    console.log(`   Всего деталей: ${mainData.details.length}`);

    // Фильтруем пустые объекты и ищем Maserati
    const validDetails = mainData.details.filter(d => d && Object.keys(d).length > 0);
    
    console.log(`\n   Валидных деталей (непустых): ${validDetails.length}`);

    // Ищем Maserati WQ686WQ
    const maserati = validDetails.find(d => 
      d.plate === 'WQ686WQ' || 
      (d.alias && d.alias.toLowerCase().includes('maserati'))
    );

    if (maserati) {
      console.log('\n' + '═'.repeat(100));
      console.log('\n🚗 MASERATI WQ686WQ НАЙДЕН:\n');
      console.log(JSON.stringify(maserati, null, 2));
    } else {
      console.log('\n' + '═'.repeat(100));
      console.log('\n⚠️ MASERATI WQ686WQ НЕ НАЙДЕН В EXECUTION\n');
      
      console.log('📋 Найденные номера машин:');
      validDetails.slice(0, 20).forEach((d, i) => {
        console.log(`   ${i + 1}. ${d.plate} - ${d.alias}`);
      });
    }

    // Проверяем машины с ненулевой скоростью
    console.log('\n' + '═'.repeat(100));
    console.log('\n⚡ МАШИНЫ С НЕНУЛЕВОЙ СКОРОСТЬЮ:\n');

    const movingCars = validDetails.filter(d => d.speed > 0);
    
    if (movingCars.length === 0) {
      console.log('   ❌ Нет машин с speed > 0 в этом execution!');
    } else {
      movingCars.forEach((car, i) => {
        console.log(`\n${i + 1}. 🚗 ${car.plate} - ${car.alias}`);
        console.log(`   ⚡ Скорость: ${car.speed} км/ч`);
        console.log(`   📊 Статус: ${car.status}`);
        console.log(`   🚗 Движется: ${car.isMoving ? 'ДА' : 'НЕТ'}`);
        console.log(`   📏 Дистанция: ${car.distanceMoved} м`);
        console.log(`   🔌 Зажигание: ${car.ignitionOn ? 'ВКЛ' : 'ВЫКЛ'}`);
        console.log(`   🔥 Двигатель: ${car.engineRunning ? 'ВКЛ' : 'ВЫКЛ'}`);
      });
    }

    // Статистика по скоростям
    console.log('\n' + '═'.repeat(100));
    console.log('\n📈 СТАТИСТИКА ПО СКОРОСТЯМ:\n');

    const speeds = validDetails.map(d => d.speed || 0);
    const maxSpeed = Math.max(...speeds);
    const avgSpeed = speeds.reduce((a, b) => a + b, 0) / speeds.length;
    const zeroSpeedCount = speeds.filter(s => s === 0).length;

    console.log(`   Макс. скорость: ${maxSpeed} км/ч`);
    console.log(`   Средняя скорость: ${avgSpeed.toFixed(2)} км/ч`);
    console.log(`   Машин с speed = 0: ${zeroSpeedCount} из ${validDetails.length}`);
    console.log(`   Машин с speed > 0: ${speeds.filter(s => s > 0).length}`);

    console.log('\n' + '═'.repeat(100));

  } catch (error) {
    console.error('❌ Ошибка:', error);
    throw error;
  }
}

checkMaseratiSpeed();

