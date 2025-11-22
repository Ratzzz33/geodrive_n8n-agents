/**
 * Импорт всех партнеров (investors) в БД
 * Данные получены из RentProg UI /investors
 */

import postgres from 'postgres';

const sql = postgres('postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require', {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

// Полный список партнеров из RentProg
const INVESTORS = [
  { id: '222', name: 'Антон Крылов', share: 50 },
  { id: '748', name: 'Денис Михалин', share: 50 },
  { id: '749', name: 'Мария Никишова', share: 50 },
  { id: '769', name: 'Дидонов 2', share: 50 },
  { id: '771', name: 'Александр Лункин', share: 50 },
  { id: '772', name: 'Сойка Иван', share: 50 },
  { id: '773', name: 'Трофим', share: 50 },
  { id: '774', name: 'Веслогузов Сергей', share: 50 },
  { id: '775', name: 'Павел Чупахов (Дидонов)', share: 50 },
  { id: '776', name: 'Дидонов 1', share: 50 },
  { id: '777', name: 'Bortsvadze Beka', share: 50 },
  { id: '779', name: 'Квачантридзе Апполон', share: 50 },
  { id: '780', name: 'Лобов Алексей', share: 50 },
  { id: '781', name: 'Pekker Grigorii', share: 50 },
  { id: '782', name: 'Kuboyan Karen', share: 50 },
  { id: '783', name: 'Михаил Повх (Дидонов)', share: 50 },
  { id: '785', name: 'Ломия Гоча', share: 50 },
  { id: '750', name: 'Дурсун Касумов', share: 50 }
];

async function main() {
  try {
    console.log('\n📊 Импорт партнеров в БД\n');
    console.log(`Всего партнеров: ${INVESTORS.length}\n`);
    
    let created = 0;
    let existing = 0;
    let updated = 0;
    
    for (const investor of INVESTORS) {
      // Проверяем существует ли партнер в rentprog_employees
      const existingRecord = await sql`
        SELECT 
          rpe.id,
          rpe.rentprog_id,
          rpe.name,
          rpe.role
        FROM rentprog_employees rpe
        WHERE rpe.rentprog_id = ${investor.id}
        LIMIT 1
      `;
      
      if (existingRecord.length > 0) {
        console.log(`  ⚪ ${investor.id} - ${investor.name}: уже есть в БД`);
        existing++;
        
        // Проверяем нужно ли обновить имя или роль
        const current = existingRecord[0];
        if (current.name !== investor.name || current.role !== 'partner') {
          await sql`
            UPDATE rentprog_employees
            SET 
              name = ${investor.name},
              role = 'partner'
            WHERE rentprog_id = ${investor.id}
          `;
          console.log(`    ✅ Обновлено имя/роль`);
          updated++;
        }
      } else {
        // Создаем нового партнера (без branch_id - его нет в таблице)
        const [newRecord] = await sql`
          INSERT INTO rentprog_employees (
            rentprog_id,
            name,
            role
          )
          VALUES (
            ${investor.id},
            ${investor.name},
            'partner'
          )
          RETURNING id, rentprog_id, name
        `;
        
        console.log(`  ✅ ${investor.id} - ${investor.name}: создан`);
        created++;
        
        // Создаем external_ref если нужно
        // (опционально, если есть таблица employees и нужна связь)
      }
    }
    
    console.log('\n📈 СТАТИСТИКА:\n');
    console.log(`  ✅ Создано: ${created}`);
    console.log(`  🔄 Обновлено: ${updated}`);
    console.log(`  ⚪ Уже существовало: ${existing}`);
    console.log(`  📊 Всего партнеров: ${INVESTORS.length}`);
    
    // Проверяем связь с машинами
    console.log('\n🚗 Проверка связи с машинами:\n');
    
    const carsWithInvestors = await sql`
      SELECT 
        c.investor_id,
        COUNT(*) as cars_count
      FROM cars c
      WHERE c.investor_id IS NOT NULL
      GROUP BY c.investor_id
      ORDER BY c.investor_id
    `;
    
    console.log('Партнеры с машинами:');
    for (const record of carsWithInvestors) {
      const investor = INVESTORS.find(inv => inv.id === record.investor_id.toString());
      const name = investor ? investor.name : 'Неизвестный';
      console.log(`  ${record.investor_id} (${name}): ${record.cars_count} машин`);
    }
    
    // Партнеры без машин
    const investorIdsWithCars = new Set(carsWithInvestors.map(r => r.investor_id.toString()));
    const investorsWithoutCars = INVESTORS.filter(inv => !investorIdsWithCars.has(inv.id));
    
    console.log(`\nПартнеры БЕЗ машин: ${investorsWithoutCars.length}`);
    if (investorsWithoutCars.length > 0 && investorsWithoutCars.length <= 10) {
      for (const inv of investorsWithoutCars) {
        console.log(`  ${inv.id} - ${inv.name}`);
      }
    }
    
    console.log('\n✅ Импорт завершен!\n');
    
  } catch (error) {
    console.error('\n❌ Ошибка:', error);
  } finally {
    await sql.end();
  }
}

main();

