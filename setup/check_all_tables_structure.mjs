#!/usr/bin/env node
import postgres from 'postgres';

const sql = postgres('postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require', {
  ssl: { rejectUnauthorized: false }
});

const tables = ['clients', 'branches', 'payments', 'events', 'external_refs'];

try {
  for (const table of tables) {
    const columns = await sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = ${table}
      ORDER BY ordinal_position
    `;
    
    if (columns.length > 0) {
      console.log(`\n${table}:`, columns.map(c => c.column_name).join(', '));
    } else {
      console.log(`\n${table}: (таблица не существует)`);
    }
  }
} catch (error) {
  console.error('Ошибка:', error.message);
} finally {
  await sql.end();
}

