#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const workflowPath = path.join(__dirname, '..', 'n8n-workflows', 'rentprog-car-states-reconciliation-v2.json');
const workflow = JSON.parse(fs.readFileSync(workflowPath, 'utf-8'));

// Находим узел "Prepare Updates"
const prepareUpdatesNode = workflow.nodes.find(n => n.id === 'prepare-updates');

if (!prepareUpdatesNode) {
  console.error('❌ Узел "Prepare Updates" не найден');
  process.exit(1);
}

// Улучшенный код для "Prepare Updates" - нормализует значения перед сравнением
const newCode = `const items = $input.all();

if (!items || items.length === 0) {
  return [{ json: { hasChanges: false, updates: [], discrepancies: [] } }];
}

// Функция нормализации: пустые строки, null, undefined считаются равными
const normalize = (val) => {
  if (val === null || val === undefined || val === '') return null;
  const str = String(val).trim();
  return str === '' ? null : str;
};

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

    // Нормализуем значения перед сравнением
    // Пустые строки, null, undefined считаются равными (не обновляем)
    const normalizedSnapshot = normalize(snapshotValue);
    const normalizedDb = normalize(dbValue);

    // Сравниваем нормализованные значения
    if (normalizedSnapshot !== normalizedDb) {
      // НО: если snapshotValue пустое/null, не добавляем в обновления
      // (это предотвратит затирание данных в БД)
      if (normalizedSnapshot === null) {
        // Пропускаем - не обновляем поле, если в snapshot пустое значение
        continue;
      }

      fieldsToUpdate.push({
        field,
        fieldName: fieldNames[field],
        snapshotValue: snapshotValue, // Сохраняем оригинальное значение
        dbValue: dbValue // Сохраняем оригинальное значение
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

prepareUpdatesNode.parameters.jsCode = newCode;

// Сохраняем обновленный workflow
fs.writeFileSync(workflowPath, JSON.stringify(workflow, null, 2), 'utf-8');

console.log('✅ Нода "Prepare Updates" обновлена:');
console.log('   1. Добавлена функция normalize() для нормализации значений');
console.log('   2. Пустые строки, null, undefined считаются равными');
console.log('   3. Если snapshotValue пустое/null - НЕ добавляем в обновления');
console.log('   4. Это предотвращает затирание данных в БД на уровне "Prepare Updates"');
console.log('');
console.log('📋 Изменения:');
console.log('   - Нормализация: пустые строки → null перед сравнением');
console.log('   - Двойная защита: пустые значения отфильтровываются в "Prepare Updates"');
console.log('   - И еще раз в "Generate SQL Updates" (уже было исправлено)');
console.log('');
console.log('⚠️  ВАЖНО: Нужно импортировать обновленный workflow в n8n!');

