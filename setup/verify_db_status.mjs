import postgres from 'postgres';

const sql = postgres(
  'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require',
  { max: 1, ssl: { rejectUnauthorized: false }, connect_timeout: 10 }
);

async function verify() {
  console.log('🔍 Проверка состояния БД...\n');
  
  try {
    // 1. Общая статистика клиентов
    console.log('1️⃣ Статистика клиентов:');
    const [{ total, with_id, without_id }] = await sql`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN rentprog_id IS NOT NULL THEN 1 END) as with_id,
        COUNT(CASE WHEN rentprog_id IS NULL THEN 1 END) as without_id
      FROM clients
    `;
    
    console.log(`   👥 Всего клиентов: ${total}`);
    console.log(`   ✅ С rentprog_id: ${with_id} (${Math.round(with_id/total*100)}%)`);
    console.log(`   ❌ Без rentprog_id: ${without_id} (${Math.round(without_id/total*100)}%)\n`);
    
    // 2. External refs
    console.log('2️⃣ External refs (RentProg):');
    const [{ refs_count }] = await sql`
      SELECT COUNT(DISTINCT external_id) as refs_count
      FROM external_refs
      WHERE system = 'rentprog' AND entity_type = 'client'
    `;
    console.log(`   🔗 Уникальных rentprog_id: ${refs_count}\n`);
    
    // 3. Проверка связности
    console.log('3️⃣ Проверка связности:');
    const [{ linked }] = await sql`
      SELECT COUNT(*) as linked
      FROM clients c
      WHERE c.rentprog_id IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM external_refs er
          WHERE er.entity_id = c.id
            AND er.system = 'rentprog'
            AND er.external_id = c.rentprog_id
        )
    `;
    console.log(`   ✅ Клиентов с rentprog_id И external_refs: ${linked}\n`);
    
    // 4. Примеры данных
    console.log('4️⃣ Примеры клиентов с rentprog_id:');
    const examples = await sql`
      SELECT 
        id,
        phone,
        fio,
        rentprog_id,
        created_at
      FROM clients
      WHERE rentprog_id IS NOT NULL
      ORDER BY created_at DESC
      LIMIT 5
    `;
    
    examples.forEach((c, i) => {
      console.log(`   ${i+1}. ${c.fio || 'Без имени'} (phone: ${c.phone}, rentprog_id: ${c.rentprog_id})`);
    });
    console.log('');
    
    // 5. Проверка на дубликаты
    console.log('5️⃣ Проверка дубликатов:');
    const [{ duplicates }] = await sql`
      SELECT COUNT(*) as duplicates
      FROM (
        SELECT rentprog_id, COUNT(*) as cnt
        FROM clients
        WHERE rentprog_id IS NOT NULL
        GROUP BY rentprog_id
        HAVING COUNT(*) > 1
      ) t
    `;
    
    if (duplicates > 0) {
      console.log(`   ⚠️  Найдено дубликатов rentprog_id: ${duplicates}`);
    } else {
      console.log(`   ✅ Дубликатов нет`);
    }
    console.log('');
    
    // 6. Итоговая проверка
    console.log('📊 Итог:');
    if (with_id > 0 && refs_count > 0 && linked === with_id) {
      console.log('   ✅ Всё в порядке! Все клиенты с rentprog_id связаны через external_refs');
    } else {
      console.log('   ⚠️  Есть несоответствия:');
      if (with_id !== linked) {
        console.log(`      - Клиентов с rentprog_id: ${with_id}, но связанных через external_refs: ${linked}`);
      }
    }
    
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
  } finally {
    await sql.end();
  }
}

verify();



