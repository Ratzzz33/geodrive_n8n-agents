import postgres from 'postgres';

const sql = postgres('postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require', {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

try {
  // Проверяем один конкретный платеж
  const paymentId = 'cbd9cfe6-b187-432a-aebe-1fb26f351744';
  
  const [payment] = await sql`
    SELECT 
      p.id,
      p.payment_date,
      p.raw_data,
      b.code as branch_code
    FROM payments p
    LEFT JOIN branches b ON b.id = p.branch_id
    WHERE p.id = ${paymentId}
  `;
  
  if (!payment) {
    console.log('Платеж не найден!');
  } else {
    console.log('Payment ID:', payment.id);
    console.log('Payment Date:', payment.payment_date);
    console.log('Branch Code:', payment.branch_code);
    console.log('Raw Data ID:', payment.raw_data?.id);
    console.log('Raw Data Company ID:', payment.raw_data?.company_id);
    console.log('\nПроверки:');
    console.log('  paymentId:', !!payment.id);
    console.log('  rentprogCountId:', !!parseInt(payment.raw_data?.id, 10));
    console.log('  paymentDate:', !!payment.payment_date);
    console.log('  branch:', !!payment.branch_code);
    
    const rentprogCountId = parseInt(payment.raw_data?.id, 10);
    console.log('\nЗначения:');
    console.log('  paymentId:', payment.id);
    console.log('  rentprogCountId:', rentprogCountId);
    console.log('  paymentDate:', payment.payment_date);
    console.log('  branch:', payment.branch_code);
    
    console.log('\nПройдет ли проверку?', 
      !!payment.id && !!rentprogCountId && !!payment.branch_code);
  }
  
} catch (err) {
  console.error('❌ Ошибка:', err);
} finally {
  await sql.end();
}

