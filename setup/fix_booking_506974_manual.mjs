#!/usr/bin/env node
import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

async function fixBooking() {
  const sql = postgres(CONNECTION_STRING, {max: 1, ssl: {rejectUnauthorized: false}});
  
  console.log('\n🔧 Исправление booking 506974 вручную\n');
  
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
    
    // Найти UUID сотрудника 16003 (Данияр Байбаков)
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
    
    console.log(`📝 Employee UUID: ${employeeUuid}`);
    console.log('\n🔄 Установка responsible_id...\n');
    
    // Установить responsible_id
    await sql`
      UPDATE bookings 
      SET responsible_id = ${employeeUuid}, 
          updated_at = NOW()
      WHERE id = ${bookingUuid}
    `;
    
    console.log('✅ Обновлено!\n');
    
    // Проверка
    const result = await sql`
      SELECT 
        b.id,
        b.responsible_id,
        re.name as employee_name,
        re.rentprog_id as employee_rp_id
      FROM bookings b
      LEFT JOIN rentprog_employees re ON re.id = b.responsible_id
      WHERE b.id = ${bookingUuid}
    `.then(rows => rows[0]);
    
    console.log('📊 Результат:');
    console.log(`   Booking UUID: ${result.id}`);
    console.log(`   responsible_id: ${result.responsible_id}`);
    console.log(`   Ответственный: ${result.employee_name} (RentProg ID: ${result.employee_rp_id})`);
    
    if (result.employee_rp_id === '16003') {
      console.log('\n🎉 УСПЕХ! Правильно указывает на Данияр Байбаков (16003)');
    } else {
      console.log(`\n⚠️  Указывает на ${result.employee_rp_id}, ожидалось 16003`);
    }
    
  } finally {
    await sql.end();
  }
}

fixBooking();

