import fs from 'fs';

console.log('📝 Обновление кода валидации в workflow...\n');

// Читаем файлы
const workflowFile = 'n8n-workflows/rentprog-webhooks-monitor.json';
const codeFile = 'setup/parse_code_with_validation.js';

const workflow = JSON.parse(fs.readFileSync(workflowFile, 'utf8'));
const newCode = fs.readFileSync(codeFile, 'utf8');

// Находим ноду Parse & Validate Format
const parseNode = workflow.nodes.find(n => n.id === 'parse-validate-node' || n.name === 'Parse & Validate Format');

if (!parseNode) {
  console.error('❌ Не найдена нода Parse & Validate Format');
  process.exit(1);
}

console.log(`✅ Найдена нода: ${parseNode.name} (ID: ${parseNode.id})`);

// Заменяем код
// В JSON нужно экранировать специальные символы
const escapedCode = newCode
  .replace(/\\/g, '\\\\')       // Экранируем обратные слэши
  .replace(/\r\n/g, '\\r\\n')   // Заменяем CRLF на экранированный вариант
  .replace(/\n/g, '\\n')        // Заменяем LF на экранированный вариант
  .replace(/"/g, '\\"');        // Экранируем кавычки

parseNode.parameters.jsCode = escapedCode;

console.log(`✅ Код обновлен (${newCode.length} символов)`);

// Сохраняем обновленный workflow
fs.writeFileSync(workflowFile, JSON.stringify(workflow, null, 2), 'utf8');

console.log(`✅ Workflow сохранен: ${workflowFile}`);
console.log('\n📋 Изменения:');
console.log('   • Добавлено 9 типов событий в knownEventTypes');
console.log('   • Добавлена функция validateEventFormat()');
console.log('   • Валидация обязательных полей для каждого типа:');
console.log('     - Базовая: только id (обязательно для всех)');
console.log('     - car_update: mileage, clean_state, status, location, plate_number');
console.log('     - client_update: name, phone, email, passport, license');
console.log('     - booking_update: status, issue_planned_at, return_planned_at, car_id, client_id');
console.log('     - car_create: plate_number или model');
console.log('     - client_create: name или phone');
console.log('     - booking_create: car_id, client_id');
console.log('     - *_destroy: только базовая валидация (id)');
console.log('\n💡 Следующий шаг: обновить workflow в n8n через MCP или API');

