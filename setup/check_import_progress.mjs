#!/usr/bin/env node
import postgres from 'postgres';

const sql = postgres('postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require', {
  ssl: { rejectUnauthorized: false }
});

try {
  const rows = await sql`
    SELECT 
      branch, 
      COUNT(*) as count, 
      COUNT(DISTINCT number) as unique_bookings,
      COUNT(CASE WHEN is_technical THEN 1 END) as technical_count
    FROM bookings 
    GROUP BY branch 
    ORDER BY branch
  `;
  
  console.log('\nProgress import:');
  rows.forEach(row => {
    console.log(`  ${row.branch}: ${row.count} records (${row.unique_bookings} unique, ${row.technical_count} technical)`);
  });
  
  const total = await sql`SELECT COUNT(*) as total, COUNT(DISTINCT number) as unique_total FROM bookings`;
  console.log(`\nTotal: ${total[0].total} records (${total[0].unique_total} unique bookings)\n`);
} finally {
  await sql.end();
}
