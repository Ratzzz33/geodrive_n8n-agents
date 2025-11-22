#!/usr/bin/env node

import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

// ID операций из списка пользователя
const operationIds = [
  '1866420', '1865096', '1864454', '1863796', '1863792', '1862116', '1862110',
  '1860907', '1860328', '1860104', '1859821', '1859639', '1859596', '1859032',
  '1859025', '1858494', '1858491', '1858199', '1857853', '1857851', '1857820',
  '1856987', '1856985', '1856961', '1856959', '1856746', '1856739', '1856730',
  '1856021'
];

async function checkOperations() {
  const sql = postgres(CONNECTION_STRING, {
    max: 1,
    ssl: { rejectUnauthorized: false },
    connect_timeout: 10
  });

  try {
    console.log('🔍 Проверка операций касс в таблице payments...\n');

    // Проверяем по rp_payment_id
    const foundPayments = await sql`
      SELECT 
        rp_payment_id,
        branch,
        payment_type,
        payment_method,
        amount,
        currency,
        description,
        payment_date,
        created_at
      FROM payments
      WHERE rp_payment_id = ANY(${operationIds.map(id => parseInt(id))})
      ORDER BY rp_payment_id DESC
    `;

    console.log(`✅ Найдено в таблице payments: ${foundPayments.length} из ${operationIds.length}\n`);

    if (foundPayments.length > 0) {
      console.log('📋 Найденные операции:\n');
      foundPayments.forEach((payment, idx) => {
        console.log(`  [${idx + 1}] ID: ${payment.rp_payment_id}`);
        console.log(`      Branch: ${payment.branch}`);
        console.log(`      Type: ${payment.payment_type}`);
        console.log(`      Method: ${payment.payment_method}`);
        console.log(`      Amount: ${payment.amount} ${payment.currency}`);
        console.log(`      Description: ${payment.description ? payment.description.substring(0, 60) : 'N/A'}...`);
        console.log(`      Date: ${payment.payment_date}`);
        console.log('');
      });
    }

    // Найти отсутствующие
    const foundIds = new Set(foundPayments.map(p => String(p.rp_payment_id)));
    const missing = operationIds.filter(id => !foundIds.has(id));

    if (missing.length > 0) {
      console.log(`\n❌ Отсутствуют в БД (${missing.length}):\n`);
      missing.forEach((id, idx) => {
        console.log(`  [${idx + 1}] ID: ${id}`);
      });
    }

    // Статистика
    if (foundPayments.length > 0) {
      // По типам
      const byType = {};
      foundPayments.forEach(p => {
        byType[p.payment_type] = (byType[p.payment_type] || 0) + 1;
      });

      console.log('\n📊 По типам платежей:');
      Object.entries(byType).forEach(([type, count]) => {
        console.log(`   ${type}: ${count}`);
      });

      // По филиалам
      const byBranch = {};
      foundPayments.forEach(p => {
        byBranch[p.branch] = (byBranch[p.branch] || 0) + 1;
      });

      console.log('\n📍 По филиалам:');
      Object.entries(byBranch).forEach(([branch, count]) => {
        console.log(`   ${branch}: ${count}`);
      });

      // По валютам
      const byCurrency = {};
      foundPayments.forEach(p => {
        byCurrency[p.currency] = (byCurrency[p.currency] || 0) + 1;
      });

      console.log('\n💰 По валютам:');
      Object.entries(byCurrency).forEach(([currency, count]) => {
        console.log(`   ${currency}: ${count}`);
      });
    }

    console.log('\n════════════════════════════════════════════════════════════');
    console.log('📊 ИТОГО:\n');
    console.log(`Всего проверено операций: ${operationIds.length}`);
    console.log(`Найдено в payments: ${foundPayments.length} (${(foundPayments.length / operationIds.length * 100).toFixed(1)}%)`);
    console.log(`Отсутствует: ${missing.length} (${(missing.length / operationIds.length * 100).toFixed(1)}%)`);

    // Информация о workflow
    console.log('\n📋 Информация о парсинге касс:\n');
    console.log('   Workflow: ✅Парсинг касс компании раз в 5 минуты');
    console.log('   Частота: Каждые 5 минут');
    console.log('   Операций за раз: ~172 (109+28+13+22 по филиалам)');
    console.log('   Таблица: payments');
    console.log('   Всего записей: 6463');

  } catch (error) {
    console.error('❌ Ошибка:', error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

checkOperations();

