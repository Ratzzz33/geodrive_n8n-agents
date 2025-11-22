/**
 * Скрипт для поиска и связывания партнеров/инвесторов с машинами
 * 
 * Шаги:
 * 1. Находим уникальные investor_id из data полей машин
 * 2. Получаем информацию о партнерах через RentProg API /users
 * 3. Импортируем партнеров в rentprog_employees
 * 4. Создаем записи в external_refs (тип 'investor')
 * 5. Обновляем investor_id колонку в таблице cars
 */

import postgres from 'postgres';

const sql = postgres('postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require', {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

// Bearer токены для каждого филиала
const TOKENS = {
  'service-center': 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxNjA0NSIsInNjcCI6InVzZXIiLCJhdWQiOm51bGwsImlhdCI6MTc2MjQ5MDA0MSwiZXhwIjoxNzY1MDgyMDQxLCJqdGkiOiI1ZDkwMDI2MC02NTE2LTQxYjctOTI4Ny1jODAyMjNiN2EwNTMifQ.oLMvW9mftfJ9Oivy2riQjx8uK12Ur6aaFy02sDs6DSc',
  'tbilisi': 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxNjA0NiIsInNjcCI6InVzZXIiLCJhdWQiOm51bGwsImlhdCI6MTc2MjQ5MDExMywiZXhwIjoxNzY1MDgyMTEzLCJqdGkiOiI0MmUxNzQ5Zi02MjEyLTRmOTMtOGM0Zi02ZWMwODUzYmUwYWQifQ.20oXaXcgK_hdofbUK3RGdQuPa0pGWtZTV4b42-A8oY4',
  'batumi': 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxNjA0OCIsInNjcCI6InVzZXIiLCJhdWQiOm51bGwsImlhdCI6MTc2MjQ5MDE1NCwiZXhwIjoxNzY1MDgyMTU0LCJqdGkiOiI0MWUxMjRjOS01MDgxLTQ2NmMtOTUxNS0xNWEwMjE4ZDA1OTEifQ.l2MfCEf1LJLe-kCuF-MKyOMdhAmd3UWfzG7xECMy37o',
  'kutaisi': 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxNjA0OSIsInNjcCI6InVzZXIiLCJhdWQiOm51bGwsImlhdCI6MTc2MjQ5MDIwMiwiZXhwIjoxNzY1MDgyMjAyLCJqdGkiOiIxZWVlMWU2YS1kMTNhLTQwMzEtYjI2Mi04NGRiM2Y0ZmFiMGEifQ.xGIpTLumIwLxpitlLbeclqb9XBedY8jV1wCIuMP69Vs'
};

const BASE_URL = 'https://rentprog.net/api/v1';

/**
 * Получить пользователей из RentProg API для филиала
 */
async function getUsersFromRentProg(branch) {
  const token = TOKENS[branch];
  
  try {
    const response = await fetch(`${BASE_URL}/users`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
        'Origin': 'https://web.rentprog.ru',
        'Referer': 'https://web.rentprog.ru/'
      }
    });
    
    if (!response.ok) {
      console.error(`❌ ${branch}: HTTP ${response.status}`);
      return [];
    }
    
    const json = await response.json();
    
    if (Array.isArray(json)) {
      return json;
    }
    
    return [];
    
  } catch (error) {
    console.error(`❌ ${branch}:`, error.message);
    return [];
  }
}

/**
 * Основная функция
 */
async function main() {
  try {
    console.log('🚀 Начинаем поиск и связывание партнеров с машинами\n');
    
    // Шаг 1: Получаем уникальные investor_id из data полей
    console.log('📊 Шаг 1: Получение уникальных investor_id из машин...');
    const investorIds = await sql`
      SELECT DISTINCT 
        (data->>'investor_id')::bigint as investor_id
      FROM cars
      WHERE data ? 'investor_id' 
        AND data->>'investor_id' IS NOT NULL
        AND data->>'investor_id' != 'null'
        AND data->>'investor_id' ~ '^[0-9]+$'
      ORDER BY investor_id
    `;
    
    console.log(`   Найдено уникальных investor_id: ${investorIds.length}`);
    console.log(`   ID: ${investorIds.map(r => r.investor_id).join(', ')}\n`);
    
    if (investorIds.length === 0) {
      console.log('   ℹ️ Нет машин с investor_id, завершаем');
      return;
    }
    
    // Шаг 2: Получаем всех пользователей из всех филиалов
    console.log('📥 Шаг 2: Получение пользователей из RentProg API...');
    const branches = ['tbilisi', 'batumi', 'kutaisi', 'service-center'];
    const allUsers = [];
    
    for (const branch of branches) {
      const users = await getUsersFromRentProg(branch);
      console.log(`   ${branch}: ${users.length} пользователей`);
      allUsers.push(...users.map(u => ({ ...u, branch })));
    }
    
    console.log(`   Всего пользователей: ${allUsers.length}\n`);
    
    // Шаг 3: Находим партнеров по investor_id
    console.log('🔍 Шаг 3: Поиск партнеров...');
    const investorIdsSet = new Set(investorIds.map(r => r.investor_id));
    const foundInvestors = allUsers.filter(u => investorIdsSet.has(u.id));
    
    console.log(`   Найдено партнеров: ${foundInvestors.length}`);
    foundInvestors.forEach(inv => {
      console.log(`   - ID ${inv.id}: ${inv.name || inv.email} (${inv.role || 'unknown role'}) [${inv.branch}]`);
    });
    console.log();
    
    // Шаг 4: Импортируем партнеров в rentprog_employees
    console.log('💾 Шаг 4: Импорт партнеров в rentprog_employees...');
    let imported = 0;
    let skipped = 0;
    
    for (const investor of foundInvestors) {
      const rentprogId = String(investor.id);
      
      // Проверяем, есть ли уже в базе
      const existing = await sql`
        SELECT id FROM rentprog_employees
        WHERE rentprog_id = ${rentprogId}
      `;
      
      if (existing.length > 0) {
        console.log(`   ⏭️  ID ${rentprogId}: уже существует`);
        skipped++;
        continue;
      }
      
      // Импортируем
      await sql`
        INSERT INTO rentprog_employees (
          id, rentprog_id, name, first_name, last_name,
          email, role, active,
          data, created_at, updated_at
        )
        VALUES (
          gen_random_uuid(),
          ${rentprogId},
          ${investor.name || null},
          ${investor.first_name || null},
          ${investor.last_name || null},
          ${investor.email || null},
          ${investor.role || null},
          ${investor.active !== false},
          ${JSON.stringify(investor)}::jsonb,
          NOW(),
          NOW()
        )
      `;
      
      console.log(`   ✅ ID ${rentprogId}: импортирован`);
      imported++;
    }
    
    console.log(`   Импортировано: ${imported}, Пропущено: ${skipped}\n`);
    
    // Шаг 5: Создаем записи в external_refs для партнеров
    console.log('🔗 Шаг 5: Создание записей в external_refs...');
    let refsCreated = 0;
    let refsSkipped = 0;
    
    for (const investor of foundInvestors) {
      const rentprogId = String(investor.id);
      
      // Получаем entity_id из rentprog_employees
      const employee = await sql`
        SELECT id FROM rentprog_employees
        WHERE rentprog_id = ${rentprogId}
      `;
      
      if (employee.length === 0) {
        console.log(`   ⚠️  ID ${rentprogId}: не найден в rentprog_employees`);
        continue;
      }
      
      const entityId = employee[0].id;
      
      // Проверяем, есть ли уже external_ref
      const existingRef = await sql`
        SELECT id FROM external_refs
        WHERE system = 'rentprog'
          AND entity_type = 'investor'
          AND external_id = ${rentprogId}
      `;
      
      if (existingRef.length > 0) {
        console.log(`   ⏭️  ID ${rentprogId}: external_ref уже существует`);
        refsSkipped++;
        continue;
      }
      
      // Создаем external_ref
      await sql`
        INSERT INTO external_refs (
          entity_type, entity_id, system, external_id,
          branch_code, meta, created_at, updated_at
        )
        VALUES (
          'investor',
          ${entityId},
          'rentprog',
          ${rentprogId},
          ${investor.branch},
          ${JSON.stringify({ name: investor.name, role: investor.role })}::jsonb,
          NOW(),
          NOW()
        )
      `;
      
      console.log(`   ✅ ID ${rentprogId}: external_ref создан`);
      refsCreated++;
    }
    
    console.log(`   Создано: ${refsCreated}, Пропущено: ${refsSkipped}\n`);
    
    // Шаг 6: Обновляем investor_id в таблице cars
    console.log('🚗 Шаг 6: Обновление investor_id в таблице cars...');
    const updated = await sql`
      UPDATE cars
      SET investor_id = (data->>'investor_id')::bigint,
          updated_at = NOW()
      WHERE data ? 'investor_id'
        AND data->>'investor_id' IS NOT NULL
        AND data->>'investor_id' != 'null'
        AND data->>'investor_id' ~ '^[0-9]+$'
        AND (investor_id IS NULL OR investor_id != (data->>'investor_id')::bigint)
      RETURNING id, plate, model, investor_id
    `;
    
    console.log(`   Обновлено машин: ${updated.length}`);
    updated.forEach(car => {
      console.log(`   ✅ ${car.plate} (${car.model}) → investor_id: ${car.investor_id}`);
    });
    console.log();
    
    // Итоговая статистика
    console.log('📊 Итоговая статистика:');
    const stats = await sql`
      SELECT 
        COUNT(*) as total_cars,
        COUNT(investor_id) as cars_with_investor,
        COUNT(DISTINCT investor_id) as unique_investors
      FROM cars
    `;
    
    console.log(`   Всего машин: ${stats[0].total_cars}`);
    console.log(`   Машин с партнером: ${stats[0].cars_with_investor}`);
    console.log(`   Уникальных партнеров: ${stats[0].unique_investors}`);
    
    // Список машин по партнерам
    console.log('\n📋 Машины по партнерам:');
    const carsByInvestor = await sql`
      SELECT 
        c.investor_id,
        re.name as investor_name,
        re.role as investor_role,
        COUNT(*) as car_count,
        STRING_AGG(c.plate || ' (' || c.model || ')', ', ') as cars
      FROM cars c
      LEFT JOIN rentprog_employees re ON re.rentprog_id = c.investor_id::text
      WHERE c.investor_id IS NOT NULL
      GROUP BY c.investor_id, re.name, re.role
      ORDER BY c.investor_id
    `;
    
    carsByInvestor.forEach(row => {
      console.log(`\n   Партнер ID ${row.investor_id}: ${row.investor_name || 'Неизвестно'} (${row.investor_role || 'unknown'})`);
      console.log(`   Машин: ${row.car_count}`);
      console.log(`   Список: ${row.cars}`);
    });
    
    console.log('\n✅ Работа завершена успешно!\n');
    
  } catch (error) {
    console.error('\n❌ Ошибка:', error);
    throw error;
  } finally {
    await sql.end();
  }
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

