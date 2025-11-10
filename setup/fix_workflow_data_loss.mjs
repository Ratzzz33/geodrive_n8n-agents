#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const workflowPath = path.join(__dirname, '..', 'n8n-workflows', 'rentprog-car-states-reconciliation-v2.json');
const workflow = JSON.parse(fs.readFileSync(workflowPath, 'utf-8'));

// Находим узел "Generate SQL Updates"
const generateSqlNode = workflow.nodes.find(n => n.id === 'generate-sql-updates');

if (!generateSqlNode) {
  console.error('❌ Узел "Generate SQL Updates" не найден');
  process.exit(1);
}

// Новый код для "Generate SQL Updates" - исправляет затирание данных
const newCode = `const output = $json;
const updates = output.updates || [];
const discrepancies = output.discrepancies || [];

const results = [];

// Обработка UPDATE для существующих машин
if (updates.length > 0) {
  const updateRows = updates.map(update => {
    const clauses = update.fieldsToUpdate
      .filter(f => f.field !== 'company_id')
      .map(f => {
        // КРИТИЧНО: Не обновляем поле, если snapshotValue пустое или null
        // Это предотвращает затирание существующих данных в БД
        if (f.snapshotValue === null || f.snapshotValue === undefined || f.snapshotValue === '') {
          return null;
        }

        let value;
        if (['state', 'year', 'number_doors', 'number_seats', 'engine_power', 'engine_capacity', 'trunk_volume'].includes(f.field)) {
          const num = Number(f.snapshotValue);
          value = Number.isNaN(num) ? null : num;
          if (value === null) return null;
        } else if (f.field === 'is_air') {
          value = f.snapshotValue === 'true' || f.snapshotValue === true ? 'TRUE' : f.snapshotValue === 'false' || f.snapshotValue === false ? 'FALSE' : null;
          if (value === null) return null;
        } else {
          // Для строковых полей (plate, model, transmission, avatar_url и т.д.)
          // Если значение пустое - пропускаем обновление
          const strValue = String(f.snapshotValue).trim();
          if (!strValue) return null;
          value = \`'\${strValue.replace(/'/g, "''")}'\`;
        }

        return value === null ? null : \`\${f.field} = \${value}\`;
      })
      .filter(Boolean);

    if (!clauses.length) {
      return null;
    }

    return {
      json: {
        ...update,
        sqlQuery: \`UPDATE cars SET \${clauses.join(', ')} WHERE id = '\${update.carId}'\`,
        operation: 'UPDATE'
      }
    };
  }).filter(Boolean);

  results.push(...updateRows);
}

// Обработка INSERT для новых машин (missing_in_db)
const missingCars = discrepancies.filter(d => d.type === 'missing_in_db');
if (missingCars.length > 0) {
  for (const missing of missingCars) {
    const snapshot = missing.snapshot || {};

    // Определяем branch_id по company_id
    const companyToBranch = {
      '9247': 'tbilisi',
      '9506': 'batumi',
      '9248': 'kutaisi',
      '11163': 'service-center'
    };

    const companyId = snapshot.snapshot_company || snapshot.company_id;
    const branchCode = companyToBranch[String(companyId)] || 'tbilisi';

    // Формируем значения для INSERT
    const formatValue = (val, field) => {
      // Для INSERT тоже не добавляем пустые значения
      if (val === null || val === undefined || val === '') return null;
      
      if (['state', 'year', 'number_doors', 'number_seats', 'engine_power', 'engine_capacity', 'trunk_volume'].includes(field)) {
        const num = Number(val);
        return Number.isNaN(num) ? null : num;
      } else if (field === 'is_air') {
        return val === 'true' || val === true ? 'TRUE' : val === 'false' || val === false ? 'FALSE' : null;
      } else {
        const strValue = String(val).trim();
        return strValue ? \`'\${strValue.replace(/'/g, "''")}'\` : null;
      }
    };

    const fields = [];
    const values = [];

    // Добавляем обязательные поля
    fields.push('id');
    values.push('gen_random_uuid()');

    fields.push('branch_id');
    values.push(\`(SELECT id FROM branches WHERE code = '\${branchCode}' LIMIT 1)\`);

    // Добавляем поля из snapshot (только если значение не пустое)
    const addFieldIfValue = (fieldName, snapshotKey, altKey) => {
      const val = snapshot[snapshotKey] !== undefined ? snapshot[snapshotKey] : (altKey ? snapshot[altKey] : undefined);
      const formatted = formatValue(val, fieldName);
      if (formatted !== null) {
        fields.push(fieldName);
        values.push(formatted);
      }
    };

    addFieldIfValue('model', 'snapshot_model', 'model');
    addFieldIfValue('plate', 'snapshot_plate', 'plate');
    addFieldIfValue('state', 'snapshot_state', 'state');
    addFieldIfValue('transmission', 'snapshot_transmission', 'transmission');
    addFieldIfValue('year', 'snapshot_year', 'year');
    addFieldIfValue('number_doors', 'snapshot_number_doors', 'number_doors');
    addFieldIfValue('number_seats', 'snapshot_number_seats', 'number_seats');
    
    // Для is_air проверяем явно на undefined
    if (snapshot.snapshot_is_air !== undefined || snapshot.is_air !== undefined) {
      const val = snapshot.snapshot_is_air !== undefined ? snapshot.snapshot_is_air : snapshot.is_air;
      const formatted = formatValue(val, 'is_air');
      if (formatted !== null) {
        fields.push('is_air');
        values.push(formatted);
      }
    }
    
    addFieldIfValue('engine_capacity', 'snapshot_engine_capacity', 'engine_capacity');
    addFieldIfValue('engine_power', 'snapshot_engine_power', 'engine_power');
    addFieldIfValue('trunk_volume', 'snapshot_trunk_volume', 'trunk_volume');
    addFieldIfValue('avatar_url', 'snapshot_avatar', 'avatar_url');

    // Добавляем company_id
    if (companyId) {
      fields.push('company_id');
      values.push(\`'\${companyId}'\`);
    }

    // Добавляем timestamps
    fields.push('created_at', 'updated_at');
    values.push('NOW()', 'NOW()');

    const insertQuery = \`DO $$
DECLARE
  new_car_id UUID;
BEGIN
  INSERT INTO cars (\${fields.join(', ')})
  VALUES (\${values.join(', ')})
  RETURNING id INTO new_car_id;

  INSERT INTO external_refs (entity_type, entity_id, system, external_id)
  VALUES ('car', new_car_id, 'rentprog', '\${missing.rentprog_id}');
END
$$;\`;

    results.push({
      json: {
        rentprog_id: missing.rentprog_id,
        plate: missing.plate,
        model: missing.model,
        sqlQuery: insertQuery,
        operation: 'INSERT',
        branchCode: branchCode
      }
    });
  }
}

if (!results.length) {
  return [{ json: { ...output, noUpdates: true } }];
}

return results;`;

generateSqlNode.parameters.jsCode = newCode;

// Сохраняем обновленный workflow
fs.writeFileSync(workflowPath, JSON.stringify(workflow, null, 2), 'utf-8');

console.log('✅ Workflow обновлен:');
console.log('   1. Исправлена логика в "Generate SQL Updates"');
console.log('   2. Пустые значения из snapshot больше НЕ затирают данные в БД');
console.log('   3. Обновляются только поля с реальными значениями');
console.log('');
console.log('📋 Изменения:');
console.log('   - Для всех полей: если snapshotValue пустое/null/undefined - пропускаем обновление');
console.log('   - Для строковых полей: проверяем trim() - если пустая строка - пропускаем');
console.log('   - Для числовых полей: если NaN - пропускаем');
console.log('   - Для boolean полей: если не true/false - пропускаем');
console.log('');
console.log('⚠️  ВАЖНО: Нужно импортировать обновленный workflow в n8n!');

