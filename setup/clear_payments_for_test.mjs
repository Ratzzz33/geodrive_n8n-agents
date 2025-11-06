import postgres from 'postgres';

const sql = postgres('postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require', {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

try {
  console.log('Clearing payments table...');
  
  // Удаляем только платежи (не все external_refs)
  await sql`DELETE FROM external_refs WHERE entity_type = 'payment'`;
  await sql`DELETE FROM payments`;
  
  console.log('SUCCESS: Tables cleared for testing');
  
} catch (error) {
  console.error('ERROR:', error.message);
} finally {
  await sql.end();
}

