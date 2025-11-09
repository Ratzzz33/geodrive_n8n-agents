#!/usr/bin/env node
import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

async function checkDuplicates() {
  const sql = postgres(CONNECTION_STRING, {max: 1, ssl: {rejectUnauthorized: false}});
  
  console.log('\n🔍 Проверка дубликатов в rentprog_employees\n');
  
  try {
    // Найти все дубликаты по rentprog_id
    const duplicates = await sql`
      SELECT 
        rentprog_id,
        COUNT(*) as count,
        array_agg(id ORDER BY created_at) as uuids,
        array_agg(name ORDER BY created_at) as names,
        array_agg(created_at ORDER BY created_at) as created_dates
      FROM rentprog_employees
      GROUP BY rentprog_id
      HAVING COUNT(*) > 1
      ORDER BY COUNT(*) DESC, rentprog_id
    `;
    
    if (duplicates.length === 0) {
      console.log('✅ Дубликатов не найдено!\n');
      
      // Покажем общую статистику
      const stats = await sql`
        SELECT 
          COUNT(*) as total_employees,
          COUNT(DISTINCT rentprog_id) as unique_ids,
          COUNT(*) - COUNT(DISTINCT rentprog_id) as duplicate_count
        FROM rentprog_employees
      `.then(rows => rows[0]);
      
      console.log('📊 Общая статистика:');
      console.log(`   Всего записей: ${stats.total_employees}`);
      console.log(`   Уникальных rentprog_id: ${stats.unique_ids}`);
      console.log(`   Дубликатов: ${stats.duplicate_count}`);
      
    } else {
      console.log(`❌ Найдено дубликатов: ${duplicates.length} rentprog_id\n`);
      
      let totalDuplicateRecords = 0;
      
      duplicates.forEach((dup, index) => {
        console.log(`\n${index + 1}. RentProg ID: ${dup.rentprog_id}`);
        console.log(`   Количество записей: ${dup.count}`);
        totalDuplicateRecords += parseInt(dup.count);
        
        dup.uuids.forEach((uuid, i) => {
          console.log(`   ${i + 1}. UUID: ${uuid}`);
          console.log(`      Name: ${dup.names[i] || 'NULL'}`);
          console.log(`      Created: ${dup.created_dates[i]}`);
        });
      });
      
      console.log(`\n📊 Итого:`);
      console.log(`   Дубликатов rentprog_id: ${duplicates.length}`);
      console.log(`   Лишних записей: ${totalDuplicateRecords - duplicates.length}`);
      
      // Проверить external_refs для каждого дубликата
      console.log(`\n🔍 Проверка external_refs для дубликатов...\n`);
      
      for (const dup of duplicates) {
        const extRefs = await sql`
          SELECT entity_id, entity_type
          FROM external_refs
          WHERE system = 'rentprog'
            AND external_id = ${dup.rentprog_id}
        `;
        
        console.log(`RentProg ID ${dup.rentprog_id}:`);
        if (extRefs.length === 0) {
          console.log(`   ❌ НЕТ записей в external_refs!`);
        } else if (extRefs.length === 1) {
          const ref = extRefs[0];
          const matchIndex = dup.uuids.indexOf(ref.entity_id);
          console.log(`   ✅ 1 запись в external_refs: ${ref.entity_id}`);
          if (matchIndex >= 0) {
            console.log(`      → Указывает на запись #${matchIndex + 1} (${dup.names[matchIndex] || 'NULL'})`);
          } else {
            console.log(`      ⚠️  Указывает на UUID который НЕ существует в rentprog_employees!`);
          }
        } else {
          console.log(`   ❌ ${extRefs.length} записей в external_refs (должна быть 1):`);
          extRefs.forEach(ref => {
            console.log(`      - ${ref.entity_id} (${ref.entity_type})`);
          });
        }
      }
      
      // Предложить исправление
      console.log(`\n💡 Рекомендации по исправлению:`);
      console.log(`   1. Для каждого дубликата оставить ПОСЛЕДНЮЮ запись (самую новую)`);
      console.log(`   2. Обновить external_refs чтобы указывал на последнюю запись`);
      console.log(`   3. Обновить bookings.responsible_id на правильные UUID`);
      console.log(`   4. Удалить старые дубликаты`);
      console.log(`\n   Запустить: node setup/fix_all_duplicates.mjs`);
    }
    
    // Проверка сирот в external_refs (entity_id которых нет в rentprog_employees)
    console.log(`\n🔍 Проверка сирот в external_refs...\n`);
    
    const orphans = await sql`
      SELECT er.entity_id, er.external_id, er.entity_type
      FROM external_refs er
      WHERE er.system = 'rentprog'
        AND er.entity_type IN ('rentprog_employee', 'employee')
        AND NOT EXISTS (
          SELECT 1 FROM rentprog_employees re WHERE re.id = er.entity_id
        )
    `;
    
    if (orphans.length === 0) {
      console.log('✅ Сирот в external_refs не найдено!');
    } else {
      console.log(`❌ Найдено сирот: ${orphans.length}\n`);
      orphans.slice(0, 10).forEach((orphan, i) => {
        console.log(`${i + 1}. External ID: ${orphan.external_id}`);
        console.log(`   Entity ID: ${orphan.entity_id}`);
        console.log(`   Type: ${orphan.entity_type}`);
      });
      if (orphans.length > 10) {
        console.log(`   ... и ещё ${orphans.length - 10}`);
      }
    }
    
  } finally {
    await sql.end();
  }
}

checkDuplicates();

