import postgres from 'postgres';

const sql = postgres('postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require', {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

try {
  const count = await sql`SELECT COUNT(*) as count FROM employees`;
  console.log('Employees count:', count[0].count);
  
  const sample = await sql`SELECT * FROM employees LIMIT 5`;
  console.log('\nSample employees:', JSON.stringify(sample, null, 2));
} finally {
  await sql.end();
}

