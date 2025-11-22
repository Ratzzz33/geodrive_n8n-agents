/**
 * Исправление связей партнеров
 */

import postgres from 'postgres';

const sql = postgres('postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require', {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  try {
    console.log('\n🔧 ИСПРАВЛЕНИЕ СВЯЗЕЙ ПАРТНЕРОВ\n');
    
    // 1. Проверяем партнера 739
    console.log('1️⃣ Поиск партнера 739 в RentProg employees:\n');
    
    const allEmployees = await sql`
      SELECT 
        rentprog_id,
        name,
        role
      FROM rentprog_employees
      WHERE rentprog_id::INT BETWEEN 735 AND 745
      ORDER BY rentprog_id::INT
    `;
    
    console.log(`   Найдено сотрудников с ID 735-745: ${allEmployees.length}`);
    for (const emp of allEmployees) {
      console.log(`   ${emp.rentprog_id} - ${emp.name} (${emp.role})`);
    }
    
    const partner739 = allEmployees.find(e => e.rentprog_id === '739');
    if (!partner739) {
      console.log('\n   ❌ Партнер 739 НЕ НАЙДЕН в rentprog_employees');
      console.log('   💡 Возможно это старый/удаленный партнер');
    }
    
    // 2. Создаем external_refs для всех партнеров
    console.log('\n2️⃣ Создание external_refs для партнеров:\n');
    
    const partners = await sql`
      SELECT 
        id,
        rentprog_id,
        name
      FROM rentprog_employees
      WHERE role = 'partner'
      ORDER BY rentprog_id::INT
    `;
    
    let created = 0;
    let skipped = 0;
    
    for (const partner of partners) {
      try {
        await sql`
          INSERT INTO external_refs (
            entity_type,
            entity_id,
            system,
            external_id
          )
          VALUES (
            'employee',
            ${partner.id},
            'rentprog',
            ${partner.rentprog_id}
          )
        `;
        created++;
        if (created <= 5) {
          console.log(`   ✅ ${partner.rentprog_id} - ${partner.name}`);
        }
      } catch (err) {
        if (err.code === '23505') {
          // Уже существует
          skipped++;
        } else {
          throw err;
        }
      }
    }
    
    if (created > 5) {
      console.log(`   ... и еще ${created - 5} партнеров`);
    }
    
    console.log(`\n   ✅ Создано: ${created}`);
    console.log(`   ⚪ Пропущено (уже есть): ${skipped}`);
    
    // 3. Проверка связей машины ↔ партнеры
    console.log('\n3️⃣ Проверка связей машины ↔ партнеры:\n');
    
    const carsWithPartners = await sql`
      SELECT 
        c.plate,
        c.model,
        c.investor_id,
        b.name as branch,
        rpe.name as partner_name
      FROM cars c
      LEFT JOIN branches b ON b.id = c.branch_id
      LEFT JOIN rentprog_employees rpe ON rpe.rentprog_id = c.investor_id::TEXT
      WHERE c.investor_id IS NOT NULL
      ORDER BY c.investor_id, c.plate
    `;
    
    console.log(`   Всего машин с партнерами: ${carsWithPartners.length}\n`);
    
    for (const car of carsWithPartners) {
      const status = car.partner_name ? '✅' : '❌';
      const partnerInfo = car.partner_name || 'Партнер не найден';
      console.log(`   ${status} ${car.plate} (${car.model}) - Партнер ID ${car.investor_id}: ${partnerInfo}`);
    }
    
    // 4. Итоговая статистика
    console.log('\n📈 ИТОГОВАЯ СТАТИСТИКА:\n');
    console.log(`   ✅ Партнеров в БД: ${partners.length}`);
    console.log(`   ✅ External refs создано: ${created}`);
    console.log(`   ✅ Машин с партнерами: ${carsWithPartners.length}`);
    
    const linkedCount = carsWithPartners.filter(c => c.partner_name).length;
    const unlinkedCount = carsWithPartners.length - linkedCount;
    
    console.log(`   ✅ Связанных машин: ${linkedCount}`);
    if (unlinkedCount > 0) {
      console.log(`   ⚠️  Несвязанных машин: ${unlinkedCount} (партнер не найден в БД)`);
    }
    
    console.log('\n✅ Готово!\n');
    
  } catch (error) {
    console.error('\n❌ Ошибка:', error);
  } finally {
    await sql.end();
  }
}

main();

