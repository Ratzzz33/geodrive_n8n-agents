#!/usr/bin/env node
import postgres from 'postgres';

const sql = postgres('postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require', {
  ssl: { rejectUnauthorized: false }
});

console.log('\n🔐 Креденшелы RentProg:\n');

// Ищем креденшелы в разных возможных местах
try {
  // Проверяем таблицу с креденшелами если есть
  const creds = await sql`
    SELECT * FROM information_schema.tables 
    WHERE table_name LIKE '%cred%' OR table_name LIKE '%auth%'
  `;
  
  if (creds.length > 0) {
    console.log('Найденные таблицы с креденшелами:', creds.map(t => t.table_name));
  }
} catch (e) {
  // Таблицы нет
}

// Креденшелы из известных источников
console.log('📋 Tbilisi (filial):\n');
console.log('   Email: filial@geodrive.pro');
console.log('   User ID: 16046');
console.log('   Token: eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxNjA0NiIsInNjcCI6InVzZXIiLCJhdWQiOm51bGwsImlhdCI6MTc2MjQ1OTY2MCwiZXhwIjoxNzY1MDUxNjYwLCJqdGkiOiIxOTFjMDY4ZS1jOGNhLTQ4OWEtODk0OS1iMjJkMmUzODE2ZDIifQ.G4_I4D96Flv4rP3JwjwDPpEHaH6ShSb0YRRQG8PasXk\n');

console.log('📋 Batumi:\n');
console.log('   User ID: 16048');
console.log('   Token: eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxNjA0OCIsInNjcCI6InVzZXIiLCJhdWQiOm51bGwsImlhdCI6MTc2MjQ2MDAyNSwiZXhwIjoxNzY1MDUyMDI1LCJqdGkiOiI0ZmQ2ODE4Yy0zYWNiLTRmZmQtOGZmYS0wZWMwZDkyMmIyMzgifQ.16s2ruRb3x_S7bgy4zF7TW9dSQ3ITqX3kei8recyH_8\n');

console.log('📋 Kutaisi:\n');
console.log('   User ID: 16049');
console.log('   Token: eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxNjA0OSIsInNjcCI6InVzZXIiLCJhdWQiOm51bGwsImlhdCI6MTc2MjQ2MDE3MiwiZXhwIjoxNzY1MDUyMTcyLCJqdGkiOiJmNzE1NGQ3MC0zZWFmLTRiNzItYTI3Ni0yZTg3MmQ4YjA0YmQifQ.1vd1kNbWB_qassLVqoxgyRsRJwtPsl7OR28gVsCxmwY\n');

console.log('📋 Service Center:\n');
console.log('   User ID: 16045');
console.log('   Token: eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxNjA0NSIsInNjcCI6InVzZXIiLCJhdWQiOm51bGwsImlhdCI6MTc2MjQ1OTM4MSwiZXhwIjoxNzY1MDUxMzgxLCJqdGkiOiI4ZDdkYjYyNi1jNWJiLTQ0MWMtYTNlMy00YjQwOWFmODQ1NmUifQ.32BRzttLFFgOgMv-VusAXK8mmyvrk4X-pb_rHQHSFbw\n');

console.log('💡 Используем креденшелы Tbilisi для логина через браузер\n');

await sql.end();

