#!/usr/bin/env node
/**
 * Анализ логики ноды "Prepare Updates"
 * Проверяем:
 * 1. Режим работы ноды (Run Once for All Items vs Run Once for Each Item)
 * 2. Логику сравнения значений
 * 3. Обработку пустых значений и NULL
 */

const currentLogic = `const items = $input.all();

if (!items || items.length === 0) {
  return [{ json: { hasChanges: false, updates: [], discrepancies: [] } }];
}

const updates = [];
const discrepancies = [];

const fieldNames = {
  company_id: 'Компания',
  model: 'Модель',
  plate: 'Номер',
  state: 'Статус',
  transmission: 'Трансмиссия',
  year: 'Год',
  number_doors: 'Кол-во дверей',
  number_seats: 'Кол-во мест',
  is_air: 'Кондиционер',
  engine_capacity: 'Объём двигателя',
  engine_power: 'Мощность',
  trunk_volume: 'Объём багажника',
  avatar_url: 'Аватар'
};

items.forEach(item => {
  const data = item.json;

  // Машина есть в RentProg, но отсутствует в cars
  if (!data.car_db_id) {
    discrepancies.push({
      rentprog_id: data.rentprog_id,
      type: 'missing_in_db',
      plate: data.snapshot_plate,
      model: data.snapshot_model,
      snapshot: data
    });
    return;
  }

  const fieldsToUpdate = [];

  for (const field of Object.keys(fieldNames)) {
    const snapshotValue = data[\`snapshot_\${field}\`];
    const dbValue = data[\`db_\${field}\`];

    if ((snapshotValue ?? '') !== (dbValue ?? '')) {
      fieldsToUpdate.push({
        field,
        fieldName: fieldNames[field],
        snapshotValue,
        dbValue
      });
    }
  }

  if (fieldsToUpdate.length > 0) {
    discrepancies.push({
      rentprog_id: data.rentprog_id,
      type: 'field_mismatch',
      car_id: data.car_db_id,
      plate: data.db_plate,
      model: data.db_model,
      fields: fieldsToUpdate
    });

    updates.push({
      carId: data.car_db_id,
      plate: data.db_plate,
      fieldsToUpdate
    });
  }
});

return [{
  json: {
    hasChanges: discrepancies.length > 0,
    totalDiscrepancies: discrepancies.length,
    totalUpdates: updates.length,
    discrepancies,
    updates
  }
}];`;

console.log('📋 Анализ логики ноды "Prepare Updates"\n');

console.log('1. Режим работы ноды:');
console.log('   ✅ Использует $input.all() - режим "Run Once for All Items"');
console.log('   ✅ Правильно для обработки всех результатов из "Compute Diff (SQL)"\n');

console.log('2. Проблемы в текущей логике сравнения:\n');

// Тестируем различные сценарии
const testCases = [
  { name: 'Пустая строка vs NULL', snapshot: '', db: null, expected: false },
  { name: 'NULL vs пустая строка', snapshot: null, db: '', expected: false },
  { name: 'NULL vs NULL', snapshot: null, db: null, expected: false },
  { name: 'Пустая строка vs пустая строка', snapshot: '', db: '', expected: false },
  { name: 'Значение vs NULL', snapshot: 'RR635WR', db: null, expected: true },
  { name: 'NULL vs значение', snapshot: null, db: 'RR635WR', expected: true },
  { name: 'Разные значения', snapshot: 'RR635WR', db: 'RR635QQ', expected: true },
  { name: 'Одинаковые значения', snapshot: 'RR635WR', db: 'RR635WR', expected: false },
];

console.log('   Тестовые сценарии:');
testCases.forEach(test => {
  const snapshotValue = test.snapshot;
  const dbValue = test.db;
  const result = (snapshotValue ?? '') !== (dbValue ?? '');
  const status = result === test.expected ? '✅' : '❌';
  console.log(`   ${status} ${test.name}:`);
  console.log(`      snapshotValue: ${JSON.stringify(snapshotValue)}, dbValue: ${JSON.stringify(dbValue)}`);
  console.log(`      Результат: ${result}, Ожидалось: ${test.expected}`);
  if (result !== test.expected) {
    console.log(`      ⚠️  ПРОБЛЕМА!`);
  }
  console.log('');
});

console.log('3. Проблема:\n');
console.log('   ❌ Текущая логика: (snapshotValue ?? \'\') !== (dbValue ?? \'\')');
console.log('   Проблема: после нормализации в SQL (NULLIF(TRIM(...), \'\'))');
console.log('   пустые строки превращаются в NULL, но сравнение может быть некорректным\n');

console.log('4. Решение:\n');
console.log('   ✅ После исправления SQL в "Compute Diff (SQL)" все пустые строки');
console.log('   нормализуются в NULL, поэтому сравнение должно работать корректно.');
console.log('   НО нужно убедиться, что логика сравнения учитывает это.\n');

console.log('5. Рекомендация:\n');
console.log('   Использовать нормализованное сравнение:');
console.log('   const normalize = (val) => val === null || val === undefined || val === \'\' ? null : String(val).trim();');
console.log('   if (normalize(snapshotValue) !== normalize(dbValue)) { ... }');

