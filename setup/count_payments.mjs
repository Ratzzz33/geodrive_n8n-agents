import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

async function countPayments() {
  try {
    const [result] = await sql`SELECT COUNT(*) as count FROM payments`;
    console.log(`Payments in table: ${result.count}`);
    
    if (result.count > 0) {
      const sample = await sql`SELECT * FROM payments LIMIT 3`;
      console.log('\nSample data:');
      sample.forEach((row, i) => {
        console.log(`\n[${i + 1}]`, JSON.stringify(row, null, 2));
      });
    }
    
  } catch (error) {
    console.error('ERROR:', error.message);
  } finally {
    await sql.end();
  }
}

countPayments();

