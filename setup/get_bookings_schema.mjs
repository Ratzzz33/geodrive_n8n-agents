#!/usr/bin/env node
import postgres from 'postgres';

const sql = postgres('postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require', {
  ssl: { rejectUnauthorized: false }
});

try {
  const columns = await sql`
    SELECT 
      column_name, 
      data_type, 
      is_nullable,
      column_default
    FROM information_schema.columns 
    WHERE table_name = 'bookings' 
    ORDER BY ordinal_position
  `;
  
  console.log('Поля таблицы bookings:\n');
  console.log('=' .repeat(80));
  
  columns.forEach(c => {
    const nullable = c.is_nullable === 'YES' ? '✓' : '✗';
    const def = c.column_default ? c.column_default.substring(0, 30) : '-';
    console.log(`${c.column_name.padEnd(30)} | ${c.data_type.padEnd(20)} | Nullable: ${nullable} | Default: ${def}`);
  });
  
  console.log('=' .repeat(80));
  console.log(`\nВсего полей: ${columns.length}`);
  
  // Найти PRIMARY KEY
  const pk = await sql`
    SELECT a.attname
    FROM pg_index i
    JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
    WHERE i.indrelid = 'bookings'::regclass AND i.indisprimary
  `;
  
  console.log(`\nPRIMARY KEY: ${pk.map(p => p.attname).join(', ')}`);
  
  // Найти UNIQUE constraints
  const unique = await sql`
    SELECT 
      conname as constraint_name,
      pg_get_constraintdef(c.oid) as definition
    FROM pg_constraint c
    WHERE c.conrelid = 'bookings'::regclass 
    AND c.contype = 'u'
  `;
  
  if (unique.length > 0) {
    console.log('\nUNIQUE constraints:');
    unique.forEach(u => {
      console.log(`  - ${u.constraint_name}: ${u.definition}`);
    });
  }
  
} finally {
  await sql.end();
}

