#!/usr/bin/env node
import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

async function checkFunction() {
  const sql = postgres(CONNECTION_STRING, {max: 1, ssl: {rejectUnauthorized: false}});
  
  console.log('\n🔍 Текущая версия dynamic_upsert_entity в БД:\n');
  
  const result = await sql`
    SELECT pg_get_functiondef('dynamic_upsert_entity'::regproc)
  `.then(rows => rows[0]);
  
  console.log(result.pg_get_functiondef);
  
  await sql.end();
}

checkFunction();

