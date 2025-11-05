#!/usr/bin/env node
/**
 * Исправление файла src/api/index.ts для прослушивания на 0.0.0.0
 */

import { readFileSync, writeFileSync } from 'fs';

const filePath = './src/api/index.ts';

try {
  let content = readFileSync(filePath, 'utf8');
  
  // Заменить app.listen(port, () => на app.listen(port, '0.0.0.0', () =>
  content = content.replace(
    /app\.listen\(port, \(\) =>/g,
    "app.listen(port, '0.0.0.0', () =>"
  );
  
  writeFileSync(filePath, content, 'utf8');
  console.log('✅ Файл обновлён успешно!');
  console.log('   API теперь слушает на 0.0.0.0');
} catch (error) {
  console.error('❌ Ошибка:', error.message);
  process.exit(1);
}

