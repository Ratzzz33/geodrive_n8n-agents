/**
 * Полный сбор данных партнеров и машин по всем филиалам
 * Использует Puppeteer для автоматизации
 */

import puppeteer from 'puppeteer';
import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const BRANCHES = {
  tbilisi: {
    login: 'eliseevaleksei32@gmail.com',
    password: 'a0babuz0'
  },
  batumi: {
    login: 'ceo@geodrive.rent',
    password: 'a6wumobt'
  },
  kutaisi: {
    login: 'geodrivekutaisi2@gmail.com',
    password: '8fia8mor'
  },
  'service-center': {
    login: 'sofia2020eliseeva@gmail.com',
    password: 'x2tn7hks'
  }
};

// Общий список партнеров (одинаковый для всех филиалов)
const INVESTOR_IDS = ['222', '748', '749', '769', '773', '774', '775', '776', '777', '779', '780', '781', '782', '783', '785'];

async function loginToBranch(page, branchName) {
  const creds = BRANCHES[branchName];
  console.log(`\n🔐 Вход в ${branchName}...`);
  
  await page.goto('https://web.rentprog.ru/signin?from=%2Fcompany_counts', { waitUntil: 'networkidle2' });
  
  // Подождать появления форм
  await page.waitForSelector('input[type="email"], input[type="text"]', { timeout: 10000 });
  
  // Найти поля
  const inputs = await page.$$('input');
  let emailInput, passwordInput;
  
  for (const input of inputs) {
    const type = await input.evaluate(el => el.type);
    if (type === 'email' || type === 'text') {
      if (!emailInput) emailInput = input;
    } else if (type === 'password') {
      passwordInput = input;
    }
  }
  
  if (emailInput && passwordInput) {
    await emailInput.type(creds.login);
    await passwordInput.type(creds.password);
    
    // Кликнуть кнопку входа
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle2' }),
      page.click('button[type="submit"]')
    ]);
    
    console.log(`✅ Вход в ${branchName} выполнен`);
    return true;
  }
  
  console.error(`❌ Не удалось найти форму входа для ${branchName}`);
  return false;
}

async function collectInvestorData(page, investorId) {
  try {
    await page.goto(`https://web.rentprog.ru/investors/${investorId}`, { waitUntil: 'networkidle2' });
    
    // Кликнуть на кнопку "Автомобили"
    const buttons = await page.$$('button');
    for (const button of buttons) {
      const text = await button.evaluate(el => el.textContent);
      if (text.includes('Автомобили')) {
        await button.click();
        await page.waitForTimeout(2000); // Подождать загрузки
        break;
      }
    }
    
    // Прокрутить страницу
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    
    // Собрать данные
    const data = await page.evaluate((id) => {
      const result = {
        investor_id: id,
        investor_name: '',
        cars: []
      };
      
      // Имя партнера
      const titleEl = document.querySelector('.v-card__title');
      if (titleEl) {
        const match = titleEl.textContent.match(/Партнёр - (.+?)\s*\|/);
        if (match) result.investor_name = match[1].trim();
      }
      
      // Машины
      const carLinks = Array.from(document.querySelectorAll('a[href*="/cars/"]'));
      const uniqueCars = new Map();
      
      for (const link of carLinks) {
        const carId = link.href.match(/\/cars\/(\d+)/)?.[1];
        if (!carId || uniqueCars.has(carId)) continue;
        
        const text = link.textContent.trim();
        const match = text.match(/^(.+?)\s+([A-Z0-9]{2,10})$/);
        
        uniqueCars.set(carId, {
          car_id: carId,
          model: match ? match[1].trim() : text,
          plate: match ? match[2].trim() : ''
        });
      }
      
      result.cars = Array.from(uniqueCars.values());
      
      // Проверка "Нет добавленных автомобилей"
      if (document.body.textContent.includes('Нет добавленных автомобилей')) {
        result.note = 'No cars';
      }
      
      return result;
    }, investorId);
    
    return data;
  } catch (error) {
    console.error(`❌ Ошибка сбора данных для партнера ${investorId}:`, error.message);
    return null;
  }
}

async function main() {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  
  const allData = {
    tbilisi: [],
    batumi: [],
    kutaisi: [],
    'service-center': []
  };
  
  try {
    for (const [branchName, creds] of Object.entries(BRANCHES)) {
      console.log(`\n🏢 Обработка филиала: ${branchName.toUpperCase()}`);
      
      // Логин
      const loggedIn = await loginToBranch(page, branchName);
      if (!loggedIn) {
        console.error(`⏭️ Пропускаем ${branchName} - ошибка входа`);
        continue;
      }
      
      // Собрать данные всех партнеров
      for (const investorId of INVESTOR_IDS) {
        console.log(`  📊 Партнер ${investorId}...`);
        const data = await collectInvestorData(page, investorId);
        
        if (data) {
          allData[branchName].push(data);
          
          if (data.cars.length > 0) {
            console.log(`    ✅ ${data.investor_name}: ${data.cars.length} машин`);
          } else {
            console.log(`    ⚪ ${data.investor_name}: нет машин`);
          }
        }
      }
      
      console.log(`✅ ${branchName}: собрано ${allData[branchName].length} партнеров`);
    }
    
    // Сохранить результаты
    console.log('\n\n📊 ИТОГОВАЯ СТАТИСТИКА:\n');
    let totalInvestors = 0;
    let totalCars = 0;
    
    for (const [branch, investors] of Object.entries(allData)) {
      const branchCars = investors.reduce((sum, inv) => sum + inv.cars.length, 0);
      console.log(`${branch}: ${investors.length} партнеров, ${branchCars} машин`);
      totalInvestors += investors.length;
      totalCars += branchCars;
    }
    
    console.log(`\nВСЕГО: ${totalInvestors} записей партнеров, ${totalCars} машин`);
    
    // Сохранить в JSON
    const fs = await import('fs/promises');
    await fs.writeFile(
      'temp_investors_collected.json',
      JSON.stringify(allData, null, 2)
    );
    
    console.log('\n✅ Данные сохранены в temp_investors_collected.json');
    
    // Теперь сохраним в БД
    await saveToDatabase(allData);
    
  } catch (error) {
    console.error('\n❌ ОШИБКА:', error);
  } finally {
    await browser.close();
  }
}

async function saveToDatabase(allData) {
  console.log('\n\n💾 Сохранение в базу данных...\n');
  
  const sql = postgres(CONNECTION_STRING, {
    max: 1,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    let savedInvestors = 0;
    let savedLinks = 0;
    
    for (const [branch, investors] of Object.entries(allData)) {
      for (const investor of investors) {
        if (investor.cars.length === 0) continue; // Пропускаем партнеров без машин
        
        // Сохранить партнера в rentprog_employees если его еще нет
        // (проверим через external_refs)
        const existing = await sql`
          SELECT e.id FROM employees e
          JOIN external_refs er ON er.entity_id = e.id AND er.entity_type = 'employee'
          WHERE er.system = 'rentprog' AND er.external_id = ${investor.investor_id}
          LIMIT 1
        `;
        
        let employeeId;
        
        if (existing.length === 0) {
          // Создать нового
          const [newEmployee] = await sql`
            INSERT INTO employees (name, branch_id)
            VALUES (
              ${investor.investor_name},
              (SELECT id FROM branches WHERE slug = ${branch} LIMIT 1)
            )
            RETURNING id
          `;
          
          employeeId = newEmployee.id;
          
          // Создать external_ref
          await sql`
            INSERT INTO external_refs (entity_type, entity_id, system, external_id)
            VALUES ('employee', ${employeeId}, 'rentprog', ${investor.investor_id})
          `;
          
          savedInvestors++;
          console.log(`  ✅ Создан партнер: ${investor.investor_name} (${investor.investor_id})`);
        } else {
          employeeId = existing[0].id;
        }
        
        // Привязать машины к партнеру
        for (const car of investor.cars) {
          // Найти машину по RentProg car_id
          const carRecord = await sql`
            SELECT c.id FROM cars c
            JOIN external_refs er ON er.entity_id = c.id AND er.entity_type = 'car'
            WHERE er.system = 'rentprog' AND er.external_id = ${car.car_id}
            LIMIT 1
          `;
          
          if (carRecord.length > 0) {
            const carId = carRecord[0].id;
            
            // Обновить investor_id в cars
            await sql`
              UPDATE cars
              SET investor_id = ${investor.investor_id}
              WHERE id = ${carId}
            `;
            
            savedLinks++;
            console.log(`    🔗 Привязана машина ${car.plate} → ${investor.investor_name}`);
          } else {
            console.log(`    ⚠️ Машина ${car.plate} (RentProg ID: ${car.car_id}) не найдена в БД`);
          }
        }
      }
    }
    
    console.log(`\n✅ Сохранено: ${savedInvestors} партнеров, ${savedLinks} связей машин`);
    
  } catch (error) {
    console.error('❌ Ошибка сохранения в БД:', error);
  } finally {
    await sql.end();
  }
}

main().catch(console.error);

