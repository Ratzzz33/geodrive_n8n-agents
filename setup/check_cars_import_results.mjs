import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

console.log('📊 Проверка результатов импорта автомобилей...\n');

try {
  // Общее количество
  const [total] = await sql`SELECT COUNT(*) as count FROM cars`;
  console.log(`🚗 Всего автомобилей в БД: ${total.count}`);
  
  // По филиалам
  console.log('\n📍 По филиалам:');
  const byBranch = await sql`
    SELECT 
      b.code as branch,
      b.name,
      COUNT(c.id) as cars_count
    FROM cars c
    LEFT JOIN branches b ON c.branch_id = b.id
    GROUP BY b.code, b.name
    ORDER BY cars_count DESC
  `;
  
  byBranch.forEach(row => {
    console.log(`   • ${row.branch}: ${row.cars_count} машин (${row.name})`);
  });
  
  // External refs
  console.log('\n🔗 External References:');
  const [totalRefs] = await sql`
    SELECT COUNT(*) as count 
    FROM external_refs 
    WHERE system = 'rentprog' AND entity_type = 'car'
  `;
  console.log(`   Связей с RentProg: ${totalRefs.count}`);
  
  // Примеры данных
  console.log('\n📋 Примеры автомобилей:');
  const samples = await sql`
    SELECT 
      c.plate,
      c.model,
      c.data->>'car_name' as rentprog_name,
      c.data->>'id' as rentprog_id,
      b.code as branch,
      c.created_at
    FROM cars c
    LEFT JOIN branches b ON c.branch_id = b.id
    LIMIT 5
  `;
  
  samples.forEach((car, idx) => {
    console.log(`\n   ${idx + 1}. ${car.model || car.rentprog_name}`);
    console.log(`      Номер: ${car.plate || 'N/A'}`);
    console.log(`      Филиал: ${car.branch}`);
    console.log(`      RentProg ID: ${car.rentprog_id}`);
    console.log(`      Добавлен: ${car.created_at.toISOString().split('T')[0]}`);
  });
  
  // Проверка данных в JSONB
  console.log('\n🔍 Проверка полноты данных:');
  const [withData] = await sql`
    SELECT COUNT(*) as count 
    FROM cars 
    WHERE data IS NOT NULL AND data != '{}'::jsonb
  `;
  console.log(`   Автомобилей с полными данными: ${withData.count} из ${total.count}`);
  
  if (total.count === 0) {
    console.log('\n⚠️  БД пуста! Workflow еще не был выполнен или произошла ошибка.');
    console.log('   Запустите workflow: https://n8n.rentflow.rentals/workflow/j7UEBJvTzjhHrzR4');
  } else {
    console.log('\n✅ Импорт завершен успешно!');
  }
  
} catch (error) {
  console.error('\n❌ Ошибка:', error.message);
  process.exit(1);
} finally {
  await sql.end();
}

