/**
 * Добавление недостающих машин из Excel в БД
 */

import postgres from 'postgres';

const sql = postgres('postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require', {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

// UUID филиалов (актуальные из БД)
const BRANCHES = {
  'Тбилиси': '277eaada-1428-4c04-9cd7-5e614e43bedc',
  'Батуми': '627c4c88-d8a1-47bf-b9a6-2e9ad33112a4',
  'Кутаиси': '5e551b32-934c-498f-a4a1-a90079985c0a',
  'Сервисный центр': '6026cff7-eee8-4fb9-be26-604f308911f0'
};

const CARS_TO_ADD = [
  {
    plate: 'TT780TR', // убран "/"
    model: 'Skoda Kodiaq',
    rentprog_id: '54504', // из CSV
    branch: 'Кутаиси',
    vin: 'XW8LD6NS1LH401873',
    year: 2019
  },
  {
    plate: 'IV430AN', // убран "/"
    model: 'BMW 430i',
    rentprog_id: '63041',
    branch: 'Сервисный центр',
    vin: 'WBA4Z1C00L5N40567',
    year: 2019
  },
  {
    plate: 'CC760XC', // убран "/"
    model: 'Buick Encore',
    rentprog_id: '66996',
    branch: 'Кутаиси',
    vin: 'KL4CJ2SB2JB535769',
    year: 2018
  }
];

async function main() {
  try {
    console.log('\n📝 Добавление машин из Excel в БД\n');
    
    let added = 0;
    let skipped = 0;
    
    for (const car of CARS_TO_ADD) {
      // Проверяем существует ли уже
      const existing = await sql`
        SELECT id, plate FROM cars WHERE plate = ${car.plate}
      `;
      
      if (existing.length > 0) {
        console.log(`  ⚪ ${car.plate} - уже есть в БД (id: ${existing[0].id})`);
        skipped++;
        continue;
      }
      
      const branch_id = BRANCHES[car.branch];
      
      // Вставляем машину
      const [newCar] = await sql`
        INSERT INTO cars (
          plate,
          model,
          branch_id,
          vin,
          year,
          data
        )
        VALUES (
          ${car.plate},
          ${car.model},
          ${branch_id},
          ${car.vin},
          ${car.year},
          ${JSON.stringify({ 
            plate: car.plate,
            model: car.model,
            vin: car.vin,
            year: car.year
          })}
        )
        RETURNING id, plate, model
      `;
      
      console.log(`  ✅ ${newCar.plate} - ${newCar.model} (id: ${newCar.id})`);
      
      // Создаем external_ref для RentProg
      try {
        await sql`
          INSERT INTO external_refs (
            entity_type,
            entity_id,
            system,
            external_id
          )
          VALUES (
            'car',
            ${newCar.id},
            'rentprog',
            ${car.rentprog_id}
          )
        `;
      } catch (err) {
        // Игнорируем если уже есть
        if (err.code !== '23505') throw err;
      }
      
      console.log(`    🔗 Создана ссылка RentProg ID: ${car.rentprog_id}`);
      
      added++;
    }
    
    console.log('\n📈 ИТОГО:\n');
    console.log(`  ✅ Добавлено: ${added}`);
    console.log(`  ⚪ Пропущено (уже есть): ${skipped}`);
    console.log(`  📊 Всего обработано: ${CARS_TO_ADD.length}`);
    
    // Проверяем результат
    console.log('\n🔍 Проверка добавленных машин:\n');
    const added_plates = CARS_TO_ADD.map(c => c.plate);
    const result = await sql`
      SELECT 
        c.plate,
        c.model,
        b.name as branch,
        er.external_id as rentprog_id
      FROM cars c
      LEFT JOIN branches b ON b.id = c.branch_id
      LEFT JOIN external_refs er ON er.entity_id = c.id AND er.entity_type = 'car' AND er.system = 'rentprog'
      WHERE c.plate = ANY(${added_plates})
      ORDER BY c.plate
    `;
    
    for (const row of result) {
      console.log(`  ${row.plate} - ${row.model} (${row.branch}) - RentProg ID: ${row.rentprog_id}`);
    }
    
    console.log('\n✅ Готово!\n');
    
  } catch (error) {
    console.error('\n❌ Ошибка:', error);
  } finally {
    await sql.end();
  }
}

main();

