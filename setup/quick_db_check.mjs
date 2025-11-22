import postgres from 'postgres';

const sql = postgres(
  'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require',
  { max: 1, ssl: { rejectUnauthorized: false }, connect_timeout: 5, idle_timeout: 5 }
);

try {
  const r = await sql`SELECT COUNT(*) as total, COUNT(CASE WHEN rentprog_id IS NOT NULL THEN 1 END) as with_id FROM clients`;
  console.log(`Всего: ${r[0].total}, С rentprog_id: ${r[0].with_id}`);
  
  const r2 = await sql`SELECT COUNT(DISTINCT external_id) as refs FROM external_refs WHERE system='rentprog' AND entity_type='client'`;
  console.log(`External refs: ${r2[0].refs}`);
  
  await sql.end();
} catch (e) {
  console.error(e.message);
  process.exit(1);
}



