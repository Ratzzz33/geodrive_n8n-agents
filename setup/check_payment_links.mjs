import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

try {
  // Общее количество
  const total = await sql`SELECT COUNT(*) as count FROM payments`;
  console.log(`\nTotal payments: ${total[0].count}`);
  
  // С заполненным booking_id
  const withBooking = await sql`SELECT COUNT(*) as count FROM payments WHERE booking_id IS NOT NULL`;
  console.log(`With booking_id: ${withBooking[0].count}`);
  
  // С заполненным employee_id
  const withEmployee = await sql`SELECT COUNT(*) as count FROM payments WHERE employee_id IS NOT NULL`;
  console.log(`With employee_id: ${withEmployee[0].count}`);
  
  // Проверка external_refs для сотрудников
  const employeeRefs = await sql`
    SELECT COUNT(*) as count 
    FROM external_refs 
    WHERE entity_type = 'employee' AND system = 'rentprog'
  `;
  console.log(`\nEmployee refs in external_refs: ${employeeRefs[0].count}`);
  
  // Проверка booking_refs
  const bookingRefs = await sql`
    SELECT COUNT(*) as count 
    FROM external_refs 
    WHERE entity_type = 'booking' AND system = 'rentprog'
  `;
  console.log(`Booking refs in external_refs: ${bookingRefs[0].count}`);
  
  // Уникальные rp_user_id в payments
  const uniqueUsers = await sql`
    SELECT COUNT(DISTINCT rp_user_id) as count 
    FROM payments 
    WHERE rp_user_id IS NOT NULL
  `;
  console.log(`\nUnique rp_user_id in payments: ${uniqueUsers[0].count}`);
  
} finally {
  await sql.end();
}

