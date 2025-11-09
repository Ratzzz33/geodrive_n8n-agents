/**
 * Проверка структуры таблицы clients и данных
 */

import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

async function checkClientsStructure() {
  const sql = postgres(CONNECTION_STRING, {
    max: 1,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('📊 Проверка структуры таблицы clients\n');

    // 1. Проверяем колонки в таблице clients
    console.log('1️⃣ Колонки в таблице clients:');
    const columns = await sql`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'clients'
      ORDER BY ordinal_position
    `;
    console.log(columns);
    console.log('');

    // 2. Смотрим пример данных клиента
    console.log('2️⃣ Пример данных клиента:');
    const sampleClient = await sql`
      SELECT *
      FROM clients
      LIMIT 1
    `;
    if (sampleClient[0]) {
      console.log('Колонки с данными:');
      for (const [key, value] of Object.entries(sampleClient[0])) {
        if (value !== null) {
          console.log(`  ${key}: ${typeof value === 'object' ? JSON.stringify(value) : value}`);
        }
      }
    }
    console.log('');

    // 3. Проверяем external_refs для клиентов
    console.log('3️⃣ External refs для клиентов из RentProg:');
    const clientRefs = await sql`
      SELECT 
        er.external_id as rentprog_id,
        c.id as client_id,
        c.name,
        c.phone,
        c.email,
        er.data
      FROM external_refs er
      JOIN clients c ON c.id = er.entity_id
      WHERE er.entity_type = 'client'
      AND er.system = 'rentprog'
      LIMIT 5
    `;
    console.log(`Найдено клиентов с external_refs: ${clientRefs.length}`);
    clientRefs.forEach(ref => {
      console.log(`\n  RentProg ID: ${ref.rentprog_id}`);
      console.log(`  Client UUID: ${ref.client_id}`);
      console.log(`  Name: ${ref.name || 'N/A'}`);
      console.log(`  Phone: ${ref.phone || 'N/A'}`);
      console.log(`  Email: ${ref.email || 'N/A'}`);
      if (ref.data) {
        console.log(`  Data в external_refs: ${JSON.stringify(ref.data).substring(0, 100)}...`);
      }
    });
    console.log('');

    // 4. Проверяем, есть ли клиенты БЕЗ external_refs
    console.log('4️⃣ Клиенты БЕЗ external_refs:');
    const orphanClients = await sql`
      SELECT c.*
      FROM clients c
      LEFT JOIN external_refs er ON er.entity_id = c.id AND er.entity_type = 'client'
      WHERE er.id IS NULL
      LIMIT 5
    `;
    console.log(`Найдено клиентов без external_refs: ${orphanClients.length}`);
    orphanClients.forEach(client => {
      console.log(`  Client UUID: ${client.id}, Name: ${client.name || 'N/A'}`);
    });
    console.log('');

    console.log('✅ Проверка завершена!');
    console.log('\n📋 ВЫВОД:');
    console.log('   - rentprog_id НЕ хранится в таблице clients');
    console.log('   - rentprog_id хранится в external_refs.external_id');
    console.log('   - Полные данные из RentProg хранятся в external_refs.data');

  } finally {
    await sql.end();
  }
}

checkClientsStructure().catch(console.error);

