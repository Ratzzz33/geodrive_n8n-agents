import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

async function checkNestedProcessingResult() {
  const sql = postgres(CONNECTION_STRING, {
    max: 1,
    ssl: { rejectUnauthorized: false },
  });

  console.log('\n🔍 Проверка обработки вложенных car и client...\n');

  try {
    // 1. Проверка booking
    console.log('1️⃣ Проверка booking 486033:');
    const booking = await sql`
      SELECT id, car_id, client_id, car_name, location_start, total
      FROM bookings
      WHERE id = (
        SELECT entity_id FROM external_refs
        WHERE system = 'rentprog' AND external_id = '486033'
      );
    `;

    if (booking.length > 0) {
      const b = booking[0];
      console.log('   ✅ Booking найден!');
      console.log(`   ID: ${b.id}`);
      console.log(`   Car ID: ${b.car_id} (${b.car_id ? 'UUID ✅' : 'NULL ❌'})`);
      console.log(`   Client ID: ${b.client_id} (${b.client_id ? 'UUID ✅' : 'NULL ❌'})`);
      console.log(`   Car Name: ${b.car_name}`);
      console.log(`   Location: ${b.location_start}`);
      console.log(`   Total: ${b.total}\n`);

      // 2. Проверка car
      if (b.car_id) {
        console.log('2️⃣ Проверка связанной машины:');
        const car = await sql`
          SELECT id, car_name, number, vin, mileage
          FROM cars
          WHERE id = ${b.car_id};
        `;

        if (car.length > 0) {
          const c = car[0];
          console.log('   ✅ Машина найдена!');
          console.log(`   ID: ${c.id}`);
          console.log(`   Name: ${c.car_name}`);
          console.log(`   Number: ${c.number}`);
          console.log(`   VIN: ${c.vin}`);
          console.log(`   Mileage: ${c.mileage}\n`);

          // Проверка external_refs для car
          const carRef = await sql`
            SELECT external_id FROM external_refs
            WHERE entity_id = ${c.id} AND system = 'rentprog';
          `;
          console.log(`   RentProg ID: ${carRef[0]?.external_id || 'не найден'}\n`);
        } else {
          console.log('   ❌ Машина НЕ найдена по UUID!\n');
        }
      }

      // 3. Проверка client
      if (b.client_id) {
        console.log('3️⃣ Проверка связанного клиента:');
        const client = await sql`
          SELECT id, name, phone, email
          FROM clients
          WHERE id = ${b.client_id};
        `;

        if (client.length > 0) {
          const cl = client[0];
          console.log('   ✅ Клиент найден!');
          console.log(`   ID: ${cl.id}`);
          console.log(`   Name: ${cl.name}`);
          console.log(`   Phone: ${cl.phone}`);
          console.log(`   Email: ${cl.email || 'N/A'}\n`);

          // Проверка external_refs для client
          const clientRef = await sql`
            SELECT external_id FROM external_refs
            WHERE entity_id = ${cl.id} AND system = 'rentprog';
          `;
          console.log(`   RentProg ID: ${clientRef[0]?.external_id || 'не найден'}\n`);
        } else {
          console.log('   ❌ Клиент НЕ найден по UUID!\n');
        }
      }

      // 4. Проверка возможности JOIN
      console.log('4️⃣ Проверка JOIN (booking → car → client):');
      const joinResult = await sql`
        SELECT 
          b.id as booking_id,
          b.total,
          c.car_name,
          c.number as car_number,
          cl.name as client_name,
          cl.phone as client_phone
        FROM bookings b
        LEFT JOIN cars c ON b.car_id = c.id
        LEFT JOIN clients cl ON b.client_id = cl.id
        WHERE b.id = (
          SELECT entity_id FROM external_refs
          WHERE system = 'rentprog' AND external_id = '486033'
        );
      `;

      if (joinResult.length > 0) {
        const jr = joinResult[0];
        console.log('   ✅ JOIN успешен!');
        console.log(`   Booking: ${jr.booking_id}`);
        console.log(`   Car: ${jr.car_name} (${jr.car_number})`);
        console.log(`   Client: ${jr.client_name} (${jr.client_phone})`);
        console.log(`   Total: ${jr.total}\n`);
      } else {
        console.log('   ❌ JOIN не удался\n');
      }

    } else {
      console.log('   ❌ Booking НЕ найден\n');
    }

    console.log('✅ Проверка завершена!\n');

  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

checkNestedProcessingResult();

