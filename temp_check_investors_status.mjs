/**
 * Проверка статуса партнеров и их связей
 */

import postgres from 'postgres';

const sql = postgres('postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require', {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  try {
    console.log('\n📊 ПРОВЕРКА СТАТУСА ПАРТНЕРОВ\n');
    console.log('=' .repeat(80) + '\n');
    
    // 1. Партнеры в rentprog_employees
    console.log('1️⃣ Партнеры в rentprog_employees:\n');
    const partners = await sql`
      SELECT 
        rentprog_id,
        name,
        role
      FROM rentprog_employees
      WHERE role = 'partner'
      ORDER BY rentprog_id::INT
    `;
    
    console.log(`   Всего партнеров: ${partners.length}`);
    for (const p of partners.slice(0, 5)) {
      console.log(`   ${p.rentprog_id} - ${p.name}`);
    }
    if (partners.length > 5) {
      console.log(`   ... и еще ${partners.length - 5} партнеров`);
    }
    
    // 2. Машины с investor_id
    console.log('\n2️⃣ Машины с investor_id:\n');
    const carsWithInvestors = await sql`
      SELECT 
        c.plate,
        c.model,
        c.investor_id,
        b.name as branch
      FROM cars c
      LEFT JOIN branches b ON b.id = c.branch_id
      WHERE c.investor_id IS NOT NULL
      ORDER BY c.investor_id, c.plate
    `;
    
    console.log(`   Всего машин с партнерами: ${carsWithInvestors.length}\n`);
    
    // Группируем по investor_id
    const investorGroups = {};
    for (const car of carsWithInvestors) {
      const invId = car.investor_id.toString();
      if (!investorGroups[invId]) {
        investorGroups[invId] = [];
      }
      investorGroups[invId].push(car);
    }
    
    for (const [invId, cars] of Object.entries(investorGroups)) {
      console.log(`   Партнер ID ${invId}: ${cars.length} машин`);
      for (const car of cars) {
        console.log(`      ${car.plate} - ${car.model} (${car.branch})`);
      }
    }
    
    // 3. Проверка связей
    console.log('\n3️⃣ Проверка связей партнер ↔ машины:\n');
    
    const uniqueInvestorIds = Object.keys(investorGroups);
    console.log(`   Уникальных investor_id: ${uniqueInvestorIds.length}`);
    console.log(`   ID: ${uniqueInvestorIds.join(', ')}\n`);
    
    for (const invId of uniqueInvestorIds) {
      // Ищем партнера в rentprog_employees
      const match = await sql`
        SELECT 
          rentprog_id,
          name
        FROM rentprog_employees
        WHERE rentprog_id = ${invId}
          AND role = 'partner'
      `;
      
      if (match.length > 0) {
        console.log(`   ✅ ${invId}: ${match[0].name} (найден в БД)`);
      } else {
        console.log(`   ❌ ${invId}: НЕ НАЙДЕН в rentprog_employees`);
      }
    }
    
    // 4. External refs для партнеров
    console.log('\n4️⃣ External refs для партнеров:\n');
    const partnerRefs = await sql`
      SELECT 
        er.entity_id,
        er.external_id,
        rpe.name
      FROM external_refs er
      JOIN rentprog_employees rpe ON rpe.id = er.entity_id
      WHERE er.entity_type = 'employee'
        AND er.system = 'rentprog'
        AND rpe.role = 'partner'
    `;
    
    if (partnerRefs.length > 0) {
      console.log(`   Найдено external_refs: ${partnerRefs.length}`);
      for (const ref of partnerRefs.slice(0, 5)) {
        console.log(`   ${ref.name}: RentProg ID ${ref.external_id}`);
      }
    } else {
      console.log(`   ❌ External refs для партнеров НЕ СОЗДАНЫ!`);
    }
    
    // 5. Итоговая статистика
    console.log('\n' + '='.repeat(80));
    console.log('\n📈 ИТОГОВАЯ СТАТИСТИКА:\n');
    console.log(`   ✅ Партнеров в БД: ${partners.length}`);
    console.log(`   ✅ Машин с партнерами: ${carsWithInvestors.length}`);
    console.log(`   ✅ Уникальных investor_id: ${uniqueInvestorIds.length}`);
    console.log(`   ${partnerRefs.length > 0 ? '✅' : '❌'} External refs: ${partnerRefs.length}`);
    
    // Проверка совпадений
    const partnerIds = new Set(partners.map(p => p.rentprog_id));
    const matchCount = uniqueInvestorIds.filter(id => partnerIds.has(id)).length;
    const mismatchCount = uniqueInvestorIds.length - matchCount;
    
    console.log(`\n   Совпадений investor_id ↔ partner: ${matchCount}/${uniqueInvestorIds.length}`);
    if (mismatchCount > 0) {
      console.log(`   ⚠️  Несовпадений: ${mismatchCount}`);
    }
    
    console.log('\n');
    
  } catch (error) {
    console.error('\n❌ Ошибка:', error);
  } finally {
    await sql.end();
  }
}

main();

