import postgres from 'postgres';
import dotenv from 'dotenv';

dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL ||
  'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(DATABASE_URL, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

async function checkProgress() {
  try {
    const deals = await sql`SELECT COUNT(*) as total FROM amocrm_deals`;
    const webhookEvents = await sql`SELECT COUNT(*) as total FROM amocrm_webhook_events`;
    const recentDeals = await sql`
      SELECT 
        COUNT(*) as count,
        MAX(updated_at) as last_update
      FROM amocrm_deals
      WHERE updated_at > NOW() - INTERVAL '1 hour'
    `;

    console.log('\n📊 Прогресс парсинга AmoCRM:\n');
    console.log(`✅ Всего сделок в БД: ${deals[0].total}`);
    console.log(`📥 Событий вебхуков: ${webhookEvents[0].total}`);
    console.log(`🕐 Обновлено за последний час: ${recentDeals[0].count}`);
    if (recentDeals[0].last_update) {
      console.log(`⏰ Последнее обновление: ${recentDeals[0].last_update}`);
    }

    // Статистика по RentProg ID
    const withRentProg = await sql`
      SELECT COUNT(*) as count
      FROM amocrm_deals
      WHERE metadata->>'rentprog_booking_id' IS NOT NULL
    `;
    console.log(`🔗 Сделок с RentProg ID: ${withRentProg[0].count}`);

  } catch (error) {
    console.error('❌ Ошибка:', error.message);
  } finally {
    await sql.end();
  }
}

checkProgress();

