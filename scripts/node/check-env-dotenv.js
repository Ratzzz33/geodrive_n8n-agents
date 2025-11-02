#!/usr/bin/env node
/**
 * Проверка загрузки .env файла через dotenv
 * Используется в GitHub Actions workflow: verify-env-content.yml
 */

const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

console.log('📋 Проверяю содержимое .env файла...');
console.log('');

// Проверка существования файла
const envPath = path.join(process.cwd(), '.env');
console.log('Текущая директория:', process.cwd());
console.log('Путь к .env:', envPath);
console.log('Файл .env существует:', fs.existsSync(envPath));

if (!fs.existsSync(envPath)) {
  console.error('❌ Файл .env не найден!');
  process.exit(1);
}

console.log('✅ Файл .env найден');
console.log('');

// Чтение и анализ файла
const envContent = fs.readFileSync(envPath, 'utf8');
const dbLine = envContent.split('\n').find(line => line.startsWith('DATABASE_URL='));

console.log('📊 Строка DATABASE_URL из файла:');
if (dbLine) {
  console.log('Строка:', dbLine.substring(0, 80) + '...');
  console.log('Длина строки:', dbLine.length, 'символов');
  
  // Проверка значения
  const value = dbLine.split('=')[1] || '';
  if (!value || value === '""' || value === "''") {
    console.error('❌ Значение DATABASE_URL пустое или в кавычках!');
    process.exit(1);
  } else {
    console.log('✅ Значение DATABASE_URL есть (первые 50 символов):', value.substring(0, 50) + '...');
  }
} else {
  console.error('❌ Строка DATABASE_URL не найдена в файле');
  process.exit(1);
}

console.log('');
console.log('🔍 Тестирую загрузку через dotenv...');

// Загрузка через dotenv
const result = dotenv.config({ path: envPath });

if (result.error) {
  console.error('❌ Ошибка dotenv:', result.error.message);
  process.exit(1);
} else {
  console.log('✅ dotenv.config() успешно');
}

// Проверка переменной в process.env
console.log('');
console.log('🔍 Проверяю process.env.DATABASE_URL...');
console.log('process.env.DATABASE_URL установлен:', !!process.env.DATABASE_URL);

if (process.env.DATABASE_URL) {
  const masked = process.env.DATABASE_URL.replace(/:[^:@]+@/, ':***@');
  console.log('Значение (замаскировано):', masked.substring(0, 50) + '...');
  console.log('Длина значения:', process.env.DATABASE_URL.length);
  console.log('');
  console.log('✅ Проверка .env успешна');
  process.exit(0);
} else {
  console.error('❌ process.env.DATABASE_URL не установлен после dotenv.config()');
  process.exit(1);
}

