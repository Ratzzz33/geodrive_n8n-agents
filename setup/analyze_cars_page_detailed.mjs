import puppeteer from 'puppeteer';
import fs from 'fs';

const LOGIN_CREDENTIALS = {
  email: 'eliseevaleksei32@gmail.com',
  password: 'a0babuz0'
};

async function analyzeCarsPage() {
  console.log('🚀 Запускаю браузер для детального анализа страницы /cars...\n');
  
  const browser = await puppeteer.launch({ 
    headless: false,
    args: ['--no-sandbox', '--window-size=1920,1080']
  });
  
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  
  try {
    // 1. Логин
    console.log('1️⃣  Логин в систему...');
    await page.goto('https://web.rentprog.ru/signin', { waitUntil: 'networkidle2' });
    
    await page.type('input[type="email"]', LOGIN_CREDENTIALS.email);
    await page.type('input[type="password"]', LOGIN_CREDENTIALS.password);
    await page.click('button[type="submit"]');
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 });
    
    console.log('✅ Успешный логин!\n');
    
    // 2. Переход на страницу /cars
    console.log('2️⃣  Переход на страницу /cars...');
    await page.goto('https://web.rentprog.ru/cars', { waitUntil: 'networkidle2', timeout: 30000 });
    await page.waitForTimeout(3000);
    
    console.log('✅ Страница загружена!\n');
    
    // 3. Анализ визуальных элементов
    console.log('3️⃣  АНАЛИЗ ВИЗУАЛЬНЫХ ЭЛЕМЕНТОВ:\n');
    console.log('='.repeat(80));
    
    // Ищем иконки и цветовые индикаторы
    const visualElements = await page.evaluate(() => {
      const results = {
        icons: [],
        colors: [],
        badges: [],
        buttons: [],
        tabs: []
      };
      
      // Иконки
      document.querySelectorAll('i, svg, .icon').forEach(el => {
        const text = el.textContent || el.className || el.outerHTML.substring(0, 100);
        if (text && !results.icons.includes(text)) {
          results.icons.push(text);
        }
      });
      
      // Цветные индикаторы (зеленые/красные кружки)
      document.querySelectorAll('[style*="color"], .badge, .status').forEach(el => {
        const style = window.getComputedStyle(el);
        const color = style.color || style.backgroundColor;
        const text = el.textContent?.trim();
        if (color && (color.includes('rgb') || color.includes('#'))) {
          results.colors.push({ color, text: text?.substring(0, 50), class: el.className });
        }
      });
      
      // Бейджи и статусы
      document.querySelectorAll('.badge, .chip, .tag, [class*="status"]').forEach(el => {
        results.badges.push({
          text: el.textContent?.trim(),
          class: el.className,
          style: el.getAttribute('style')
        });
      });
      
      // Кнопки и действия
      document.querySelectorAll('button, .action, [role="button"]').forEach(el => {
        const text = el.textContent?.trim();
        if (text && text.length > 0 && text.length < 50) {
          results.buttons.push(text);
        }
      });
      
      // Вкладки
      document.querySelectorAll('[role="tab"], .tab, .v-tab').forEach(el => {
        results.tabs.push(el.textContent?.trim());
      });
      
      return results;
    });
    
    console.log('🎨 ЦВЕТОВЫЕ ИНДИКАТОРЫ:');
    visualElements.colors.slice(0, 10).forEach(item => {
      console.log(`   ${item.color} → "${item.text}" (${item.class})`);
    });
    
    console.log('\n📛 БЕЙДЖИ/СТАТУСЫ:');
    visualElements.badges.slice(0, 10).forEach(item => {
      console.log(`   "${item.text}" (${item.class})`);
    });
    
    console.log('\n📑 ВКЛАДКИ:');
    visualElements.tabs.forEach(tab => {
      console.log(`   - ${tab}`);
    });
    
    // 4. Скриншот главной страницы
    await page.screenshot({ path: 'setup/cars_page_screenshot.png', fullPage: false });
    console.log('\n📸 Скриншот сохранен: setup/cars_page_screenshot.png');
    
    // 5. Получаем данные из таблицы
    console.log('\n4️⃣  АНАЛИЗ ТАБЛИЦЫ АВТОМОБИЛЕЙ:\n');
    console.log('='.repeat(80));
    
    const tableData = await page.evaluate(() => {
      const headers = [];
      const rows = [];
      
      // Заголовки
      document.querySelectorAll('th, [role="columnheader"]').forEach(th => {
        headers.push(th.textContent?.trim());
      });
      
      // Первые 3 строки
      document.querySelectorAll('tr, [role="row"]').forEach((tr, idx) => {
        if (idx > 0 && idx <= 3) {
          const cells = [];
          tr.querySelectorAll('td, [role="cell"]').forEach(td => {
            // Ищем иконки внутри ячейки
            const icons = [];
            td.querySelectorAll('i, svg, .icon').forEach(icon => {
              icons.push(icon.className || icon.textContent?.trim());
            });
            
            // Цвет фона/текста
            const style = window.getComputedStyle(td);
            const color = style.color || style.backgroundColor;
            
            cells.push({
              text: td.textContent?.trim(),
              icons: icons,
              color: color !== 'rgb(0, 0, 0)' && color !== 'rgba(0, 0, 0, 0)' ? color : null,
              hasLink: td.querySelector('a') !== null
            });
          });
          rows.push(cells);
        }
      });
      
      return { headers, rows };
    });
    
    console.log('📋 ЗАГОЛОВКИ ТАБЛИЦЫ:');
    tableData.headers.forEach((h, i) => {
      console.log(`   ${i + 1}. ${h}`);
    });
    
    console.log('\n🚗 ПРИМЕРЫ ДАННЫХ (первые 3 машины):');
    tableData.rows.forEach((row, rowIdx) => {
      console.log(`\n   Машина ${rowIdx + 1}:`);
      row.forEach((cell, cellIdx) => {
        if (cell.text) {
          let info = `      ${tableData.headers[cellIdx] || cellIdx}: ${cell.text}`;
          if (cell.icons.length > 0) info += ` [иконки: ${cell.icons.join(', ')}]`;
          if (cell.color) info += ` [цвет: ${cell.color}]`;
          console.log(info);
        }
      });
    });
    
    // 6. Открываем детальную страницу первой машины
    console.log('\n5️⃣  ПЕРЕХОД НА ДЕТАЛЬНУЮ СТРАНИЦУ АВТОМОБИЛЯ:\n');
    console.log('='.repeat(80));
    
    const firstCarLink = await page.$('tr a, [role="row"] a');
    if (firstCarLink) {
      await firstCarLink.click();
      await page.waitForTimeout(2000);
      
      // Ищем вкладки на детальной странице
      const detailTabs = await page.evaluate(() => {
        const tabs = [];
        document.querySelectorAll('[role="tab"], .tab, .v-tab').forEach(el => {
          tabs.push(el.textContent?.trim());
        });
        return tabs;
      });
      
      console.log('📑 ВКЛАДКИ НА ДЕТАЛЬНОЙ СТРАНИЦЕ:');
      detailTabs.forEach(tab => {
        console.log(`   - ${tab}`);
      });
      
      // Скриншот детальной страницы
      await page.screenshot({ path: 'setup/car_detail_screenshot.png', fullPage: false });
      console.log('\n📸 Скриншот детальной страницы: setup/car_detail_screenshot.png');
    }
    
    // 7. Финальный отчет
    console.log('\n\n📊 ФИНАЛЬНЫЙ ОТЧЕТ:\n');
    console.log('='.repeat(80));
    
    const report = {
      timestamp: new Date().toISOString(),
      headers: tableData.headers,
      visualElements: {
        totalIcons: visualElements.icons.length,
        totalColors: visualElements.colors.length,
        totalBadges: visualElements.badges.length,
        tabs: visualElements.tabs
      },
      detailTabs: detailTabs || []
    };
    
    fs.writeFileSync('setup/cars_page_analysis.json', JSON.stringify(report, null, 2));
    console.log('✅ Полный отчет сохранен в: setup/cars_page_analysis.json');
    
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
  } finally {
    console.log('\n\n⏳ Закрываю браузер через 10 секунд...');
    await page.waitForTimeout(10000);
    await browser.close();
  }
}

analyzeCarsPage();

