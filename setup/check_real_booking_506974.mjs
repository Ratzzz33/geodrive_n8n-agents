#!/usr/bin/env node
import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

async function checkRealBooking() {
  const sql = postgres(CONNECTION_STRING, {max: 1, ssl: {rejectUnauthorized: false}});
  
  console.log('\n📋 Проверка реального booking 506974\n');
  
  try {
    // Найти booking через external_refs
    const booking = await sql`
      SELECT 
        b.id,
        b.responsible_id,
        b.data,
        re.rentprog_id as employee_rp_id,
        re.name as employee_name
      FROM external_refs er
      JOIN bookings b ON b.id = er.entity_id
      LEFT JOIN rentprog_employees re ON re.id = b.responsible_id
      WHERE er.system = 'rentprog'
        AND er.entity_type = 'booking'
        AND er.external_id = '506974'
    `.then(rows => rows[0]);
    
    if (!booking) {
      console.log('❌ Booking 506974 не найден в БД\n');
      return;
    }
    
    console.log('📊 Booking данные:');
    console.log(`   UUID: ${booking.id}`);
    console.log(`   data: ${JSON.stringify(booking.data)}`);
    console.log(`   responsible_id: ${booking.responsible_id || 'NULL'}`);
    
    if (booking.responsible_id) {
      console.log(`   ✅ Ответственный: ${booking.employee_name} (RentProg ID: ${booking.employee_rp_id})`);
      
      // Проверим что это правильный сотрудник (16003 из вебхука)
      if (booking.employee_rp_id === '16003') {
        console.log(`   ✅ ПРАВИЛЬНО! Указывает на нового сотрудника 16003`);
      } else {
        console.log(`   ⚠️  ВНИМАНИЕ! Указывает на ${booking.employee_rp_id}, а должен на 16003`);
      }
    } else {
      console.log('   ❌ responsible_id пуст! Требуется повторная обработка вебхука.');
    }
    
    // Проверим существование обоих сотрудников из вебхука
    console.log('\n📊 Сотрудники из вебхука:');
    const employees = await sql`
      SELECT rentprog_id, name 
      FROM rentprog_employees 
      WHERE rentprog_id IN ('15748', '16003')
      ORDER BY rentprog_id
    `;
    
    if (employees.length === 0) {
      console.log('   ❌ Ни одного сотрудника не найдено!');
    } else {
      employees.forEach(e => {
        console.log(`   ${e.rentprog_id}: ${e.name || 'NULL'}`);
      });
      
      if (employees.length === 2) {
        console.log('\n   ✅ Оба сотрудника созданы');
      } else {
        console.log(`\n   ⚠️  Найден только ${employees.length} сотрудник`);
      }
    }
    
  } finally {
    await sql.end();
  }
}

checkRealBooking();

