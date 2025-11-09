import postgres from 'postgres';

const sql = postgres('postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require', {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

try {
  console.log('🔍 Проверка raw_data в платежах\n');
  
  const payments = await sql`
    SELECT 
      id, 
      payment_date,
      amount,
      currency,
      raw_data
    FROM payments 
    WHERE raw_data IS NOT NULL 
    LIMIT 5
  `;
  
  console.log(`Найдено платежей с raw_data: ${payments.length}\n`);
  
  payments.forEach((p, i) => {
    console.log(`Payment ${i + 1}:`);
    console.log(`  ID: ${p.id}`);
    console.log(`  Date: ${p.payment_date}`);
    console.log(`  Amount: ${p.amount} ${p.currency}`);
    console.log(`  Raw Data:`, JSON.stringify(p.raw_data, null, 2));
    console.log('');
  });
  
  // Проверим ключи в raw_data
  if (payments.length > 0) {
    const keys = Object.keys(payments[0].raw_data || {});
    console.log('Доступные ключи в raw_data:', keys);
  }
  
} catch (err) {
  console.error('❌ Ошибка:', err);
} finally {
  await sql.end();
}

