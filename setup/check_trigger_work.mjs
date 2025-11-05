#!/usr/bin/env node
import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

async function checkTriggerWork() {
  const sql = postgres(CONNECTION_STRING, {
    max: 1,
    ssl: { rejectUnauthorized: false },
  });

  console.log('\n🔍 Проверка работы триггера process_booking_nested_entities...\n');

  try {
    // 1. Проверяем booking
    const booking = await sql`
      SELECT b.*, er.external_id as rentprog_id
      FROM bookings b
      JOIN external_refs er ON er.entity_id = b.id
      WHERE er.system = 'rentprog' AND er.external_id = '486033'
      LIMIT 1;
    `;

    if (booking.length === 0) {
      console.log('❌ Booking не найден');
      return;
    }

    const b = booking[0];
    console.log('1️⃣ Booking 486033:');
    console.log(`   ID: ${b.id}`);
    console.log(`   car_id: ${b.car_id || 'NULL'}`);
    console.log(`   client_id: ${b.client_id || 'NULL'}`);
    console.log(`   has_car_in_data: ${b.data?.car ? 'YES' : 'NO'}`);
    console.log(`   has_client_in_data: ${b.data?.client ? 'YES' : 'NO'}`);

    // 2. Проверяем машину
    if (b.car_id) {
      const car = await sql`
        SELECT c.*, er.external_id as rentprog_id
        FROM cars c
        LEFT JOIN external_refs er ON er.entity_id = c.id AND er.system = 'rentprog'
        WHERE c.id = ${b.car_id}
        LIMIT 1;
      `;

      if (car.length > 0) {
        const c = car[0];
        console.log('\n2️⃣ Машина из триггера:');
        console.log(`   ID: ${c.id}`);
        console.log(`   RentProg ID: ${c.rentprog_id || 'NULL'}`);
        console.log(`   Name: ${c.data?.name || 'NULL'}`);
        console.log(`   Number: ${c.data?.number || 'NULL'}`);
        console.log(`   VIN: ${c.data?.vin || 'NULL'}`);
        console.log(`   Поля в data: ${Object.keys(c.data || {}).length}`);
        
        if (c.rentprog_id) {
          console.log('   ✅ external_refs создан');
        } else {
          console.log('   ❌ external_refs НЕ создан!');
        }
      }
    } else {
      console.log('\n❌ car_id не установлен! Триггер не сработал!');
    }

    // 3. Проверяем клиента
    if (b.client_id) {
      const client = await sql`
        SELECT c.*, er.external_id as rentprog_id
        FROM clients c
        LEFT JOIN external_refs er ON er.entity_id = c.id AND er.system = 'rentprog'
        WHERE c.id = ${b.client_id}
        LIMIT 1;
      `;

      if (client.length > 0) {
        const c = client[0];
        console.log('\n3️⃣ Клиент из триггера:');
        console.log(`   ID: ${c.id}`);
        console.log(`   RentProg ID: ${c.rentprog_id || 'NULL'}`);
        console.log(`   Name: ${c.data?.name || 'NULL'}`);
        console.log(`   Phone: ${c.data?.phone || 'NULL'}`);
        console.log(`   Email: ${c.data?.email || 'NULL'}`);
        console.log(`   Поля в data: ${Object.keys(c.data || {}).length}`);
        
        if (c.rentprog_id) {
          console.log('   ✅ external_refs создан');
        } else {
          console.log('   ❌ external_refs НЕ создан!');
        }
      }
    } else {
      console.log('\n❌ client_id не установлен! Триггер не сработал!');
    }

    // 4. Проверяем корректность данных
    console.log('\n4️⃣ Проверка корректности данных:');
    if (b.data?.car?.id && b.car_id) {
      console.log(`   ✅ booking.data.car.id (${b.data.car.id}) → booking.car_id установлен`);
    }
    if (b.data?.client?.id && b.client_id) {
      console.log(`   ✅ booking.data.client.id (${b.data.client.id}) → booking.client_id установлен`);
    }

    console.log('\n✅ Проверка завершена!');

  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

checkTriggerWork();

