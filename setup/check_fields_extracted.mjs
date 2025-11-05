#!/usr/bin/env node
import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

async function checkFieldsExtracted() {
  const sql = postgres(CONNECTION_STRING, {
    max: 1,
    ssl: { rejectUnauthorized: false },
  });

  console.log('\n🔍 Проверка раскладки данных по полям...\n');

  try {
    // Проверяем клиента
    const client = await sql`
      SELECT 
        c.id, c.name, c.lastname, c.phone, c.email, c.fio, 
        c.lang, c.category, c.middlename, c.company_id,
        c.data->>'name' as data_name,
        c.data->>'lastname' as data_lastname,
        c.data->>'phone' as data_phone
      FROM clients c
      JOIN external_refs er ON er.entity_id = c.id
      WHERE er.system = 'rentprog' AND er.external_id = '368848'
      LIMIT 1;
    `;

    if (client.length > 0) {
      const c = client[0];
      console.log('1️⃣ Клиент 368848:');
      console.log(`   ID: ${c.id}`);
      console.log(`   name (поле): ${c.name || 'NULL'}`);
      console.log(`   lastname (поле): ${c.lastname || 'NULL'}`);
      console.log(`   phone (поле): ${c.phone || 'NULL'}`);
      console.log(`   email (поле): ${c.email || 'NULL'}`);
      console.log(`   fio (поле): ${c.fio || 'NULL'}`);
      console.log(`   lang (поле): ${c.lang || 'NULL'}`);
      console.log(`   category (поле): ${c.category || 'NULL'}`);
      console.log(`   middlename (поле): ${c.middlename || 'NULL'}`);
      console.log(`   company_id (поле): ${c.company_id || 'NULL'}`);
      console.log(`\n   Сравнение с data JSONB:`);
      console.log(`   data->>'name': ${c.data_name || 'NULL'}`);
      console.log(`   data->>'lastname': ${c.data_lastname || 'NULL'}`);
      console.log(`   data->>'phone': ${c.data_phone || 'NULL'}`);
      
      if (c.name && c.name === c.data_name) {
        console.log(`\n   ✅ Поля заполнены корректно!`);
      } else if (!c.name && c.data_name) {
        console.log(`\n   ❌ Поле name пустое, но в data есть значение!`);
      }
    }

    // Проверяем машину
    const car = await sql`
      SELECT 
        c.id, c.plate, c.vin, c.model, c.transmission, c.fuel, 
        c.year, c.color, c.mileage, c.car_type, c.number, c.company_id,
        c.data->>'number' as data_number,
        c.data->>'vin' as data_vin,
        c.data->>'car_name' as data_car_name
      FROM cars c
      JOIN external_refs er ON er.entity_id = c.id
      WHERE er.system = 'rentprog' AND er.external_id = '37407'
      LIMIT 1;
    `;

    if (car.length > 0) {
      const c = car[0];
      console.log('\n\n2️⃣ Машина 37407:');
      console.log(`   ID: ${c.id}`);
      console.log(`   plate (поле): ${c.plate || 'NULL'}`);
      console.log(`   vin (поле): ${c.vin || 'NULL'}`);
      console.log(`   model (поле): ${c.model || 'NULL'}`);
      console.log(`   transmission (поле): ${c.transmission || 'NULL'}`);
      console.log(`   fuel (поле): ${c.fuel || 'NULL'}`);
      console.log(`   year (поле): ${c.year || 'NULL'}`);
      console.log(`   color (поле): ${c.color || 'NULL'}`);
      console.log(`   mileage (поле): ${c.mileage || 'NULL'}`);
      console.log(`   car_type (поле): ${c.car_type || 'NULL'}`);
      console.log(`   number (поле): ${c.number || 'NULL'}`);
      console.log(`   company_id (поле): ${c.company_id || 'NULL'}`);
      console.log(`\n   Сравнение с data JSONB:`);
      console.log(`   data->>'number': ${c.data_number || 'NULL'}`);
      console.log(`   data->>'vin': ${c.data_vin || 'NULL'}`);
      console.log(`   data->>'car_name': ${c.data_car_name || 'NULL'}`);
      
      if (c.plate && c.plate === c.data_number) {
        console.log(`\n   ✅ Поля заполнены корректно!`);
      } else if (!c.plate && c.data_number) {
        console.log(`\n   ❌ Поле plate пустое, но в data есть значение!`);
      }
    }

    console.log('\n✅ Проверка завершена!');

  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

checkFieldsExtracted();

