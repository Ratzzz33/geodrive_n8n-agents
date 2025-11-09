import postgres from 'postgres';

const sql = postgres('postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require', {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

try {
  console.log('📊 Статистика платежей и связей\n');
  
  // 1. Всего платежей
  const [totalPayments] = await sql`
    SELECT COUNT(*) as count FROM payments
  `;
  console.log(`Всего платежей в БД: ${totalPayments.count}`);
  
  // 2. Платежи с count_id
  const [withCountId] = await sql`
    SELECT COUNT(*) as count 
    FROM payments 
    WHERE raw_data IS NOT NULL 
      AND raw_data->>'count_id' IS NOT NULL
  `;
  console.log(`Платежей с count_id: ${withCountId.count}`);
  
  // 3. Платежи без count_id
  const [withoutCountId] = await sql`
    SELECT COUNT(*) as count 
    FROM payments 
    WHERE raw_data IS NULL 
      OR raw_data->>'count_id' IS NULL
  `;
  console.log(`Платежей без count_id: ${withoutCountId.count}`);
  
  // 4. Всего связей
  const [totalLinks] = await sql`
    SELECT COUNT(*) as count FROM event_links
  `;
  console.log(`\nВсего записей в event_links: ${totalLinks.count}`);
  
  // 5. Связанных платежей
  const [linkedPayments] = await sql`
    SELECT COUNT(DISTINCT payment_id) as count 
    FROM event_links 
    WHERE payment_id IS NOT NULL
  `;
  console.log(`Уникальных платежей в event_links: ${linkedPayments.count}`);
  
  // 6. Несвязанные платежи с count_id
  const [unlinkedWithCountId] = await sql`
    SELECT COUNT(*) as count
    FROM payments p
    WHERE p.raw_data IS NOT NULL
      AND p.raw_data->>'count_id' IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 
        FROM event_links el 
        WHERE el.payment_id = p.id
      )
  `;
  console.log(`Несвязанные платежи (с count_id): ${unlinkedWithCountId.count}`);
  
  // 7. Статистика по типам связей
  console.log('\n📋 Типы связей:');
  const linkTypes = await sql`
    SELECT 
      link_type,
      confidence,
      COUNT(*) as count
    FROM event_links
    WHERE payment_id IS NOT NULL
    GROUP BY link_type, confidence
    ORDER BY count DESC
  `;
  
  if (linkTypes.length === 0) {
    console.log('  (нет связей)');
  } else {
    linkTypes.forEach(lt => {
      console.log(`  ${lt.link_type} (${lt.confidence}): ${lt.count}`);
    });
  }
  
  // 8. Примеры несвязанных платежей (если есть)
  if (unlinkedWithCountId.count > 0) {
    console.log('\n🔍 Примеры несвязанных платежей:');
    const samples = await sql`
      SELECT 
        p.id,
        p.payment_date,
        p.raw_data->>'count_id' as count_id,
        b.code as branch
      FROM payments p
      LEFT JOIN branches b ON b.id = p.branch_id
      WHERE p.raw_data IS NOT NULL
        AND p.raw_data->>'count_id' IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 
          FROM event_links el 
          WHERE el.payment_id = p.id
        )
      LIMIT 5
    `;
    
    samples.forEach((s, i) => {
      console.log(`  ${i + 1}. ID: ${s.id}, count_id: ${s.count_id}, branch: ${s.branch}, date: ${s.payment_date}`);
    });
  }
  
  console.log('\n✅ Проверка завершена');
  
} catch (err) {
  console.error('❌ Ошибка:', err);
} finally {
  await sql.end();
}

