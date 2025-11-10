import postgres from "postgres";
const sql = postgres("postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require",{ ssl: { rejectUnauthorized: false } });
const rows = await sql`select column_name from information_schema.columns where table_name = 'cars' and column_name = 'company_id'`;
console.log(JSON.stringify(rows, null, 2));
await sql.end();
