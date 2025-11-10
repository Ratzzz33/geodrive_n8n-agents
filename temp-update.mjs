import postgres from "postgres";
const sql = postgres("postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require",{ ssl: { rejectUnauthorized: false } });
await sql`update cars c set company_id = case b.code when 'tbilisi' then 9247 when 'batumi' then 9506 when 'kutaisi' then 9248 when 'service-center' then 11163 else null end from branches b where b.id = c.branch_id`;
console.log('Company IDs populated');
await sql.end();
