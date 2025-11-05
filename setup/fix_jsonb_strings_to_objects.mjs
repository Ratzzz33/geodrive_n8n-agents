import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

async function fixJsonbStringsToObjects() {
  console.log('🔧 Converting JSONB strings to objects...\n');
  
  try {
    // Найти все брони где data - это строка, а не объект
    const stringBookings = await sql`
      SELECT COUNT(*) as count
      FROM bookings
      WHERE jsonb_typeof(data) = 'string'
    `.then(rows => rows[0].count);
    
    console.log(`Found ${stringBookings} bookings with string data`);
    
    if (parseInt(stringBookings) > 0) {
      console.log('\nDisabling trigger temporarily...');
      
      // Отключить триггер
      await sql`ALTER TABLE bookings DISABLE TRIGGER process_booking_nested_entities_trigger`;
      
      console.log('Converting...');
      
      // Конвертировать все строки в объекты
      // data#>>'{}'  извлекает текст из JSONB-строки, затем ::JSONB парсит как объект
      await sql`
        UPDATE bookings
        SET data = (data#>>'{}')::JSONB
        WHERE jsonb_typeof(data) = 'string'
      `;
      
      console.log('Enabling trigger...');
      
      // Включить триггер обратно
      await sql`ALTER TABLE bookings ENABLE TRIGGER process_booking_nested_entities_trigger`;
      
      console.log('✅ Converted!');
      
      // Проверить результат
      const remainingStrings = await sql`
        SELECT COUNT(*) as count
        FROM bookings
        WHERE jsonb_typeof(data) = 'string'
      `.then(rows => rows[0].count);
      
      console.log(`\nRemaining strings: ${remainingStrings}`);
      
      const objects = await sql`
        SELECT COUNT(*) as count
        FROM bookings
        WHERE jsonb_typeof(data) = 'object'
      `.then(rows => rows[0].count);
      
      console.log(`Objects: ${objects}`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await sql.end();
  }
}

fixJsonbStringsToObjects();

