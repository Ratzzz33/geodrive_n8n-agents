/**
 * Проверка ответа API /starline/update-gps
 */

import fetch from 'node-fetch';

try {
  console.log('🔍 Вызов API /starline/update-gps...\n');
  
  const response = await fetch('http://46.224.17.15:3000/starline/update-gps', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({})
  });
  
  const data = await response.json();
  
  console.log(`✅ Статус: ${data.ok ? 'OK' : 'ERROR'}`);
  console.log(`📊 Обновлено: ${data.updated} машин`);
  console.log(`❌ Ошибок: ${data.errors?.length || 0}\n`);
  
  // Ищем Maserati
  const maserati = data.details?.find(d => 
    d.alias?.toLowerCase().includes('maserati') || 
    d.alias?.includes('686')
  );
  
  console.log(`📦 Всего элементов в details: ${data.details?.length || 0}`);
  console.log(`📋 Первые 5 элементов:\n`);
  
  data.details?.slice(0, 5).forEach((d, i) => {
    console.log(`   ${i + 1}. ${d.alias || d.plate || 'Unknown'} - Speed: ${d.speed} км/ч`);
  });
  
  console.log(`\n🔍 Поиск Maserati по разным критериям...\n`);
  
  // Проверяем каждый элемент детально
  const allAliases = data.details?.map((d, i) => `${i}: ${d.alias}`).filter(a => a.includes('686') || a.toLowerCase().includes('maserati'));
  console.log('Найденные по "686" или "maserati":', allAliases.length > 0 ? allAliases : 'Нет');
  
  if (maserati) {
    console.log('\n🏎️  MASERATI НАЙДЕН:\n');
    console.log(`   Alias: ${maserati.alias}`);
    console.log(`   Plate: ${maserati.plate}`);
    console.log(`   Speed: ${maserati.speed} км/ч ${maserati.speed > 0 ? '✅' : '❌'}`);
    console.log(`   IsMoving: ${maserati.isMoving}`);
    console.log(`   Status: ${maserati.status}`);
    console.log(`   Battery: ${maserati.batteryVoltage}V`);
    console.log(`   GPS: ${maserati.gpsLevel}/10`);
    console.log(`   GSM: ${maserati.gsmLevel}/31\n`);
    
    if (maserati.speed === 0) {
      console.log('❌ ПРОБЛЕМА: API ВОЗВРАЩАЕТ СКОРОСТЬ 0!');
      console.log('   Это значит проблема в обработке данных на сервере.');
    } else {
      console.log('✅ СКОРОСТЬ ЕСТЬ! API работает правильно.');
    }
  } else {
    console.log('\n❌ Maserati НЕ НАЙДЕН в массиве details!');
    console.log('   Возможно данные пустые или машина не в списке.');
  }
  
} catch (error) {
  console.error('❌ Ошибка:', error.message);
}

