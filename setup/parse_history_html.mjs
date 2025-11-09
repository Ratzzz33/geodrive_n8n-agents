import fetch from 'node-fetch';
import { JSDOM } from 'jsdom';

const TOKENS = {
  'tbilisi': 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxNjA0NiIsInNjcCI6InVzZXIiLCJhdWQiOm51bGwsImlhdCI6MTc2MjQ5MDExMywiZXhwIjoxNzY1MDgyMTEzLCJqdGkiOiI0MmUxNzQ5Zi02MjEyLTRmOTMtOGM0Zi02ZWMwODUzYmUwYWQifQ.20oXaXcgK_hdofbUK3RGdQuPa0pGWtZTV4b42-A8oY4'
};

async function fetchHistoryPage(token, branch = 'tbilisi') {
  console.log(`🔍 Парсим страницу истории для филиала: ${branch}\n`);
  
  const url = 'https://web.rentprog.ru/history';
  
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
        'Authorization': `Bearer ${token}`,
        'Cache-Control': 'no-cache',
        'Cookie': `_rentprog_session=${token}`,
        'Referer': 'https://web.rentprog.ru/',
        'Sec-Ch-Ua': '"Google Chrome";v="137", "Chromium";v="137", "Not-A.Brand";v="99"',
        'Sec-Ch-Ua-Mobile': '?0',
        'Sec-Ch-Ua-Platform': '"Windows"',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'same-origin',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36'
      }
    });
    
    console.log(`Status: ${response.status} ${response.statusText}`);
    console.log(`Content-Type: ${response.headers.get('content-type')}`);
    
    if (!response.ok) {
      const text = await response.text();
      console.log('\n❌ Ответ:', text.substring(0, 500));
      return null;
    }
    
    const html = await response.text();
    console.log(`\n✅ Получено HTML, размер: ${html.length} байт`);
    
    // Парсим HTML
    const dom = new JSDOM(html);
    const document = dom.window.document;
    
    // Ищем таблицу или список с историей
    console.log('\n🔍 Ищем данные истории в HTML...\n');
    
    // Вариант 1: Таблица
    const tables = document.querySelectorAll('table');
    console.log(`Найдено таблиц: ${tables.length}`);
    
    if (tables.length > 0) {
      tables.forEach((table, i) => {
        const rows = table.querySelectorAll('tr');
        console.log(`\nТаблица ${i + 1}: строк ${rows.length}`);
        
        if (rows.length > 0) {
          console.log('Первые 3 строки:');
          for (let j = 0; j < Math.min(3, rows.length); j++) {
            const cells = rows[j].querySelectorAll('td, th');
            const rowText = Array.from(cells).map(cell => cell.textContent.trim()).join(' | ');
            console.log(`  ${j + 1}: ${rowText}`);
          }
        }
      });
    }
    
    // Вариант 2: Списки
    const lists = document.querySelectorAll('ul, ol');
    console.log(`\nНайдено списков: ${lists.length}`);
    
    if (lists.length > 0) {
      lists.forEach((list, i) => {
        const items = list.querySelectorAll('li');
        if (items.length > 0) {
          console.log(`\nСписок ${i + 1}: элементов ${items.length}`);
          console.log('Первые 3 элемента:');
          for (let j = 0; j < Math.min(3, items.length); j++) {
            console.log(`  ${j + 1}: ${items[j].textContent.trim().substring(0, 100)}`);
          }
        }
      });
    }
    
    // Вариант 3: Дивы с классами activity/history/log
    const activityDivs = document.querySelectorAll('[class*="activity"], [class*="history"], [class*="log"], [class*="timeline"]');
    console.log(`\nНайдено блоков с activity/history/log: ${activityDivs.length}`);
    
    if (activityDivs.length > 0) {
      activityDivs.forEach((div, i) => {
        console.log(`\nБлок ${i + 1}:`);
        console.log(`  Класс: ${div.className}`);
        console.log(`  Содержимое: ${div.textContent.trim().substring(0, 200)}`);
      });
    }
    
    // Вариант 4: Скрипты с данными (JSON в window)
    const scripts = document.querySelectorAll('script');
    console.log(`\nНайдено скриптов: ${scripts.length}`);
    
    let foundData = false;
    scripts.forEach((script, i) => {
      const content = script.textContent;
      if (content.includes('history') || content.includes('activity') || content.includes('timeline')) {
        console.log(`\nСкрипт ${i + 1} содержит данные:`);
        console.log(content.substring(0, 300));
        foundData = true;
      }
    });
    
    if (!foundData) {
      console.log('\n💡 Данные не найдены в скриптах');
    }
    
    // Сохраняем HTML для анализа
    const fs = await import('fs');
    fs.writeFileSync('history_page.html', html);
    console.log('\n💾 HTML сохранен в history_page.html');
    
    return { html, document };
    
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    return null;
  }
}

async function main() {
  console.log('🚀 Парсинг страницы истории RentProg');
  console.log('=' .repeat(60) + '\n');
  
  const token = TOKENS.tbilisi;
  await fetchHistoryPage(token, 'tbilisi');
  
  console.log('\n' + '='.repeat(60));
  console.log('✅ Анализ завершен!');
  console.log('\n📝 Следующий шаг:');
  console.log('   1. Открыть history_page.html');
  console.log('   2. Найти где хранятся данные истории');
  console.log('   3. Обновить скрипт для извлечения данных');
}

main();

