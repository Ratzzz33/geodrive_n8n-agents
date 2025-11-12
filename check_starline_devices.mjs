import postgres from 'postgres';
import 'dotenv/config';

const sql = postgres(process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require', {
  ssl: { rejectUnauthorized: false }
});

async function checkDevices() {
  try {
    const matched = await sql`
      SELECT COUNT(*) as count 
      FROM starline_devices 
      WHERE matched = TRUE AND active = TRUE
    `;
    
    const total = await sql`
      SELECT COUNT(*) as count 
      FROM starline_devices 
      WHERE active = TRUE
    `;
    
    console.log(`📊 Статистика устройств Starline:`);
    console.log(`   Всего активных: ${total[0].count}`);
    console.log(`   Сопоставленных активных: ${matched[0].count}`);
    console.log(`   ⚠️  Каждое устройство обрабатывается ~1-2 сек`);
    console.log(`   ⏱️  Ожидаемое время: ${matched[0].count * 1.5} сек (${(matched[0].count * 1.5 / 60).toFixed(1)} мин)`);
  } catch (error) {
    console.error('Ошибка:', error.message);
  } finally {
    await sql.end();
  }
}

checkDevices();

