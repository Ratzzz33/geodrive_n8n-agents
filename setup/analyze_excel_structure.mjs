/**
 * Анализ структуры Excel файлов cities.xlsx и routes.xlsx
 */

import XLSX from 'xlsx';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function analyzeFile(filePath, fileName) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📄 Анализ файла: ${fileName}`);
  console.log('='.repeat(60));
  
  try {
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
    
    console.log(`\n📊 Лист: "${sheetName}"`);
    console.log(`📈 Количество строк: ${data.length}`);
    
    if (data.length > 0) {
      console.log(`\n🔑 Колонки (первые 3 строки):`);
      const columns = Object.keys(data[0]);
      columns.forEach((col, i) => {
        console.log(`   ${i + 1}. "${col}"`);
        const sampleValues = data.slice(0, 3).map(row => row[col]).filter(v => v !== '' && v !== null && v !== undefined);
        if (sampleValues.length > 0) {
          const displayValues = sampleValues.map(v => {
            const str = String(v);
            return str.length > 50 ? str.substring(0, 50) + '...' : str;
          });
          console.log(`      Примеры: ${displayValues.join(', ')}`);
        }
      });
      
      console.log(`\n📝 Первые 3 строки данных:`);
      data.slice(0, 3).forEach((row, i) => {
        console.log(`\n   Строка ${i + 1}:`);
        Object.entries(row).forEach(([key, value]) => {
          if (value !== '' && value !== null && value !== undefined) {
            const displayValue = String(value).length > 100 
              ? String(value).substring(0, 100) + '...' 
              : value;
            console.log(`      ${key}: ${displayValue}`);
          }
        });
      });
    }
    
  } catch (error) {
    console.error(`\n❌ Ошибка при чтении файла: ${error.message}`);
  }
}

async function main() {
  console.log('🔍 Анализ структуры Excel файлов\n');
  
  const citiesPath = join(__dirname, '..', 'excel', 'cities.xlsx');
  const routesPath = join(__dirname, '..', 'excel', 'routes.xlsx');
  
  analyzeFile(citiesPath, 'cities.xlsx');
  analyzeFile(routesPath, 'routes.xlsx');
  
  console.log('\n' + '='.repeat(60));
}

main();

