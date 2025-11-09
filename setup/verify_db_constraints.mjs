#!/usr/bin/env node
import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

async function verifyConstraints() {
  const sql = postgres(CONNECTION_STRING, {max: 1, ssl: {rejectUnauthorized: false}});
  
  console.log('\n🔍 Проверка constraints и структуры БД\n');
  
  try {
    // 1. Проверка UNIQUE constraint на rentprog_employees.rentprog_id
    const rentprogUnique = await sql`
      SELECT constraint_name, constraint_type
      FROM information_schema.table_constraints
      WHERE table_name = 'rentprog_employees'
        AND constraint_type = 'UNIQUE'
    `;
    
    console.log('1️⃣ rentprog_employees.rentprog_id UNIQUE constraint:');
    if (rentprogUnique.length > 0) {
      rentprogUnique.forEach(c => {
        console.log(`   ✅ ${c.constraint_name} (${c.constraint_type})`);
      });
    } else {
      console.log('   ❌ UNIQUE constraint НЕ найден!');
    }
    
    // 2. Проверка FK от bookings.responsible_id к rentprog_employees.id
    const bookingsFK = await sql`
      SELECT 
        tc.constraint_name,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name
      FROM information_schema.table_constraints AS tc 
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
      WHERE tc.table_name = 'bookings'
        AND tc.constraint_type = 'FOREIGN KEY'
        AND kcu.column_name = 'responsible_id'
    `;
    
    console.log('\n2️⃣ bookings.responsible_id FK:');
    if (bookingsFK.length > 0) {
      const fk = bookingsFK[0];
      console.log(`   ✅ ${fk.constraint_name}`);
      console.log(`      ${fk.column_name} → ${fk.foreign_table_name}.${fk.foreign_column_name}`);
    } else {
      console.log('   ❌ FK constraint НЕ найден!');
    }
    
    // 3. Проверка индексов
    const indexes = await sql`
      SELECT 
        indexname,
        tablename,
        indexdef
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND (
          (tablename = 'rentprog_employees' AND indexname LIKE '%rentprog%')
          OR (tablename = 'bookings' AND indexname LIKE '%responsible%')
        )
      ORDER BY tablename, indexname
    `;
    
    console.log('\n3️⃣ Индексы:');
    if (indexes.length > 0) {
      indexes.forEach(idx => {
        console.log(`   ✅ ${idx.tablename}.${idx.indexname}`);
      });
    } else {
      console.log('   ⚠️  Индексы не найдены');
    }
    
    // 4. Проверка external_refs constraints
    const extRefsUnique = await sql`
      SELECT constraint_name, constraint_type
      FROM information_schema.table_constraints
      WHERE table_name = 'external_refs'
        AND constraint_type = 'UNIQUE'
    `;
    
    console.log('\n4️⃣ external_refs UNIQUE constraints:');
    if (extRefsUnique.length > 0) {
      extRefsUnique.forEach(c => {
        console.log(`   ✅ ${c.constraint_name} (${c.constraint_type})`);
      });
    } else {
      console.log('   ❌ UNIQUE constraints НЕ найдены!');
    }
    
    // 5. Проверка что все bookings.responsible_id указывают на существующие записи
    const invalidRefs = await sql`
      SELECT 
        b.id as booking_id,
        b.responsible_id
      FROM bookings b
      WHERE b.responsible_id IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM rentprog_employees re WHERE re.id = b.responsible_id
        )
      LIMIT 10
    `;
    
    console.log('\n5️⃣ Валидность bookings.responsible_id:');
    if (invalidRefs.length === 0) {
      console.log('   ✅ Все responsible_id валидны');
    } else {
      console.log(`   ❌ Найдено невалидных ссылок: ${invalidRefs.length}`);
      invalidRefs.forEach(ref => {
        console.log(`      Booking: ${ref.booking_id} → ${ref.responsible_id}`);
      });
    }
    
    // 6. Статистика использования responsible_id
    const stats = await sql`
      SELECT 
        COUNT(*) as total_bookings,
        COUNT(responsible_id) as with_responsible,
        COUNT(*) - COUNT(responsible_id) as without_responsible,
        ROUND(COUNT(responsible_id)::NUMERIC / COUNT(*)::NUMERIC * 100, 2) as percentage
      FROM bookings
    `.then(rows => rows[0]);
    
    console.log('\n6️⃣ Статистика bookings.responsible_id:');
    console.log(`   Всего броней: ${stats.total_bookings}`);
    console.log(`   С responsible_id: ${stats.with_responsible} (${stats.percentage}%)`);
    console.log(`   Без responsible_id: ${stats.without_responsible}`);
    
    console.log('\n✅ Проверка завершена!');
    
  } finally {
    await sql.end();
  }
}

verifyConstraints();

