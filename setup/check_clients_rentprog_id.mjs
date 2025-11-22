#!/usr/bin/env node

import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false },
  connect_timeout: 10
});

try {
  console.log('🔍 Проверка структуры таблицы clients...\n');
  
  // Получаем список колонок
  const columns = await sql`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_name = 'clients'
    ORDER BY ordinal_position;
  `;
  
  console.log('📋 Колонки таблицы clients:');
  columns.forEach(col => {
    console.log(`   ${col.column_name}: ${col.data_type}`);
  });
  
  // Проверяем есть ли rentprog_id или подобное поле
  const hasRentprogId = columns.some(col => 
    col.column_name.includes('rentprog') || 
    col.column_name.includes('external')
  );
  
  console.log('\n🔍 Примеры записей:');
  const samples = await sql`
    SELECT * FROM clients LIMIT 3
  `;
  
  samples.forEach((client, i) => {
    console.log(`\n${i + 1}. Client ID: ${client.id}`);
    Object.entries(client).forEach(([key, value]) => {
      if (value !== null) {
        const displayValue = typeof value === 'object' 
          ? JSON.stringify(value).substring(0, 50) 
          : String(value).substring(0, 50);
        console.log(`   ${key}: ${displayValue}`);
      }
    });
  });
  
  // Проверяем сколько клиентов БЕЗ external_refs
  const clientsWithoutRefs = await sql`
    SELECT COUNT(*) as count
    FROM clients c
    WHERE NOT EXISTS (
      SELECT 1 FROM external_refs er
      WHERE er.entity_type = 'client'
        AND er.entity_id = c.id
        AND er.system = 'rentprog'
    )
  `;
  
  console.log(`\n\n📊 Статистика:`);
  console.log(`   Всего клиентов: 4877`);
  console.log(`   С external_refs: 2706`);
  console.log(`   БЕЗ external_refs: ${clientsWithoutRefs[0].count}`);
  
  if (hasRentprogId) {
    console.log('\n✅ В таблице есть поле с RentProg ID!');
    console.log('   Можно быстро создать external_refs');
  } else {
    console.log('\n⚠️  Нет явного поля с RentProg ID');
    console.log('   Нужен полный snapshot для синхронизации');
  }
  
} catch (error) {
  console.error('❌ Ошибка:', error.message);
  process.exit(1);
} finally {
  await sql.end();
}

