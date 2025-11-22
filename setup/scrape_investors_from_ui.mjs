/**
 * Автоматизированный сбор данных о партнерах из RentProg UI
 * Использует MCP Chrome DevTools для навигации и парсинга
 * 
 * Для каждого филиала:
 * 1. Авторизуется в RentProg
 * 2. Открывает страницу /investors
 * 3. Парсит список партнеров
 * 4. Для каждого партнера - собирает все машины (с учетом пагинации)
 * 5. Сохраняет в БД
 */

import postgres from 'postgres';

const sql = postgres('postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require', {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

// Креденшелы по филиалам
const CREDENTIALS = {
  'tbilisi': { 
    login: 'eliseevaleksei32@gmail.com', 
    password: 'a0babuz0'
  },
  'batumi': { 
    login: 'ceo@geodrive.rent', 
    password: 'a6wumobt'
  },
  'kutaisi': { 
    login: 'geodrivekutaisi2@gmail.com', 
    password: '8fia8mor'
  },
  'service-center': { 
    login: 'sofia2020eliseeva@gmail.com', 
    password: 'x2tn7hks'
  }
};

/**
 * ИНСТРУКЦИЯ ДЛЯ АГЕНТА:
 * 
 * Используй MCP инструменты chrome-devtools для автоматизации:
 * 1. mcp_chrome-devtools_navigate - навигация по страницам
 * 2. mcp_chrome-devtools_click - клики по элементам
 * 3. mcp_chrome-devtools_type - ввод текста
 * 4. mcp_chrome-devtools_evaluate - выполнение JavaScript
 * 5. mcp_chrome-devtools_get_content - получение HTML
 * 6. mcp_chrome-devtools_wait_for - ожидание элементов
 * 
 * Алгоритм для каждого филиала:
 * 
 * Шаг 1: Авторизация
 * - navigate('https://web.rentprog.ru/signin')
 * - type('input[name="email"]', credentials.login)
 * - type('input[name="password"]', credentials.password)
 * - click('button[type="submit"]')
 * - wait_for('.main-content') // ждем загрузки дашборда
 * 
 * Шаг 2: Переход на страницу партнеров
 * - navigate('https://web.rentprog.ru/investors')
 * - wait_for('.investors-list') // ждем загрузки списка
 * 
 * Шаг 3: Парсинг списка партнеров
 * - evaluate(парсинг списка партнеров из DOM)
 * - Для каждого партнера запомнить: ID, имя, ссылку
 * 
 * Шаг 4: Для каждого партнера
 * - navigate(URL партнера)
 * - wait_for('.cars-list')
 * - Проверить пагинацию: evaluate('document.querySelector(".pagination")')
 * - Если есть "Страница 1 из N":
 *   - Собрать машины с текущей страницы
 *   - Перейти на следующую страницу (click('.next-page'))
 *   - Повторить пока не закончатся страницы
 * - Сохранить все машины партнера
 * 
 * Шаг 5: Сохранение в БД
 * - Для каждой связки (партнер, машина):
 *   - Найти машину в таблице cars по номеру
 *   - Обновить investor_id
 *   - Создать/обновить запись в rentprog_employees для партнера
 */

/**
 * Структура данных для сохранения
 */
const collectedData = {
  // branch_code: [
  //   {
  //     investor_id: 'xxx',
  //     investor_name: 'Name',
  //     investor_email: 'email@example.com',
  //     cars: [
  //       { plate: 'AB123CD', model: 'Toyota Camry', year: 2020 },
  //       ...
  //     ]
  //   },
  //   ...
  // ]
};

/**
 * Сохранение данных в БД
 */
async function saveInvestorData(branchCode, investorData) {
  try {
    console.log(`\n💾 Сохранение данных партнера ${investorData.investor_id} (${branchCode})...`);
    
    // 1. Проверяем/создаем партнера в rentprog_employees
    const investorId = String(investorData.investor_id);
    
    const existing = await sql`
      SELECT id FROM rentprog_employees
      WHERE rentprog_id = ${investorId}
    `;
    
    let employeeUuid;
    
    if (existing.length === 0) {
      // Создаем нового партнера
      const result = await sql`
        INSERT INTO rentprog_employees (
          id, rentprog_id, name, email, role, active, created_at, updated_at
        )
        VALUES (
          gen_random_uuid(),
          ${investorId},
          ${investorData.investor_name || null},
          ${investorData.investor_email || null},
          'partner',
          true,
          NOW(),
          NOW()
        )
        RETURNING id
      `;
      employeeUuid = result[0].id;
      console.log(`   ✅ Партнер создан: ${investorData.investor_name || investorId}`);
    } else {
      employeeUuid = existing[0].id;
      // Обновляем данные партнера
      await sql`
        UPDATE rentprog_employees
        SET name = ${investorData.investor_name || null},
            email = ${investorData.investor_email || null},
            role = 'partner',
            updated_at = NOW()
        WHERE id = ${employeeUuid}
      `;
      console.log(`   ✅ Партнер обновлен: ${investorData.investor_name || investorId}`);
    }
    
    // 2. Создаем external_ref для партнера
    await sql`
      INSERT INTO external_refs (
        entity_type, entity_id, system, external_id,
        branch_code, meta, created_at, updated_at
      )
      VALUES (
        'investor',
        ${employeeUuid},
        'rentprog',
        ${investorId},
        ${branchCode},
        ${JSON.stringify({ name: investorData.investor_name, email: investorData.investor_email })}::jsonb,
        NOW(),
        NOW()
      )
      ON CONFLICT (system, external_id) DO UPDATE
      SET branch_code = EXCLUDED.branch_code,
          meta = EXCLUDED.meta,
          updated_at = NOW()
    `;
    
    // 3. Обновляем investor_id в машинах
    let updatedCount = 0;
    for (const car of investorData.cars) {
      if (!car.plate) continue;
      
      const result = await sql`
        UPDATE cars
        SET investor_id = ${parseInt(investorId)},
            updated_at = NOW()
        WHERE plate = ${car.plate}
        RETURNING id, plate, model
      `;
      
      if (result.length > 0) {
        console.log(`   ✅ ${car.plate} → партнер ${investorId}`);
        updatedCount++;
      } else {
        console.log(`   ⚠️  ${car.plate} не найдена в БД`);
      }
    }
    
    console.log(`   Обновлено машин: ${updatedCount} из ${investorData.cars.length}`);
    
  } catch (error) {
    console.error(`   ❌ Ошибка сохранения:`, error.message);
  }
}

/**
 * Главная функция (вызывается агентом после сбора данных через MCP)
 */
async function saveAllCollectedData() {
  try {
    console.log('💾 Сохранение собранных данных в БД...\n');
    
    let totalInvestors = 0;
    let totalCars = 0;
    
    for (const [branch, investors] of Object.entries(collectedData)) {
      console.log(`\n📂 Филиал: ${branch}`);
      console.log(`   Партнеров: ${investors.length}`);
      
      for (const investor of investors) {
        await saveInvestorData(branch, investor);
        totalInvestors++;
        totalCars += investor.cars.length;
      }
    }
    
    console.log(`\n✅ Сохранение завершено!`);
    console.log(`   Партнеров: ${totalInvestors}`);
    console.log(`   Машин: ${totalCars}`);
    
    // Итоговая статистика
    const stats = await sql`
      SELECT 
        COUNT(*) as total_cars,
        COUNT(investor_id) as cars_with_investor,
        COUNT(DISTINCT investor_id) as unique_investors
      FROM cars
    `;
    
    console.log(`\n📊 Статистика БД:`);
    console.log(`   Всего машин: ${stats[0].total_cars}`);
    console.log(`   С партнером: ${stats[0].cars_with_investor}`);
    console.log(`   Уникальных партнеров: ${stats[0].unique_investors}`);
    
  } catch (error) {
    console.error('❌ Ошибка:', error);
  } finally {
    await sql.end();
  }
}

// Экспорт для использования
export { CREDENTIALS, saveInvestorData, saveAllCollectedData, collectedData };

console.log(`
📋 ИНСТРУКЦИЯ ДЛЯ ЗАПУСКА:

Агент должен использовать MCP chrome-devtools для:
1. Авторизации в каждом филиале (${Object.keys(CREDENTIALS).join(', ')})
2. Парсинга страницы https://web.rentprog.ru/investors
3. Сбора данных о машинах каждого партнера
4. Сохранения данных через функцию saveInvestorData()

Логины и пароли готовы в константе CREDENTIALS.
`);

