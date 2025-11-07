import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

try {
  console.log('🔗 Linking payments to employees...\n');
  
  // Обновляем employee_id через JOIN с external_refs
  const result = await sql`
    UPDATE payments p
    SET employee_id = er.entity_id
    FROM external_refs er
    WHERE er.entity_type = 'employee'
      AND er.system = 'rentprog'
      AND er.external_id = p.rp_user_id::text
      AND p.employee_id IS NULL
      AND p.rp_user_id IS NOT NULL
  `;
  
  console.log(`✅ Updated ${result.count} payments with employee_id\n`);
  
  // Проверяем результат
  const stats = await sql`
    SELECT 
      COUNT(*) as total,
      COUNT(employee_id) as with_employee,
      COUNT(booking_id) as with_booking
    FROM payments
  `;
  
  console.log('📊 Final stats:');
  console.log(`   Total payments: ${stats[0].total}`);
  console.log(`   With employee_id: ${stats[0].with_employee}`);
  console.log(`   With booking_id: ${stats[0].with_booking}`);
  
} catch (error) {
  console.error('❌ Error:', error.message);
} finally {
  await sql.end();
}

