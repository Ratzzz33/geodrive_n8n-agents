#!/usr/bin/env node
import postgres from 'postgres';

const sql = postgres('postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require', {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

const sample = "Parser создал платёж №1843908, расход наличными 473.0GEL";

const rows = await sql`SELECT * FROM parse_history_description(${sample})`;
console.log(rows);
await sql.end();

