#!/usr/bin/env node
import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

const carIds = ['52138', '53960', '37399', '62996', '69168', '68976', '64840', '37407', '63041', '38203'];

async function main() {
  try {
    console.log('🔍 Получение информации о машинах...\n');
    
    const cars = await sql`
      SELECT 
        er.external_id as rentprog_id,
        c.plate,
        c.model,
        c.year,
        b.code as branch,
        COUNT(cp.id) as prices_in_db
      FROM external_refs er
      JOIN cars c ON c.id = er.entity_id AND er.entity_type = 'car'
      JOIN branches b ON b.id = c.branch_id
      LEFT JOIN car_prices cp ON cp.car_id = c.id
      WHERE er.system = 'rentprog'
        AND er.external_id = ANY(${carIds})
      GROUP BY er.external_id, c.plate, c.model, c.year, b.code
      ORDER BY er.external_id
    `;
    
    console.log('📊 Информация о машинах:\n');
    console.log('| RentProg ID | Номер | Модель | Год | Филиал | Цен в БД |');
    console.log('|-------------|-------|--------|-----|--------|----------|');
    
    for (const car of cars) {
      const plate = car.plate || 'N/A';
      const model = car.model || 'N/A';
      const year = car.year || 'N/A';
      console.log(`| ${car.rentprog_id.padEnd(11)} | ${plate.padEnd(5)} | ${model.padEnd(6)} | ${String(year).padEnd(3)} | ${car.branch.padEnd(6)} | ${String(car.prices_in_db).padEnd(8)} |`);
    }
    
    console.log(`\nВсего машин: ${cars.length}`);
    
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
  } finally {
    await sql.end();
  }
}

main();

