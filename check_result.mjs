// Проверка результата теста
import fs from 'fs';

setTimeout(() => {
  const files = fs.readdirSync('.').filter(f => f.startsWith('starline-routes-') && f.endsWith('.html'));
  
  if (files.length > 0) {
    const latestFile = files.sort().reverse()[0];
    const html = fs.readFileSync(latestFile, 'utf8');
    
    console.log(`\n✅ Найден HTML файл: ${latestFile}`);
    console.log(`📊 Размер: ${(html.length / 1024).toFixed(2)} KB`);
    console.log(`\n📄 Первые 3000 символов:\n${html.substring(0, 3000)}...`);
    console.log(`\n📄 Последние 1500 символов:\n...${html.substring(html.length - 1500)}`);
  } else {
    console.log('⏳ Файл еще не создан, запрос выполняется...');
  }
}, 60000); // Проверка через 60 секунд

