#!/usr/bin/env node
import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

async function checkTableStructure() {
  const sql = postgres(CONNECTION_STRING, {
    max: 1,
    ssl: { rejectUnauthorized: false },
  });

  console.log('\n🔍 Проверка структуры таблиц cars и clients...\n');

  try {
    // Проверяем структуру cars
    const carsColumns = await sql`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'cars'
      ORDER BY ordinal_position;
    `;

    console.log('📋 Таблица cars:');
    carsColumns.forEach(col => {
      console.log(`   ${col.column_name} (${col.data_type}) ${col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}`);
    });

    // Проверяем структуру clients
    const clientsColumns = await sql`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'clients'
      ORDER BY ordinal_position;
    `;

    console.log('\n📋 Таблица clients:');
    clientsColumns.forEach(col => {
      console.log(`   ${col.column_name} (${col.data_type}) ${col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}`);
    });

    // Проверяем текущие данные в cars
    const carSample = await sql`
      SELECT * FROM cars LIMIT 1;
    `;

    console.log('\n📦 Пример записи в cars:');
    if (carSample.length > 0) {
      const car = carSample[0];
      console.log(`   ID: ${car.id}`);
      Object.keys(car).forEach(key => {
        if (key !== 'id' && key !== 'data') {
          console.log(`   ${key}: ${car[key] || 'NULL'}`);
        }
      });
      console.log(`   data (JSONB): ${Object.keys(car.data || {}).length} полей`);
    }

    // Проверяем текущие данные в clients
    const clientSample = await sql`
      SELECT * FROM clients LIMIT 1;
    `;

    console.log('\n📦 Пример записи в clients:');
    if (clientSample.length > 0) {
      const client = clientSample[0];
      console.log(`   ID: ${client.id}`);
      Object.keys(client).forEach(key => {
        if (key !== 'id' && key !== 'data') {
          console.log(`   ${key}: ${client[key] || 'NULL'}`);
        }
      });
      console.log(`   data (JSONB): ${Object.keys(client.data || {}).length} полей`);
    }

  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

checkTableStructure();

