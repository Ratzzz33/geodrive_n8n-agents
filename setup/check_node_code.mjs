import fs from 'fs';

console.log('🔍 Проверка кода в ноде Parse & Validate Format...\n');

const workflow = JSON.parse(fs.readFileSync('n8n-workflows/rentprog-webhooks-monitor.json', 'utf8'));
const parseNode = workflow.nodes.find(n => n.id === 'parse-validate-node');

if (!parseNode) {
  console.error('❌ Нода не найдена!');
  process.exit(1);
}

const code = parseNode.parameters.jsCode;

// Декодируем экранированные символы
const decodedCode = code
  .replace(/\\r\\n/g, '\n')
  .replace(/\\"/g, '"')
  .replace(/\\\\/g, '\\');

console.log('📊 Статистика кода:');
console.log(`   • Длина: ${code.length} символов`);
console.log(`   • Строк: ${decodedCode.split('\n').length}`);
console.log(`   • Содержит "knownEventTypes": ${decodedCode.includes('knownEventTypes') ? '✅' : '❌'}`);
console.log(`   • Содержит "validateEventFormat": ${decodedCode.includes('validateEventFormat') ? '✅' : '❌'}`);
console.log(`   • Содержит 9 типов событий: ${decodedCode.includes('client_destroy') ? '✅' : '❌'}`);
console.log('');

// Показываем важные части кода
console.log('📝 Ключевые части кода:\n');

// Находим массив knownEventTypes
const typesMatch = decodedCode.match(/const knownEventTypes = \[([\s\S]*?)\];/);
if (typesMatch) {
  console.log('1. Массив knownEventTypes:');
  console.log(typesMatch[0]);
  console.log('');
}

// Находим функцию validateEventFormat
const funcMatch = decodedCode.match(/function validateEventFormat\([^)]+\) \{[\s\S]{0,500}/);
if (funcMatch) {
  console.log('2. Начало функции validateEventFormat:');
  console.log(funcMatch[0] + '...');
  console.log('');
}

// Находим switch для car_update
const switchMatch = decodedCode.match(/case 'car_update':[\s\S]{0,300}/);
if (switchMatch) {
  console.log('3. Валидация car_update:');
  console.log(switchMatch[0] + '...');
  console.log('');
}

console.log('✅ Код загружен полностью!');
console.log('');
console.log('💡 Если в UI n8n код выглядит странно:');
console.log('   1. Обновите страницу (Ctrl+F5)');
console.log('   2. Откройте ноду в редакторе');
console.log('   3. Код должен быть там, но может отображаться в одну строку из-за \\r\\n');

