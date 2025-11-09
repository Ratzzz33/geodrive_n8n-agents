import fetch from 'node-fetch';

const token = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxNjA0NiIsInNjcCI6InVzZXIiLCJhdWQiOm51bGwsImlhdCI6MTc2MjQ5MDExMywiZXhwIjoxNzY1MDgyMTEzLCJqdGkiOiI0MmUxNzQ5Zi02MjEyLTRmOTMtOGM0Zi02ZWMwODUzYmUwYWQifQ.20oXaXcgK_hdofbUK3RGdQuPa0pGWtZTV4b42-A8oY4';

async function main() {
  console.log('🔍 Проверяем есть ли history/changelog для конкретной брони\n');
  
  // Получаем последнюю бронь
  const bookingsResponse = await fetch('https://rentprog.net/api/v1/bookings?per_page=1', {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json'
    }
  });
  
  const bookingsData = await bookingsResponse.json();
  
  if (!bookingsData.data || bookingsData.data.length === 0) {
    console.log('❌ Нет броней');
    return;
  }
  
  const booking = bookingsData.data[0];
  const bookingId = booking.id;
  
  console.log(`📋 Бронь #${bookingId}: ${booking.attributes.number}`);
  console.log(`   Клиент: ${booking.attributes.client_fullname || 'N/A'}`);
  console.log(`   Авто: ${booking.attributes.car_code || 'N/A'}`);
  
  // Проверяем возможные endpoints для истории брони
  const endpoints = [
    `https://rentprog.net/api/v1/bookings/${bookingId}/history`,
    `https://rentprog.net/api/v1/bookings/${bookingId}/changes`,
    `https://rentprog.net/api/v1/bookings/${bookingId}/versions`,
    `https://rentprog.net/api/v1/bookings/${bookingId}/audit`,
    `https://rentprog.net/api/v1/bookings/${bookingId}/log`,
    `https://rentprog.net/api/v1/bookings/${bookingId}/timeline`,
    `https://rentprog.net/api/v1/bookings/${bookingId}/events`
  ];
  
  console.log('\n🔍 Проверяем endpoints для истории брони:\n');
  
  for (const url of endpoints) {
    try {
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
          'Origin': 'https://web.rentprog.ru',
          'Referer': `https://web.rentprog.ru/bookings/${bookingId}`
        }
      });
      
      console.log(`${url}`);
      console.log(`   → ${response.status} ${response.statusText}`);
      
      if (response.ok) {
        const data = await response.json();
        console.log(`   ✅ SUCCESS!`);
        console.log(JSON.stringify(data, null, 2).substring(0, 500));
      }
    } catch (error) {
      console.log(`   ❌ ${error.message}`);
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('\n💡 Если все 404, то история не доступна через API');
  console.log('   Нужно парсить страницу /history напрямую');
}

main();

