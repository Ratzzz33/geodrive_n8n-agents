#!/usr/bin/env node
/**
 * Правильное решение для Company Cash Monitor - batch insert
 */

console.log('\n✅ Правильное решение: Batch INSERT\n');

console.log('📝 Код для новой ноды "Prepare Batch Insert" (Code):');
console.log(`
// Формируем batch INSERT для всех payments за ОДИН SQL запрос
const items = $input.all();
console.log(\`🔄 Preparing batch insert for \${items.length} payments\`);

if (items.length === 0) {
  return [{ json: { values_sql: '', total: 0 } }];
}

// Функция экранирования SQL строк
const escapeSql = (str) => {
  if (!str) return '';
  return String(str).replace(/'/g, "''");
};

// Формируем VALUES для каждого payment
const valueRows = items.map(item => {
  const p = item.json;
  return \`(
    '\${escapeSql(p.branch)}',
    \${p.payment_id || 'NULL'},
    \${p.sum || 0},
    \${p.cash ? 'TRUE' : 'FALSE'},
    \${p.cashless || 0},
    '\${escapeSql(p.group)}',
    \${p.subgroup ? \`'\${escapeSql(p.subgroup)}'\` : 'NULL'},
    '\${escapeSql(p.description)}',
    \${p.car_id || 'NULL'},
    \${p.booking_id || 'NULL'},
    \${p.client_id || 'NULL'},
    \${p.user_id || 'NULL'},
    '\${p.created_at}',
    '\${escapeSql(p.raw_data)}'
  )\`;
});

const valuesSql = valueRows.join(',\\\\n');

console.log(\`✅ Prepared \${items.length} rows for batch insert\`);
console.log(\`First row preview: \${valueRows[0].substring(0, 150)}...\`);

// Возвращаем все items для подсчёта + SQL для вставки
const results = items.map(item => ({
  json: {
    ...item.json,
    batch_values: valuesSql,
    total_items: items.length
  }
}));

return results;
`.trim());

console.log('\n\n📝 SQL для ноды "Save Payment to DB" (Postgres):');
console.log(`
INSERT INTO payments (
  branch, payment_id, sum, cash, cashless, "group", subgroup, description,
  car_id, booking_id, client_id, user_id, created_at, raw_data
) VALUES 
{{ $json.batch_values }}
ON CONFLICT (branch, payment_id)
DO UPDATE SET
  sum = EXCLUDED.sum,
  cash = EXCLUDED.cash,
  cashless = EXCLUDED.cashless,
  description = EXCLUDED.description,
  raw_data = EXCLUDED.raw_data,
  updated_at = NOW()
RETURNING branch, payment_id
`.trim());

console.log('\n\n🔧 ИНСТРУКЦИЯ ПО ПРИМЕНЕНИЮ:\n');
console.log('1. Откройте workflow: https://n8n.rentflow.rentals/workflow/w8g8cJb0ccReaqIE\n');
console.log('2. Удалите ноды:');
console.log('   ❌ Split In Batches');
console.log('   ❌ Pass Through Data\n');
console.log('3. Добавьте Code ноду после "Merge & Process":');
console.log('   - Name: Prepare Batch Insert');
console.log('   - Вставьте код выше\n');
console.log('4. Обновите "Save Payment to DB":');
console.log('   - Operation: Execute Query');
console.log('   - Вставьте SQL выше\n');
console.log('5. Подключите:');
console.log('   Merge & Process → Prepare Batch Insert → Save Payment to DB → Format Result\n');
console.log('6. Сохраните и запустите!\n');
console.log('✅ Результат: ВСЕ 188 items за ОДИН SQL запрос! 🚀\n');

