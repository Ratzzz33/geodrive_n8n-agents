#!/usr/bin/env node
/**
 * Обновление переменной TELEGRAM_ALERT_CHAT_ID в n8n
 */

const N8N_HOST = 'https://n8n.rentflow.rentals';
const CHAT_ID = '-5004140602';

console.log('\n🔧 Обновление TELEGRAM_ALERT_CHAT_ID в n8n\n');

console.log(`🎯 Chat ID: ${CHAT_ID}`);
console.log(`🌐 n8n Host: ${N8N_HOST}`);
console.log();

console.log('📝 Инструкция для ручной настройки:');
console.log();
console.log('1. Откройте n8n UI: https://n8n.rentflow.rentals');
console.log('2. Перейдите в Settings (⚙️) → Variables');
console.log('3. Найдите переменную TELEGRAM_ALERT_CHAT_ID');
console.log('4. Если её нет - создайте новую:');
console.log(`   - Key: TELEGRAM_ALERT_CHAT_ID`);
console.log(`   - Value: ${CHAT_ID}`);
console.log('5. Если есть - обновите значение на:', CHAT_ID);
console.log('6. Сохраните изменения');
console.log();
console.log('✅ После этого workflow автоматически увидит новое значение');
console.log();

