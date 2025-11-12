// Поиск device_id для Toyota RAV4 EP021EP
import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

try {
  console.log('🔍 Ищу device_id для Toyota RAV4 EP021EP...\n');
  
  // Ищем по части названия
  const devices = await sql`
    SELECT device_id, alias, car_id, matched
    FROM starline_devices
    WHERE alias LIKE '%021%' 
       OR alias LIKE '%RAV4%'
       OR alias LIKE '%EP021EP%'
    ORDER BY alias
  `;
  
  if (devices.length > 0) {
    console.log('✅ Найдено устройств:', devices.length);
    console.log('\n📋 Список устройств:');
    devices.forEach((d, i) => {
      console.log(`\n${i + 1}. ${d.alias}`);
      console.log(`   device_id: ${d.device_id}`);
      console.log(`   matched: ${d.matched ? '✅' : '❌'}`);
      if (d.car_id) {
        console.log(`   car_id: ${d.car_id}`);
      }
    });
    
    // Берем первое подходящее устройство
    const targetDevice = devices.find(d => 
      d.alias.includes('RAV4') || 
      d.alias.includes('EP021EP') ||
      d.alias.includes('021')
    ) || devices[0];
    
    console.log(`\n🎯 Использую устройство: ${targetDevice.alias} (device_id: ${targetDevice.device_id})`);
    
    // Сохраняем device_id в файл для использования в тесте
    const fs = await import('fs');
    fs.writeFileSync('device_id.txt', targetDevice.device_id.toString());
    console.log(`\n💾 device_id сохранен в device_id.txt`);
  } else {
    console.log('❌ Устройства не найдены в базе данных');
    console.log('⚠️ Используйте device_id: 123456 для теста');
  }
} catch (error) {
  console.error('❌ Ошибка:', error.message);
} finally {
  await sql.end();
}

