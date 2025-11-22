#!/usr/bin/env node
import postgres from 'postgres';

const sql = postgres('postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require', {
  ssl: { rejectUnauthorized: false }
});

// Поля которые мы нашли на странице RentProg
const rentprogFields = {
  // Основные характеристики
  'Название (марка и модель)': 'model',
  'Внутренний код': 'code', 
  '№ сортировки': 'sort',
  'Государственный номер': 'plate',
  'VIN': 'vin',
  '№ кузова': 'body_number',
  'ПТС (серия номер)': 'pts',
  'Свидетельство (серия номер)': 'registration_certificate',
  
  // Тип и класс
  'Тип': 'car_type',
  'Класс': 'car_class',
  'Цвет': 'color',
  'Год': 'year',
  
  // Трансмиссия и привод
  'Коробка': 'transmission',
  'Привод': 'drive_unit',
  'Топливо': 'fuel',
  
  // Объемы и расход
  'Объём бака, л': 'tank_value',
  'Расход топлива, на 100 км, л': 'gas_mileage',
  
  // Конфигурация
  'Сторона руля': 'steering_side',
  'Кол-во дверей': 'number_doors',
  'Кол-во мест': 'number_seats',
  
  // Двигатель
  'Объём двигателя': 'engine_capacity',
  'Мощность двигателя, л.с': 'engine_power',
  
  // Шины и страховка
  'Размер шин': 'tire_size',
  'Размер франшизы': 'franchise',
  'Максимальный штраф': 'max_fine',
  'Стоимость ремонта 1 элемента кузова': 'repair_cost',
  
  // Филиал
  'Филиал': 'company_id'
};

try {
  // Получаем все колонки из БД
  const columns = await sql`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_name = 'cars'
    ORDER BY ordinal_position
  `;
  
  const dbColumns = columns.map(c => c.column_name);
  
  console.log('\n📊 АНАЛИЗ СООТВЕТСТВИЯ ПОЛЕЙ:\n');
  console.log('=' .repeat(80));
  
  // Проверяем каждое поле из RentProg
  let foundCount = 0;
  let notFoundCount = 0;
  const notFoundFields = [];
  
  console.log('\n✅ НАЙДЕННЫЕ СООТВЕТСТВИЯ:\n');
  
  for (const [rentprogField, dbField] of Object.entries(rentprogFields)) {
    if (dbColumns.includes(dbField)) {
      const col = columns.find(c => c.column_name === dbField);
      console.log(`  ${rentprogField.padEnd(40)} → ${dbField.padEnd(30)} (${col.data_type})`);
      foundCount++;
    } else {
      notFoundFields.push({ rentprogField, dbField });
      notFoundCount++;
    }
  }
  
  if (notFoundCount > 0) {
    console.log('\n\n❌ НЕ НАЙДЕННЫЕ ПОЛЯ В БД:\n');
    notFoundFields.forEach(({ rentprogField, dbField }) => {
      console.log(`  ${rentprogField.padEnd(40)} → ${dbField} (ОТСУТСТВУЕТ)`);
    });
  }
  
  console.log('\n' + '='.repeat(80));
  console.log(`\n📈 СТАТИСТИКА:`);
  console.log(`  Всего полей на странице RentProg: ${Object.keys(rentprogFields).length}`);
  console.log(`  Найдено соответствий в БД: ${foundCount} ✅`);
  console.log(`  Не найдено в БД: ${notFoundCount} ❌`);
  console.log(`  Всего полей в таблице cars: ${dbColumns.length}`);
  
  console.log('\n💡 РЕКОМЕНДАЦИЯ:');
  if (notFoundCount === 0) {
    console.log('  ✅ Все поля из RentProg уже есть в БД!');
    console.log('  ✅ Можно начинать парсинг без изменений схемы.');
  } else {
    console.log(`  ⚠️  Нужно добавить ${notFoundCount} полей в таблицу cars.`);
    console.log('  📝 Создать миграцию для добавления недостающих полей.');
  }
  
  // Дополнительная проверка - какие поля есть в БД но НЕ используются
  console.log('\n\n📋 ДОПОЛНИТЕЛЬНАЯ ИНФОРМАЦИЯ:\n');
  
  const usedDbFields = Object.values(rentprogFields);
  const unusedDbFields = dbColumns.filter(col => !usedDbFields.includes(col));
  
  console.log(`  Поля в БД которые НЕ заполняются из RentProg: ${unusedDbFields.length}`);
  console.log(`  (это нормально - они могут заполняться из других источников)`);
  
  console.log('\n');
  
} catch (error) {
  console.error('❌ Ошибка:', error.message);
} finally {
  await sql.end();
}

