import XLSX from 'xlsx';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const excelPath = join(__dirname, '..', 'excel', 'umnico-leads.xlsx');

console.log('📊 Анализ файла Umnico Excel экспорта\n');
console.log(`📁 Путь к файлу: ${excelPath}`);

if (!fs.existsSync(excelPath)) {
  console.error('❌ Файл не найден:', excelPath);
  console.log('\nПопробуем найти все Excel файлы в директории excel/...');
  const excelDir = join(__dirname, '..', 'excel');
  if (fs.existsSync(excelDir)) {
    const files = fs.readdirSync(excelDir);
    console.log('Найденные файлы:', files);
    if (files.length > 0) {
      const excelFiles = files.filter(f => f.endsWith('.xlsx') || f.endsWith('.xls'));
      if (excelFiles.length > 0) {
        console.log(`\nИспользуем первый найденный Excel файл: ${excelFiles[0]}`);
        const altPath = join(excelDir, excelFiles[0]);
        analyzeExcel(altPath);
        process.exit(0);
      }
    }
  }
  process.exit(1);
}

analyzeExcel(excelPath);

function analyzeExcel(filePath) {
  try {
    const workbook = XLSX.readFile(filePath);
    
    console.log('\n📋 Листы в файле:', workbook.SheetNames.join(', '));
    
    workbook.SheetNames.forEach((sheetName, index) => {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`📄 Лист ${index + 1}: "${sheetName}"`);
      console.log('='.repeat(60));
      
      const worksheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
      
      console.log(`\n📊 Количество строк: ${data.length}`);
      
      if (data.length > 0) {
        console.log('\n🔑 Колонки (поля):');
        const columns = Object.keys(data[0]);
        columns.forEach((col, i) => {
          const sampleValues = data.slice(0, 3).map(row => row[col]).filter(v => v);
          const uniqueValues = new Set(data.map(row => row[col]).filter(v => v));
          console.log(`   ${i + 1}. "${col}"`);
          console.log(`      - Уникальных значений: ${uniqueValues.size}`);
          if (sampleValues.length > 0) {
            console.log(`      - Примеры: ${sampleValues.slice(0, 2).map(v => `"${v}"`).join(', ')}`);
          }
        });
        
        console.log('\n📝 Первые 3 записи (образец данных):');
        data.slice(0, 3).forEach((row, i) => {
          console.log(`\n   Запись ${i + 1}:`);
          Object.entries(row).forEach(([key, value]) => {
            if (value) {
              const displayValue = String(value).length > 100 
                ? String(value).substring(0, 100) + '...' 
                : value;
              console.log(`      ${key}: ${displayValue}`);
            }
          });
        });
        
        // Анализ полезных данных
        console.log('\n\n🔍 АНАЛИЗ ПОЛЕЗНОСТИ ДАННЫХ:');
        console.log('='.repeat(60));
        
        const analysis = {
          hasClientInfo: false,
          hasContactInfo: false,
          hasConversationData: false,
          hasTimestamps: false,
          hasStatus: false,
          hasEmployeeInfo: false,
          hasBookingInfo: false,
          usefulFields: []
        };
        
        columns.forEach(col => {
          const lowerCol = col.toLowerCase();
          
          // Информация о клиенте
          if (lowerCol.includes('name') || lowerCol.includes('имя') || lowerCol.includes('клиент')) {
            analysis.hasClientInfo = true;
            analysis.usefulFields.push({ field: col, type: 'Информация о клиенте' });
          }
          
          // Контактная информация
          if (lowerCol.includes('phone') || lowerCol.includes('телефон') || 
              lowerCol.includes('email') || lowerCol.includes('почта')) {
            analysis.hasContactInfo = true;
            analysis.usefulFields.push({ field: col, type: 'Контактная информация' });
          }
          
          // Данные диалога
          if (lowerCol.includes('message') || lowerCol.includes('сообщение') || 
              lowerCol.includes('text') || lowerCol.includes('текст') ||
              lowerCol.includes('conversation') || lowerCol.includes('диалог')) {
            analysis.hasConversationData = true;
            analysis.usefulFields.push({ field: col, type: 'Данные диалога' });
          }
          
          // Временные метки
          if (lowerCol.includes('date') || lowerCol.includes('дата') || 
              lowerCol.includes('time') || lowerCol.includes('время') ||
              lowerCol.includes('created') || lowerCol.includes('updated')) {
            analysis.hasTimestamps = true;
            analysis.usefulFields.push({ field: col, type: 'Временные метки' });
          }
          
          // Статус
          if (lowerCol.includes('status') || lowerCol.includes('статус') || 
              lowerCol.includes('state') || lowerCol.includes('состояние')) {
            analysis.hasStatus = true;
            analysis.usefulFields.push({ field: col, type: 'Статус' });
          }
          
          // Информация о сотруднике
          if (lowerCol.includes('operator') || lowerCol.includes('оператор') || 
              lowerCol.includes('manager') || lowerCol.includes('менеджер') ||
              lowerCol.includes('employee') || lowerCol.includes('сотрудник')) {
            analysis.hasEmployeeInfo = true;
            analysis.usefulFields.push({ field: col, type: 'Информация о сотруднике' });
          }
          
          // Информация о брони
          if (lowerCol.includes('booking') || lowerCol.includes('бронь') || 
              lowerCol.includes('reservation') || lowerCol.includes('car') || 
              lowerCol.includes('авто') || lowerCol.includes('машина')) {
            analysis.hasBookingInfo = true;
            analysis.usefulFields.push({ field: col, type: 'Информация о брони' });
          }
        });
        
        console.log('\n✅ Найденные полезные категории данных:');
        if (analysis.hasClientInfo) console.log('   ✓ Информация о клиенте');
        if (analysis.hasContactInfo) console.log('   ✓ Контактная информация (телефон/email)');
        if (analysis.hasConversationData) console.log('   ✓ Данные диалогов');
        if (analysis.hasTimestamps) console.log('   ✓ Временные метки');
        if (analysis.hasStatus) console.log('   ✓ Статусы');
        if (analysis.hasEmployeeInfo) console.log('   ✓ Информация о сотрудниках');
        if (analysis.hasBookingInfo) console.log('   ✓ Информация о бронях');
        
        if (analysis.usefulFields.length > 0) {
          console.log('\n\n📌 ПОЛЕЗНЫЕ ПОЛЯ ДЛЯ ИНТЕГРАЦИИ:');
          console.log('='.repeat(60));
          
          const grouped = {};
          analysis.usefulFields.forEach(({ field, type }) => {
            if (!grouped[type]) grouped[type] = [];
            grouped[type].push(field);
          });
          
          Object.entries(grouped).forEach(([type, fields]) => {
            console.log(`\n${type}:`);
            fields.forEach(field => {
              const uniqueCount = new Set(data.map(row => row[field]).filter(v => v)).size;
              const filledCount = data.filter(row => row[field]).length;
              console.log(`   • ${field}`);
              console.log(`     Заполнено: ${filledCount}/${data.length} (${Math.round(filledCount/data.length*100)}%)`);
              console.log(`     Уникальных: ${uniqueCount}`);
            });
          });
        }
        
        console.log('\n\n💡 РЕКОМЕНДАЦИИ ПО ИСПОЛЬЗОВАНИЮ:');
        console.log('='.repeat(60));
        
        if (analysis.hasClientInfo && analysis.hasContactInfo) {
          console.log('\n1. Синхронизация клиентов:');
          console.log('   • Можно автоматически создавать/обновлять клиентов в БД');
          console.log('   • Использовать телефон как ключ для связи с RentProg');
        }
        
        if (analysis.hasConversationData) {
          console.log('\n2. История диалогов:');
          console.log('   • Импортировать историю переписки в БД');
          console.log('   • Отображать в веб-интерфейсе полную историю');
        }
        
        if (analysis.hasTimestamps) {
          console.log('\n3. Временные данные:');
          console.log('   • Определять активные/неактивные диалоги');
          console.log('   • Строить статистику по времени ответов');
        }
        
        if (analysis.hasEmployeeInfo) {
          console.log('\n4. Распределение сотрудников:');
          console.log('   • Автоматически назначать ответственных');
          console.log('   • Связывать с данными из RentProg (bookings.responsible_id)');
        }
        
        console.log('\n5. Интеграция с Telegram:');
        console.log('   • Создавать темы в Telegram для каждого активного диалога');
        console.log('   • Использовать имя клиента и контакты для названия темы');
        
        console.log('\n6. Связь с RentProg:');
        console.log('   • По телефону находить клиента в clients таблице');
        console.log('   • Связывать диалог с активной бронью (если есть)');
        console.log('   • Подтягивать данные авто и даты брони в Telegram');
      }
    });
    
    console.log('\n\n' + '='.repeat(60));
    console.log('✅ Анализ завершен');
    console.log('='.repeat(60));
    
  } catch (error) {
    console.error('❌ Ошибка при чтении файла:', error.message);
    process.exit(1);
  }
}

