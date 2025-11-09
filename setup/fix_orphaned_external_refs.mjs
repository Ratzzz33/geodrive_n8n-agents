#!/usr/bin/env node
import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

async function fixOrphans() {
  const sql = postgres(CONNECTION_STRING, {max: 1, ssl: {rejectUnauthorized: false}});
  
  console.log('\n🔧 Исправление сирот в external_refs\n');
  
  try {
    // Найти всех сирот с entity_type='employee'
    const orphans = await sql`
      SELECT er.entity_id, er.external_id, er.entity_type
      FROM external_refs er
      WHERE er.system = 'rentprog'
        AND er.entity_type = 'employee'
        AND NOT EXISTS (
          SELECT 1 FROM rentprog_employees re WHERE re.id = er.entity_id
        )
    `;
    
    console.log(`📊 Найдено сирот с entity_type='employee': ${orphans.length}\n`);
    
    if (orphans.length === 0) {
      console.log('✅ Сирот не найдено!');
      await sql.end();
      return;
    }
    
    let fixed = 0;
    let deleted = 0;
    
    for (const orphan of orphans) {
      // Проверить, есть ли сотрудник с таким external_id в rentprog_employees
      const employee = await sql`
        SELECT id FROM rentprog_employees WHERE rentprog_id = ${orphan.external_id}
      `.then(rows => rows[0]);
      
      if (employee) {
        // Сотрудник существует в rentprog_employees, обновляем external_refs
        await sql`
          UPDATE external_refs
          SET 
            entity_id = ${employee.id},
            entity_type = 'rentprog_employee',
            updated_at = NOW()
          WHERE system = 'rentprog'
            AND external_id = ${orphan.external_id}
            AND entity_type = 'employee'
        `;
        fixed++;
        
        if (fixed <= 10) {
          console.log(`✅ Исправлено: ${orphan.external_id} → ${employee.id}`);
        }
      } else {
        // Сотрудника нет, удаляем сироту
        await sql`
          DELETE FROM external_refs
          WHERE system = 'rentprog'
            AND external_id = ${orphan.external_id}
            AND entity_type = 'employee'
            AND entity_id = ${orphan.entity_id}
        `;
        deleted++;
        
        if (deleted <= 10) {
          console.log(`❌ Удалено: ${orphan.external_id} (сотрудник не существует)`);
        }
      }
    }
    
    if (fixed > 10) {
      console.log(`   ... и ещё ${fixed - 10} исправлено`);
    }
    if (deleted > 10) {
      console.log(`   ... и ещё ${deleted - 10} удалено`);
    }
    
    console.log(`\n📊 Итого:`);
    console.log(`   Исправлено: ${fixed}`);
    console.log(`   Удалено: ${deleted}`);
    console.log(`   Всего обработано: ${fixed + deleted}`);
    
    // Финальная проверка
    console.log(`\n🔍 Финальная проверка...\n`);
    
    const remainingOrphans = await sql`
      SELECT COUNT(*) as count
      FROM external_refs er
      WHERE er.system = 'rentprog'
        AND er.entity_type IN ('employee', 'rentprog_employee')
        AND NOT EXISTS (
          SELECT 1 FROM rentprog_employees re WHERE re.id = er.entity_id
        )
    `.then(rows => rows[0]);
    
    if (remainingOrphans.count === '0') {
      console.log('✅ Все сироты исправлены!');
    } else {
      console.log(`⚠️  Осталось сирот: ${remainingOrphans.count}`);
    }
    
    // Проверка дубликатов после исправления
    const duplicates = await sql`
      SELECT external_id, COUNT(*) as count
      FROM external_refs
      WHERE system = 'rentprog'
        AND entity_type = 'rentprog_employee'
      GROUP BY external_id
      HAVING COUNT(*) > 1
    `;
    
    if (duplicates.length > 0) {
      console.log(`\n⚠️  Найдены дубликаты external_refs: ${duplicates.length}`);
      duplicates.slice(0, 5).forEach(dup => {
        console.log(`   ${dup.external_id}: ${dup.count} записей`);
      });
      
      console.log(`\n🔧 Исправление дубликатов...`);
      
      for (const dup of duplicates) {
        // Оставляем только последнюю запись
        await sql`
          DELETE FROM external_refs
          WHERE ctid IN (
            SELECT ctid
            FROM external_refs
            WHERE system = 'rentprog'
              AND external_id = ${dup.external_id}
              AND entity_type = 'rentprog_employee'
            ORDER BY updated_at DESC
            OFFSET 1
          )
        `;
      }
      
      console.log(`✅ Дубликаты удалены`);
    } else {
      console.log(`\n✅ Дубликатов external_refs нет`);
    }
    
  } finally {
    await sql.end();
  }
}

fixOrphans();

