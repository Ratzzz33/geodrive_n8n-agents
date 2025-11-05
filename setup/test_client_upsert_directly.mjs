import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const CLIENT_ID = '368848';
const CLIENT_DATA_BASE64 = 'eyJpZCI6MzY4ODQ4LCJuYW1lIjoiWWVseXphdmV0YSIsImxhc3RuYW1lIjoiRnV0b3JpYW5za2EiLCJtaWRkbGVuYW1lIjoiIiwiZmlvIjoiWWVseXphdmV0YSBGdXRvcmlhbnNrYSIsInBob25lIjoiKzM1Mzg1Mjg1MjM1MSIsImNvdW50cnkiOm51bGwsImNpdHkiOm51bGwsImFkZHJlc3MiOiIiLCJzYWxlIjowLCJwYXNzcG9ydF9udW1iZXIiOiJGRjAxOTkyNSIsImRyaXZlcl9udW1iZXIiOiIzMS4wNS4yMDAyIiwiYmlydGhkYXkiOiIxOTgwLTA2LTA3IiwieWVhciI6bnVsbCwidXNlcl9pZCI6bnVsbCwiY3JlYXRlZF9hdCI6IjIwMjUtMDktMjlUMTk6NTc6MTguNTMyKzAzOjAwIiwidXBkYXRlZF9hdCI6IjIwMjUtMDktMjlUMjA6NDE6NTguNTUzKzAzOjAwIiwicGFzc3BvcnRfc2VyaWVzIjoiVUtSIiwicGFzc3BvcnRfaXNzdWVkIjoiMjkuMDkuMjAxNiIsImRyaXZlcl9zZXJpZXMiOiLihJYwMTI2OTciLCJkcml2ZXJfaXNzdWVkIjoiMzEuMDUuMjAzMiIsImNvbXBhbnlfaWQiOjkyNDcsImVtYWlsIjpudWxsLCJzYWxlX2Nhc2giOjAsImNhdGVnb3J5Ijoi0J3QvtCy0YvQuSIsImRvcF9pbmZvIjpudWxsLCJkZWJ0IjowLCJkZWJ0X2Rlc2NyaXB0aW9uIjpudWxsLCJwcm9ibGVtcyI6ZmFsc2UsInByb2JsZW1zX2Rlc2NyaXB0aW9uIjpudWxsLCJzZW5kX3Jldmlld19lbWFpbCI6ZmFsc2UsImFjY291bnRfaWQiOm51bGwsImVudGl0eSI6ZmFsc2UsImVudGl0eV9uYW1lIjoiIiwicmVnX2Zvcm0iOm51bGwsImVudGl0eV9waG9uZSI6IiIsImVudGl0eV9hZHJlc3MiOiIiLCJpbm4iOiIyOS4wOS4yMDI2Iiwib2dybiI6IiIsImFjY19udW1iZXIiOm51bGwsImJhbmsiOm51bGwsImtvcnIiOiIiLCJiaWsiOm51bGwsImNlbyI6bnVsbCwiZGVidG9yIjpmYWxzZSwiZG9jX251bWJlciI6bnVsbCwic2hvcnRfZW50aXR5X25hbWUiOm51bGwsInNvdXJjZSI6IiIsIm1haW5fY29tcGFueV9pZCI6OTExMCwiZGVtbyI6ZmFsc2UsInZzZXByb2thdHlfaWQiOm51bGwsImxhc3RfbWVzc2FnZWQiOm51bGwsImJhbGFuY2UiOjIxNiwidGF4aV9saWNlbnNlIjpudWxsLCJsYW5nIjoicnUiLCJ0aW5rb2ZmX2N1c3RvbWVyX2tleSI6bnVsbCwidGlua29mZl9jYXJkX2lkIjpudWxsLCJ0aW5rb2ZmX3JlYmlsbF9pZCI6bnVsbCwidGlua29mZl9jYXJkX251bWJlciI6bnVsbCwiY3JlYXRlZF9mcm9tX2FwaSI6dHJ1ZSwidXBkYXRlZF9mcm9tX2FwaSI6ZmFsc2UsImFtb2NybV9pZCI6bnVsbCwiYW1vY3JtX2xhc3RfdXBkYXRlIjpudWxsLCJpbnZhbGlkX2VtYWlsIjpmYWxzZSwiaW52YWxpZF9lbWFpbF9yZWFzb24iOm51bGwsInBhc3Nwb3J0X2lzc3VlZF9kYXRlIjpudWxsLCJwYXNzcG9ydF9leHBpcmVkX2RhdGUiOm51bGwsInlhbmRleF9kcml2ZXJfaWQiOm51bGwsImRyaXZlcl9saWNlbnNlX251bWJlciI6bnVsbCwiZHJpdmVyX2xpY2Vuc2Vfc2VyaWVzIjpudWxsLCJkcml2ZXJfbGljZW5zZV9leHBpcmVzX2F0IjpudWxsLCJkcml2ZXJfc3RhdHVzIjoiYWN0aXZlIiwidGF4aV9kcml2ZXJfZGF0YSI6e30sImJsb2NrZWRfYmFsYW5jZSI6MCwidGF4aV9wYXltZW50X21vZGVsIjowLCJjb21taXNzaW9uX3BlcmNlbnQiOiIwLjAiLCJkcml2ZXJfaXNzdWVkX2RhdGUiOm51bGwsImRyaXZlcl9leHBpcmVkX2RhdGUiOm51bGwsImNhcl9pZCI6bnVsbH0=';

async function testClientUpsert() {
  const sql = postgres(CONNECTION_STRING, {
    max: 1,
    ssl: { rejectUnauthorized: false },
  });

  console.log('\n🧪 Прямая проверка dynamic_upsert_entity для client...\n');

  try {
    // Декодируем base64
    const clientJson = Buffer.from(CLIENT_DATA_BASE64, 'base64').toString('utf8');
    console.log('1️⃣ Декодированный JSON:');
    console.log(clientJson.substring(0, 200) + '...\n');

    // Проверяем валидность JSON
    const parsed = JSON.parse(clientJson);
    console.log('2️⃣ JSON валиден ✓\n');

    // Вызываем функцию напрямую с использованием параметров
    console.log('3️⃣ Вызов dynamic_upsert_entity...\n');
    
    const result = await sql`
      SELECT * FROM dynamic_upsert_entity(
        'clients',
        ${CLIENT_ID},
        ${clientJson}::jsonb
      );
    `;

    console.log('✅ Успешно выполнено!');
    console.log('Результат:', result[0]);

  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    if (error.position) {
      console.error('   Позиция в SQL:', error.position);
    }
  } finally {
    await sql.end();
  }
}

testClientUpsert();

