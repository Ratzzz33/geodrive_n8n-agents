import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

try {
  console.log('\n🔍 Проверяем БД на наличие booking 501190...\n');
  
  const result = await sql`
    SELECT * FROM external_refs 
    WHERE system = 'rentprog' 
    AND external_id = '501190'
  `;
  
  if (result.length > 0) {
    console.log('✅ НАЙДЕНА в external_refs!');
    console.log('\n📄 Данные:');
    console.log(JSON.stringify(result[0], null, 2));
    console.log('\n🎉 WORKFLOW СРАБОТАЛ! Бронь сохранена!');
  } else {
    console.log('❌ НЕ НАЙДЕНА в external_refs');
    console.log('\nПроверяем телеграм чат - там должен быть alert "Not Found"');
  }
  
} catch (error) {
  console.error(`❌ Ошибка БД: ${error.message}`);
} finally {
  await sql.end();
}

