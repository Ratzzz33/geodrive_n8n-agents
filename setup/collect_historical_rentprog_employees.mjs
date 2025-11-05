#!/usr/bin/env node
import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 10,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  console.log('📦 Сбор исторических данных о сотрудниках RentProg\n');
  console.log('='.repeat(60));

  try {
    console.log('\n1️⃣ Подсчет броней для обработки...');
    const bookingsCount = await sql`
      SELECT COUNT(*) as count FROM bookings
    `.then(rows => parseInt(rows[0].count));
    
    console.log(`   📊 Всего броней: ${bookingsCount}`);

    console.log('\n2️⃣ Запуск массового UPDATE для активации триггера...');
    console.log('   ⏳ Это займет несколько минут...\n');
    
    const batchSize = 500;
    let processed = 0;
    
    while (processed < bookingsCount) {
      await sql`
        UPDATE bookings
        SET updated_at = NOW()
        WHERE id IN (
          SELECT id FROM bookings
          ORDER BY created_at
          LIMIT ${batchSize}
          OFFSET ${processed}
        )
      `;
      
      processed += batchSize;
      const progress = Math.min(100, Math.round((processed / bookingsCount) * 100));
      console.log(`   ⏳ Прогресс: ${processed}/${bookingsCount} (${progress}%)`);
    }
    
    console.log('\n3️⃣ Подсчет созданных сотрудников...');
    const employeesCount = await sql`
      SELECT COUNT(*) as count FROM rentprog_employees
    `.then(rows => parseInt(rows[0].count));
    
    console.log(`   ✅ Всего сотрудников: ${employeesCount}`);

    if (employeesCount > 0) {
      console.log('\n4️⃣ Топ-10 сотрудников...');
      const topEmployees = await sql`
        SELECT 
          rentprog_id,
          name,
          created_at
        FROM rentprog_employees
        ORDER BY created_at ASC
        LIMIT 10
      `;
      
      console.log('\n   Первые 10 сотрудников:');
      topEmployees.forEach((emp, idx) => {
        const createdAt = new Date(emp.created_at).toLocaleString('ru-RU');
        console.log(`   ${idx + 1}. ${emp.name || 'Unknown'} (ID: ${emp.rentprog_id}) - ${createdAt}`);
      });

      console.log('\n5️⃣ Сотрудники без имён...');
      const noNames = await sql`
        SELECT COUNT(*) as count 
        FROM rentprog_employees 
        WHERE name IS NULL OR name LIKE 'Employee %'
      `.then(rows => parseInt(rows[0].count));
      
      console.log(`   ⚠️  Сотрудников без имён: ${noNames}`);
      
      if (noNames > 0) {
        console.log('   💡 Совет: Запустите workflow для fetch полных данных от RentProg API');
      }

      console.log('\n6️⃣ Распределение по источникам...');
      const sources = await sql`
        SELECT 
          data->>'source_field' as source,
          COUNT(*) as count
        FROM rentprog_employees
        WHERE data->>'source_field' IS NOT NULL
        GROUP BY data->>'source_field'
        ORDER BY count DESC
      `;
      
      console.log('\n   Откуда собраны сотрудники:');
      sources.forEach(src => {
        console.log(`   - ${src.source}: ${src.count} сотрудников`);
      });
    }

    console.log('\n✅ Исторические данные собраны!');
    console.log('\n📊 Итого:');
    console.log(`   - Обработано броней: ${bookingsCount}`);
    console.log(`   - Найдено сотрудников: ${employeesCount}`);

  } catch (error) {
    console.error('\n❌ Ошибка:', error.message);
    throw error;
  } finally {
    await sql.end();
  }
}

main().catch(console.error);

