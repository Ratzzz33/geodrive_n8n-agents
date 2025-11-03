// Скрипт для обновления workflow через MCP partial update
// Обновляет только критичные ноды

console.log('📋 Для обновления через MCP используйте следующие операции:');
console.log('');
console.log('1. Обновление кода парсинга (Parse & Validate Format):');
console.log('   - Уже содержит явную установку isKnownFormat = false');
console.log('');
console.log('2. Обновление условия If Known Format:');
console.log('   - Условие: $json.isKnownFormat === true');
console.log('');
console.log('⚠️  Автоматическое обновление через MCP невозможно из-за размера workflow.');
console.log('✅ Локальный файл обновлен и готов к ручному импорту в n8n UI.');
console.log('');
console.log('📍 Файл для импорта: n8n-workflows/rentprog-webhooks-monitor.json');
console.log('📍 URL workflow: https://n8n.rentflow.rentals/workflow/gNXRKIQpNubEazH7');

