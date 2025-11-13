#!/usr/bin/env node
import postgres from 'postgres';

const sql = postgres('postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require', {
  ssl: { rejectUnauthorized: false },
  max: 1
});

try {
  const rows = await sql`
    SELECT 
      branch, 
      COUNT(*) as count
    FROM bookings 
    GROUP BY branch 
    ORDER BY branch
  `;
  
  console.log('Current bookings count:');
  let total = 0;
  rows.forEach(row => {
    console.log(`  ${row.branch}: ${row.count}`);
    total += parseInt(row.count);
  });
  
  console.log(`\nTotal: ${total} bookings`);
} catch (error) {
  console.error('Error:', error.message);
} finally {
  await sql.end();
}
