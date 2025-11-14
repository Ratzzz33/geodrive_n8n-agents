#!/usr/bin/env node
import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  try {
    console.log('📊 Статусы в БД (таблица gps_tracking):\n');
    
    // Получаем уникальные статусы с количеством машин
    const statuses = await sql`
      SELECT 
        status,
        COUNT(*) as count,
        COUNT(CASE WHEN is_moving THEN 1 END) as moving_count,
        COUNT(CASE WHEN NOT is_moving THEN 1 END) as parked_count,
        ARRAY_AGG(DISTINCT starline_alias ORDER BY starline_alias) FILTER (WHERE starline_alias IS NOT NULL) as example_cars
      FROM gps_tracking
      WHERE status IS NOT NULL
      GROUP BY status
      ORDER BY count DESC
    `;
    
    console.log('┌─────────────────┬───────┬──────────┬─────────┬──────────────────────────┐');
    console.log('│ Статус          │ Всего │ Движется │ Стоит   │ Примеры машин            │');
    console.log('├─────────────────┼───────┼──────────┼─────────┼──────────────────────────┤');
    
    for (const row of statuses) {
      const status = row.status.padEnd(15);
      const total = String(row.count).padStart(5);
      const moving = String(row.moving_count).padStart(8);
      const parked = String(row.parked_count).padStart(7);
      const examples = (row.example_cars || []).slice(0, 3).join(', ').substring(0, 24);
      
      console.log(`│ ${status} │ ${total} │ ${moving} │ ${parked} │ ${examples.padEnd(24)} │`);
    }
    
    console.log('└─────────────────┴───────┴──────────┴─────────┴──────────────────────────┘');
    
    // Статистика по комбинациям status + is_moving
    console.log('\n📈 Подробная статистика:\n');
    
    const detailed = await sql`
      SELECT 
        status,
        is_moving,
        AVG(speed) as avg_speed,
        MIN(speed) as min_speed,
        MAX(speed) as max_speed,
        COUNT(*) as count
      FROM gps_tracking
      WHERE status IS NOT NULL
      GROUP BY status, is_moving
      ORDER BY status, is_moving DESC
    `;
    
    console.log('┌─────────────────┬──────────┬────────────┬──────────┬──────────┬───────┐');
    console.log('│ Статус          │ Движется │ Ср.скор.   │ Мин.скор │ Макс.скор│ Кол-во│');
    console.log('├─────────────────┼──────────┼────────────┼──────────┼──────────┼───────┤');
    
    for (const row of detailed) {
      const status = row.status.padEnd(15);
      const moving = row.is_moving ? 'ДА'.padStart(8) : 'НЕТ'.padStart(8);
      const avg = row.avg_speed ? Number(row.avg_speed).toFixed(1).padStart(10) : 'N/A'.padStart(10);
      const min = String(Math.round(row.min_speed || 0)).padStart(8);
      const max = String(Math.round(row.max_speed || 0)).padStart(8);
      const count = String(row.count).padStart(5);
      
      console.log(`│ ${status} │ ${moving} │ ${avg} │ ${min} │ ${max} │ ${count} │`);
    }
    
    console.log('└─────────────────┴──────────┴────────────┴──────────┴──────────┴───────┘');
    
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
  } finally {
    await sql.end();
  }
}

main();

