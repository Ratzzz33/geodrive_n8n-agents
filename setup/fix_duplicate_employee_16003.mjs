#!/usr/bin/env node
import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

async function fixDuplicate() {
  const sql = postgres(CONNECTION_STRING, {max: 1, ssl: {rejectUnauthorized: false}});
  
  console.log('\n🔧 Исправление дубликатов сотрудника 16003\n');
  
  try {
    // Найти все записи сотрудника 16003
    const employees = await sql`
      SELECT id, rentprog_id, name, created_at
      FROM rentprog_employees 
      WHERE rentprog_id = '16003'
      ORDER BY created_at
    `;
    
    console.log(`📊 Найдено записей в rentprog_employees: ${employees.length}\n`);
    employees.forEach((e, i) => {
      console.log(`${i + 1}. UUID: ${e.id}`);
      console.log(`   Name: ${e.name}`);
      console.log(`   Created: ${e.created_at}`);
    });
    
    // Найти записи в external_refs
    const extRefs = await sql`
      SELECT entity_id, entity_type
      FROM external_refs 
      WHERE system = 'rentprog' 
        AND external_id = '16003'
    `;
    
    console.log(`\n📊 Найдено записей в external_refs: ${extRefs.length}\n`);
    extRefs.forEach((r, i) => {
      console.log(`${i + 1}. entity_id: ${r.entity_id}`);
      console.log(`   entity_type: ${r.entity_type}`);
    });
    
    if (employees.length === 0) {
      console.log('\n❌ Сотрудник не найден!');
      return;
    }
    
    // Оставляем самого нового сотрудника (последний в списке)
    const keepEmployee = employees[employees.length - 1];
    const duplicates = employees.slice(0, -1);
    
    console.log(`\n✅ Оставляем: ${keepEmployee.id} (${keepEmployee.name})`);
    
    if (duplicates.length > 0) {
      console.log(`❌ Удаляем дубликаты: ${duplicates.length}`);
      
      for (const dup of duplicates) {
        console.log(`   Удаление: ${dup.id}`);
        await sql`DELETE FROM rentprog_employees WHERE id = ${dup.id}`;
      }
    }
    
    // Исправляем external_refs чтобы указывал на правильный UUID
    const correctExtRef = extRefs.find(r => r.entity_id === keepEmployee.id);
    
    if (correctExtRef) {
      console.log('\n✅ external_refs уже указывает на правильный UUID');
    } else {
      console.log('\n🔧 Исправляем external_refs...');
      
      // Удаляем все неправильные записи
      await sql`
        DELETE FROM external_refs 
        WHERE system = 'rentprog' 
          AND external_id = '16003' 
          AND entity_id != ${keepEmployee.id}
      `;
      
      // Создаём правильную запись
      await sql`
        INSERT INTO external_refs (entity_type, entity_id, system, external_id)
        VALUES ('rentprog_employee', ${keepEmployee.id}, 'rentprog', '16003')
        ON CONFLICT (system, external_id) DO UPDATE SET entity_id = EXCLUDED.entity_id
      `;
      
      console.log('✅ external_refs исправлен!');
    }
    
    // Теперь исправляем booking
    console.log('\n🔧 Обновляем booking 506974...');
    
    const bookingUuid = await sql`
      SELECT entity_id 
      FROM external_refs 
      WHERE system = 'rentprog' 
        AND entity_type = 'booking' 
        AND external_id = '506974'
    `.then(rows => rows[0]?.entity_id);
    
    if (!bookingUuid) {
      console.log('❌ Booking не найден');
      return;
    }
    
    await sql`
      UPDATE bookings 
      SET responsible_id = ${keepEmployee.id}, 
          updated_at = NOW()
      WHERE id = ${bookingUuid}
    `;
    
    console.log('✅ Booking обновлён!');
    
    // Финальная проверка
    const result = await sql`
      SELECT 
        b.id,
        b.responsible_id,
        re.name,
        re.rentprog_id
      FROM bookings b
      LEFT JOIN rentprog_employees re ON re.id = b.responsible_id
      WHERE b.id = ${bookingUuid}
    `.then(rows => rows[0]);
    
    console.log('\n📊 Результат:');
    console.log(`   Booking: ${result.id}`);
    console.log(`   responsible_id: ${result.responsible_id}`);
    console.log(`   Ответственный: ${result.name} (RentProg ID: ${result.rentprog_id})`);
    
    if (result.rentprog_id === '16003') {
      console.log('\n🎉 УСПЕХ! Всё исправлено!');
    } else {
      console.log(`\n⚠️  Указывает на ${result.rentprog_id}, ожидалось 16003`);
    }
    
  } finally {
    await sql.end();
  }
}

fixDuplicate();

