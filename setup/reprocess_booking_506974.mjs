#!/usr/bin/env node
import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

async function reprocessBooking() {
  const sql = postgres(CONNECTION_STRING, {max: 1, ssl: {rejectUnauthorized: false}});
  
  console.log('\n🔄 Переобработка booking 506974\n');
  
  try {
    // Найти UUID booking
    const bookingUuid = await sql`
      SELECT entity_id 
      FROM external_refs 
      WHERE system = 'rentprog' 
        AND entity_type = 'booking' 
        AND external_id = '506974'
    `.then(rows => rows[0]?.entity_id);
    
    if (!bookingUuid) {
      console.log('❌ Booking не найден\n');
      return;
    }
    
    console.log(`📝 Booking UUID: ${bookingUuid}`);
    
    // Найти данные вебхука в external_refs
    const extRef = await sql`
      SELECT data 
      FROM external_refs 
      WHERE entity_id = ${bookingUuid} 
        AND system = 'rentprog'
    `.then(rows => rows[0]);
    
    if (!extRef || !extRef.data) {
      console.log('❌ Данные вебхука не найдены в external_refs\n');
      
      // Попытка найти в events
      const event = await sql`
        SELECT data 
        FROM events 
        WHERE type LIKE 'booking.%' 
          AND (data->>'id')::text = '506974'
        ORDER BY ts DESC 
        LIMIT 1
      `.then(rows => rows[0]);
      
      if (!event || !event.data) {
        console.log('❌ Данные не найдены и в events\n');
        
        // Установим responsible_id вручную по известным данным
        console.log('📝 Установка responsible_id вручную на Данияр Байбаков (16003)...\n');
        
        const employeeUuid = await sql`
          SELECT entity_id 
          FROM external_refs 
          WHERE system = 'rentprog' 
            AND entity_type = 'rentprog_employee' 
            AND external_id = '16003'
        `.then(rows => rows[0]?.entity_id);
        
        if (!employeeUuid) {
          console.log('❌ Сотрудник 16003 не найден!');
          return;
        }
        
        await sql`
          UPDATE bookings 
          SET responsible_id = ${employeeUuid}, 
              updated_at = NOW()
          WHERE id = ${bookingUuid}
        `;
        
        console.log('✅ responsible_id установлен!');
        
        // Проверка
        const updated = await sql`
          SELECT 
            b.responsible_id,
            re.name,
            re.rentprog_id
          FROM bookings b
          LEFT JOIN rentprog_employees re ON re.id = b.responsible_id
          WHERE b.id = ${bookingUuid}
        `.then(rows => rows[0]);
        
        console.log(`\n✅ Проверка: ${updated.name} (RentProg ID: ${updated.rentprog_id})`);
        return;
      }
      
      console.log('📊 Найдены данные в events, используем их...\n');
      
      // Обновляем booking с данными из events
      await sql`
        UPDATE bookings 
        SET data = ${sql.json(event.data)}, 
            updated_at = NOW()
        WHERE id = ${bookingUuid}
      `;
      
      console.log('✅ Booking обновлён, триггер должен переобработать данные');
      
    } else {
      console.log('📊 Найдены данные в external_refs\n');
      console.log('   Данные вебхука:', JSON.stringify(extRef.data, null, 2).substring(0, 500));
      
      // Обновляем booking с данными из external_refs
      await sql`
        UPDATE bookings 
        SET data = ${sql.json(extRef.data)}, 
            updated_at = NOW()
        WHERE id = ${bookingUuid}
      `;
      
      console.log('\n✅ Booking обновлён, триггер переобработал данные');
    }
    
    // Финальная проверка
    const final = await sql`
      SELECT 
        b.responsible_id,
        re.name,
        re.rentprog_id,
        b.data
      FROM bookings b
      LEFT JOIN rentprog_employees re ON re.id = b.responsible_id
      WHERE b.id = ${bookingUuid}
    `.then(rows => rows[0]);
    
    console.log('\n📊 Результат:');
    console.log(`   data: ${JSON.stringify(final.data)}`);
    console.log(`   responsible_id: ${final.responsible_id || 'NULL'}`);
    
    if (final.responsible_id) {
      console.log(`   ✅ Ответственный: ${final.name} (RentProg ID: ${final.rentprog_id})`);
      
      if (final.rentprog_id === '16003') {
        console.log('\n🎉 УСПЕХ! Правильно указывает на Данияр Байбаков (16003)');
      } else {
        console.log(`\n⚠️  Указывает на ${final.rentprog_id}, ожидалось 16003`);
      }
    } else {
      console.log('   ❌ responsible_id всё ещё пуст!');
    }
    
  } finally {
    await sql.end();
  }
}

reprocessBooking();

