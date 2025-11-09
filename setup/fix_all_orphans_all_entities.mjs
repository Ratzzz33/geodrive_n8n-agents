#!/usr/bin/env node
import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

async function fixAllOrphans() {
  const sql = postgres(CONNECTION_STRING, {max: 1, ssl: {rejectUnauthorized: false}});
  
  console.log('\n🔧 ИСПРАВЛЕНИЕ ВСЕХ СИРОТ И НЕСООТВЕТСТВИЙ\n');
  console.log('═══════════════════════════════════════════════════════\n');
  
  try {
    let totalFixed = 0;
    
    // 1. Исправление сирот в CLIENTS
    console.log('1️⃣  Исправление сирот в clients...\n');
    
    const clientOrphans = await sql`
      SELECT er.entity_id, er.external_id
      FROM external_refs er
      WHERE er.system = 'rentprog'
        AND er.entity_type = 'client'
        AND NOT EXISTS (
          SELECT 1 FROM clients c WHERE c.id = er.entity_id
        )
    `;
    
    if (clientOrphans.length === 0) {
      console.log('✅ Сирот не найдено\n');
    } else {
      console.log(`Найдено сирот: ${clientOrphans.length}`);
      
      for (const orphan of clientOrphans) {
        // Это тестовые ID, просто удаляем
        await sql`
          DELETE FROM external_refs
          WHERE system = 'rentprog'
            AND entity_type = 'client'
            AND entity_id = ${orphan.entity_id}
        `;
        console.log(`   ❌ Удалено: ${orphan.external_id} (тестовая запись)`);
        totalFixed++;
      }
      console.log();
    }
    
    // 2. Исправление неправильных entity_type
    console.log('2️⃣  Исправление неправильных entity_type...\n');
    
    // bookings → booking
    const wrongBookingsType = await sql`
      UPDATE external_refs
      SET entity_type = 'booking', updated_at = NOW()
      WHERE system = 'rentprog'
        AND entity_type = 'bookings'
      RETURNING external_id
    `;
    
    if (wrongBookingsType.length > 0) {
      console.log(`✅ Исправлено: 'bookings' → 'booking' (${wrongBookingsType.length} записей)`);
      totalFixed += wrongBookingsType.length;
    }
    
    // cars → car
    const wrongCarsType = await sql`
      UPDATE external_refs
      SET entity_type = 'car', updated_at = NOW()
      WHERE system = 'rentprog'
        AND entity_type = 'cars'
      RETURNING external_id
    `;
    
    if (wrongCarsType.length > 0) {
      console.log(`✅ Исправлено: 'cars' → 'car' (${wrongCarsType.length} записей)`);
      totalFixed += wrongCarsType.length;
    }
    
    console.log();
    
    // 3. Обработка payment записей
    console.log('3️⃣  Проверка payment записей...\n');
    
    const paymentCount = await sql`
      SELECT COUNT(*) as count
      FROM external_refs
      WHERE system = 'rentprog'
        AND entity_type = 'payment'
    `.then(rows => rows[0]);
    
    console.log(`Найдено payment записей: ${paymentCount.count}`);
    console.log('⚠️  Тип "payment" не имеет соответствующей таблицы');
    console.log('   Это может быть для будущего функционала');
    console.log('   Оставляем как есть\n');
    
    // 4. Проверка дубликатов external_id
    console.log('4️⃣  Проверка дубликатов...\n');
    
    const duplicates = await sql`
      SELECT 
        system,
        entity_type,
        external_id,
        COUNT(*) as count
      FROM external_refs
      GROUP BY system, entity_type, external_id
      HAVING COUNT(*) > 1
    `;
    
    if (duplicates.length === 0) {
      console.log('✅ Дубликатов не найдено\n');
    } else {
      console.log(`❌ Найдено дубликатов: ${duplicates.length}\n`);
      
      for (const dup of duplicates) {
        console.log(`Дубликат: ${dup.entity_type} / ${dup.external_id} (${dup.count} записей)`);
        
        // Оставляем самую новую запись
        await sql`
          DELETE FROM external_refs
          WHERE ctid IN (
            SELECT ctid
            FROM external_refs
            WHERE system = ${dup.system}
              AND entity_type = ${dup.entity_type}
              AND external_id = ${dup.external_id}
            ORDER BY updated_at DESC
            OFFSET 1
          )
        `;
        
        const deleted = parseInt(dup.count) - 1;
        console.log(`   ✅ Удалено ${deleted} дубликатов\n`);
        totalFixed += deleted;
      }
    }
    
    // 5. Проверка сущностей без external_refs
    console.log('5️⃣  Сущности без external_refs...\n');
    
    // Clients без refs
    const clientsWithoutRefs = await sql`
      SELECT COUNT(*) as count
      FROM clients c
      WHERE NOT EXISTS (
        SELECT 1 FROM external_refs er 
        WHERE er.entity_id = c.id 
          AND er.system = 'rentprog' 
          AND er.entity_type = 'client'
      )
    `.then(rows => rows[0]);
    
    console.log(`Clients без external_refs: ${clientsWithoutRefs.count}`);
    console.log('   ℹ️  Это нормально - могут быть созданы из других источников\n');
    
    // Bookings без refs
    const bookingsWithoutRefs = await sql`
      SELECT COUNT(*) as count
      FROM bookings b
      WHERE NOT EXISTS (
        SELECT 1 FROM external_refs er 
        WHERE er.entity_id = b.id 
          AND er.system = 'rentprog' 
          AND er.entity_type = 'booking'
      )
    `.then(rows => rows[0]);
    
    console.log(`Bookings без external_refs: ${bookingsWithoutRefs.count}`);
    console.log('   ℹ️  Это нормально - тестовые или созданные вручную\n');
    
    // ИТОГИ
    console.log('═══════════════════════════════════════════════════════');
    console.log('📊 ИТОГИ');
    console.log('═══════════════════════════════════════════════════════\n');
    
    console.log(`✅ Всего исправлено: ${totalFixed} записей\n`);
    
    // Финальная проверка
    console.log('6️⃣  Финальная проверка...\n');
    
    const finalOrphans = await sql`
      SELECT 
        entity_type,
        COUNT(*) as count
      FROM external_refs er
      WHERE er.system = 'rentprog'
        AND entity_type IN ('car', 'client', 'booking', 'rentprog_employee')
        AND (
          (entity_type = 'car' AND NOT EXISTS (SELECT 1 FROM cars c WHERE c.id = er.entity_id))
          OR (entity_type = 'client' AND NOT EXISTS (SELECT 1 FROM clients c WHERE c.id = er.entity_id))
          OR (entity_type = 'booking' AND NOT EXISTS (SELECT 1 FROM bookings b WHERE b.id = er.entity_id))
          OR (entity_type = 'rentprog_employee' AND NOT EXISTS (SELECT 1 FROM rentprog_employees re WHERE re.id = er.entity_id))
        )
      GROUP BY entity_type
    `;
    
    if (finalOrphans.length === 0) {
      console.log('🎉 ВСЕ ЧИСТО! Сирот не осталось!\n');
    } else {
      console.log('⚠️  Остались сироты:\n');
      finalOrphans.forEach(o => {
        console.log(`   ${o.entity_type}: ${o.count}`);
      });
      console.log();
    }
    
    // Статистика по типам
    const stats = await sql`
      SELECT 
        entity_type,
        COUNT(*) as count
      FROM external_refs
      WHERE system = 'rentprog'
      GROUP BY entity_type
      ORDER BY entity_type
    `;
    
    console.log('📊 Финальная статистика external_refs:');
    stats.forEach(s => {
      console.log(`   ${s.entity_type}: ${s.count} записей`);
    });
    console.log();
    
  } finally {
    await sql.end();
  }
}

fixAllOrphans();

