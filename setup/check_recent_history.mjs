import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

async function checkRecentHistory() {
  const sql = postgres(CONNECTION_STRING, {
    max: 1,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('🔍 Проверяем последние записи в history...\n');

    // Общее количество
    const total = await sql`SELECT COUNT(*) as count FROM history;`;
    console.log(`📊 Всего записей в history: ${total[0].count}\n`);

    // По филиалам (последние 10 минут)
    console.log('📋 Записи за последние 10 минут (по филиалам):');
    const recent = await sql`
      SELECT branch, COUNT(*) as count, MAX(ts) as last_update
      FROM history
      WHERE ts > NOW() - INTERVAL '10 minutes'
      GROUP BY branch
      ORDER BY branch;
    `;

    if (recent.length === 0) {
      console.log('  ❌ Нет новых записей за последние 10 минут\n');
    } else {
      recent.forEach(r => {
        console.log(`  ${r.branch}: ${r.count} записей (последняя: ${r.last_update})`);
      });
      const totalRecent = recent.reduce((sum, r) => sum + parseInt(r.count), 0);
      console.log(`  \n  ИТОГО за 10 минут: ${totalRecent} записей\n`);
    }

    // Последние 5 записей (для проверки)
    console.log('📋 Последние 5 записей:');
    const last5 = await sql`
      SELECT branch, operation_type, operation_id, description, ts
      FROM history
      ORDER BY ts DESC
      LIMIT 5;
    `;

    last5.forEach((r, idx) => {
      console.log(`  ${idx + 1}. [${r.branch}] ${r.operation_id} - ${r.description.substring(0, 50)}...`);
      console.log(`     ${r.ts}`);
    });

    console.log('');

    // Проверка дублей (должно быть 0)
    console.log('🔍 Проверка на дубли:');
    const duplicates = await sql`
      SELECT branch, operation_id, COUNT(*) as count
      FROM history
      WHERE operation_id IS NOT NULL
      GROUP BY branch, operation_id
      HAVING COUNT(*) > 1
      LIMIT 5;
    `;

    if (duplicates.length === 0) {
      console.log('  ✅ Дублей нет!\n');
    } else {
      console.log('  ❌ Найдены дубли:');
      duplicates.forEach(d => {
        console.log(`     ${d.branch} / ${d.operation_id}: ${d.count} записей`);
      });
      console.log('');
    }

  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

checkRecentHistory();

