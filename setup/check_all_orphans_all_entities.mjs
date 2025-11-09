#!/usr/bin/env node
import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

async function checkAllOrphans() {
  const sql = postgres(CONNECTION_STRING, {max: 1, ssl: {rejectUnauthorized: false}});
  
  console.log('\n🔍 ПОЛНАЯ ПРОВЕРКА СИРОТ В EXTERNAL_REFS\n');
  console.log('═══════════════════════════════════════════════════════\n');
  
  try {
    // Получить все типы сущностей в external_refs
    const entityTypes = await sql`
      SELECT DISTINCT entity_type, COUNT(*) as count
      FROM external_refs
      WHERE system = 'rentprog'
      GROUP BY entity_type
      ORDER BY entity_type
    `;
    
    console.log('📊 Типы сущностей в external_refs:');
    entityTypes.forEach(et => {
      console.log(`   ${et.entity_type}: ${et.count} записей`);
    });
    console.log();
    
    let totalOrphans = 0;
    const orphansByType = {};
    
    // 1. ПРОВЕРКА CARS
    console.log('═══════════════════════════════════════════════════════');
    console.log('1️⃣  CARS');
    console.log('═══════════════════════════════════════════════════════\n');
    
    const carsOrphans = await sql`
      SELECT er.entity_id, er.external_id
      FROM external_refs er
      WHERE er.system = 'rentprog'
        AND er.entity_type = 'car'
        AND NOT EXISTS (
          SELECT 1 FROM cars c WHERE c.id = er.entity_id
        )
    `;
    
    orphansByType['car'] = carsOrphans.length;
    totalOrphans += carsOrphans.length;
    
    if (carsOrphans.length === 0) {
      console.log('✅ Сирот не найдено!\n');
    } else {
      console.log(`❌ Найдено сирот: ${carsOrphans.length}\n`);
      carsOrphans.slice(0, 5).forEach((orphan, i) => {
        console.log(`${i + 1}. External ID: ${orphan.external_id}`);
        console.log(`   Entity ID: ${orphan.entity_id}`);
      });
      if (carsOrphans.length > 5) {
        console.log(`   ... и ещё ${carsOrphans.length - 5}\n`);
      }
    }
    
    // Проверка обратной ситуации: cars без external_refs
    const carsWithoutRefs = await sql`
      SELECT c.id
      FROM cars c
      WHERE NOT EXISTS (
        SELECT 1 FROM external_refs er 
        WHERE er.entity_id = c.id 
          AND er.system = 'rentprog' 
          AND er.entity_type = 'car'
      )
      LIMIT 10
    `;
    
    if (carsWithoutRefs.length > 0) {
      console.log(`⚠️  Cars без external_refs: ${carsWithoutRefs.length}`);
      carsWithoutRefs.slice(0, 3).forEach((c, i) => {
        console.log(`   ${i + 1}. ${c.id}`);
      });
      console.log();
    }
    
    // 2. ПРОВЕРКА CLIENTS
    console.log('═══════════════════════════════════════════════════════');
    console.log('2️⃣  CLIENTS');
    console.log('═══════════════════════════════════════════════════════\n');
    
    const clientsOrphans = await sql`
      SELECT er.entity_id, er.external_id
      FROM external_refs er
      WHERE er.system = 'rentprog'
        AND er.entity_type = 'client'
        AND NOT EXISTS (
          SELECT 1 FROM clients c WHERE c.id = er.entity_id
        )
    `;
    
    orphansByType['client'] = clientsOrphans.length;
    totalOrphans += clientsOrphans.length;
    
    if (clientsOrphans.length === 0) {
      console.log('✅ Сирот не найдено!\n');
    } else {
      console.log(`❌ Найдено сирот: ${clientsOrphans.length}\n`);
      clientsOrphans.slice(0, 5).forEach((orphan, i) => {
        console.log(`${i + 1}. External ID: ${orphan.external_id}`);
        console.log(`   Entity ID: ${orphan.entity_id}`);
      });
      if (clientsOrphans.length > 5) {
        console.log(`   ... и ещё ${clientsOrphans.length - 5}\n`);
      }
    }
    
    // Проверка обратной ситуации: clients без external_refs
    const clientsWithoutRefs = await sql`
      SELECT c.id
      FROM clients c
      WHERE NOT EXISTS (
        SELECT 1 FROM external_refs er 
        WHERE er.entity_id = c.id 
          AND er.system = 'rentprog' 
          AND er.entity_type = 'client'
      )
      LIMIT 10
    `;
    
    if (clientsWithoutRefs.length > 0) {
      console.log(`⚠️  Clients без external_refs: ${clientsWithoutRefs.length}`);
      clientsWithoutRefs.slice(0, 3).forEach((c, i) => {
        console.log(`   ${i + 1}. ${c.id}`);
      });
      console.log();
    }
    
    // 3. ПРОВЕРКА BOOKINGS
    console.log('═══════════════════════════════════════════════════════');
    console.log('3️⃣  BOOKINGS');
    console.log('═══════════════════════════════════════════════════════\n');
    
    const bookingsOrphans = await sql`
      SELECT er.entity_id, er.external_id
      FROM external_refs er
      WHERE er.system = 'rentprog'
        AND er.entity_type = 'booking'
        AND NOT EXISTS (
          SELECT 1 FROM bookings b WHERE b.id = er.entity_id
        )
    `;
    
    orphansByType['booking'] = bookingsOrphans.length;
    totalOrphans += bookingsOrphans.length;
    
    if (bookingsOrphans.length === 0) {
      console.log('✅ Сирот не найдено!\n');
    } else {
      console.log(`❌ Найдено сирот: ${bookingsOrphans.length}\n`);
      bookingsOrphans.slice(0, 5).forEach((orphan, i) => {
        console.log(`${i + 1}. External ID: ${orphan.external_id}`);
        console.log(`   Entity ID: ${orphan.entity_id}`);
      });
      if (bookingsOrphans.length > 5) {
        console.log(`   ... и ещё ${bookingsOrphans.length - 5}\n`);
      }
    }
    
    // Проверка обратной ситуации: bookings без external_refs
    const bookingsWithoutRefs = await sql`
      SELECT b.id
      FROM bookings b
      WHERE NOT EXISTS (
        SELECT 1 FROM external_refs er 
        WHERE er.entity_id = b.id 
          AND er.system = 'rentprog' 
          AND er.entity_type = 'booking'
      )
      LIMIT 10
    `;
    
    if (bookingsWithoutRefs.length > 0) {
      console.log(`⚠️  Bookings без external_refs: ${bookingsWithoutRefs.length}`);
      bookingsWithoutRefs.slice(0, 3).forEach((b, i) => {
        console.log(`   ${i + 1}. ${b.id}`);
      });
      console.log();
    }
    
    // 4. ПРОВЕРКА EMPLOYEES (rentprog_employee)
    console.log('═══════════════════════════════════════════════════════');
    console.log('4️⃣  EMPLOYEES (rentprog_employee)');
    console.log('═══════════════════════════════════════════════════════\n');
    
    const employeesOrphans = await sql`
      SELECT er.entity_id, er.external_id, er.entity_type
      FROM external_refs er
      WHERE er.system = 'rentprog'
        AND er.entity_type IN ('rentprog_employee', 'employee')
        AND NOT EXISTS (
          SELECT 1 FROM rentprog_employees re WHERE re.id = er.entity_id
        )
    `;
    
    orphansByType['employee'] = employeesOrphans.length;
    totalOrphans += employeesOrphans.length;
    
    if (employeesOrphans.length === 0) {
      console.log('✅ Сирот не найдено!\n');
    } else {
      console.log(`❌ Найдено сирот: ${employeesOrphans.length}\n`);
      
      const byType = {};
      employeesOrphans.forEach(e => {
        byType[e.entity_type] = (byType[e.entity_type] || 0) + 1;
      });
      
      Object.entries(byType).forEach(([type, count]) => {
        console.log(`   ${type}: ${count} записей`);
      });
      console.log();
      
      employeesOrphans.slice(0, 5).forEach((orphan, i) => {
        console.log(`${i + 1}. External ID: ${orphan.external_id}`);
        console.log(`   Entity ID: ${orphan.entity_id}`);
        console.log(`   Type: ${orphan.entity_type}`);
      });
      if (employeesOrphans.length > 5) {
        console.log(`   ... и ещё ${employeesOrphans.length - 5}\n`);
      }
    }
    
    // Проверка обратной ситуации: employees без external_refs
    const employeesWithoutRefs = await sql`
      SELECT re.id, re.rentprog_id
      FROM rentprog_employees re
      WHERE NOT EXISTS (
        SELECT 1 FROM external_refs er 
        WHERE er.entity_id = re.id 
          AND er.system = 'rentprog' 
          AND er.entity_type = 'rentprog_employee'
      )
      LIMIT 10
    `;
    
    if (employeesWithoutRefs.length > 0) {
      console.log(`⚠️  Employees без external_refs: ${employeesWithoutRefs.length}`);
      employeesWithoutRefs.slice(0, 3).forEach((e, i) => {
        console.log(`   ${i + 1}. UUID: ${e.id}, RentProg ID: ${e.rentprog_id}`);
      });
      console.log();
    }
    
    // 5. ПРОВЕРКА ДРУГИХ ТИПОВ
    console.log('═══════════════════════════════════════════════════════');
    console.log('5️⃣  ДРУГИЕ ТИПЫ');
    console.log('═══════════════════════════════════════════════════════\n');
    
    const knownTypes = ['car', 'client', 'booking', 'rentprog_employee', 'employee'];
    const otherTypes = entityTypes.filter(et => !knownTypes.includes(et.entity_type));
    
    if (otherTypes.length === 0) {
      console.log('✅ Других типов не найдено\n');
    } else {
      console.log(`⚠️  Найдены другие типы: ${otherTypes.length}\n`);
      otherTypes.forEach(et => {
        console.log(`   ${et.entity_type}: ${et.count} записей`);
      });
      console.log();
    }
    
    // ИТОГОВАЯ СТАТИСТИКА
    console.log('═══════════════════════════════════════════════════════');
    console.log('📊 ИТОГОВАЯ СТАТИСТИКА');
    console.log('═══════════════════════════════════════════════════════\n');
    
    console.log('Сироты по типам:');
    Object.entries(orphansByType).forEach(([type, count]) => {
      if (count > 0) {
        console.log(`   ❌ ${type}: ${count}`);
      } else {
        console.log(`   ✅ ${type}: 0`);
      }
    });
    
    console.log(`\n📈 Всего сирот: ${totalOrphans}`);
    
    if (totalOrphans === 0) {
      console.log('\n🎉 ВСЕ ЧИСТО! Сирот не найдено!\n');
    } else {
      console.log('\n⚠️  Требуется очистка! Запустите:\n');
      console.log('   node setup/fix_all_orphans_all_entities.mjs\n');
    }
    
    // Дополнительная проверка: внутренние FK
    console.log('═══════════════════════════════════════════════════════');
    console.log('6️⃣  ПРОВЕРКА ВНУТРЕННИХ FK');
    console.log('═══════════════════════════════════════════════════════\n');
    
    // bookings.car_id
    const invalidCarFK = await sql`
      SELECT COUNT(*) as count
      FROM bookings b
      WHERE b.car_id IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM cars c WHERE c.id = b.car_id)
    `.then(rows => rows[0]);
    
    console.log(`bookings.car_id → cars.id:`);
    if (invalidCarFK.count === '0') {
      console.log('   ✅ Все ссылки валидны');
    } else {
      console.log(`   ❌ Невалидных ссылок: ${invalidCarFK.count}`);
    }
    
    // bookings.client_id
    const invalidClientFK = await sql`
      SELECT COUNT(*) as count
      FROM bookings b
      WHERE b.client_id IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM clients c WHERE c.id = b.client_id)
    `.then(rows => rows[0]);
    
    console.log(`bookings.client_id → clients.id:`);
    if (invalidClientFK.count === '0') {
      console.log('   ✅ Все ссылки валидны');
    } else {
      console.log(`   ❌ Невалидных ссылок: ${invalidClientFK.count}`);
    }
    
    // bookings.responsible_id
    const invalidResponsibleFK = await sql`
      SELECT COUNT(*) as count
      FROM bookings b
      WHERE b.responsible_id IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM rentprog_employees re WHERE re.id = b.responsible_id)
    `.then(rows => rows[0]);
    
    console.log(`bookings.responsible_id → rentprog_employees.id:`);
    if (invalidResponsibleFK.count === '0') {
      console.log('   ✅ Все ссылки валидны');
    } else {
      console.log(`   ❌ Невалидных ссылок: ${invalidResponsibleFK.count}`);
    }
    
    console.log();
    
  } finally {
    await sql.end();
  }
}

checkAllOrphans();

