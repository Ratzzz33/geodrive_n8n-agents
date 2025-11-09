import https from 'https';

const TOKENS = {
  'service-center': 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxNjA0NSIsInNjcCI6InVzZXIiLCJhdWQiOm51bGwsImlhdCI6MTc2MjQ5MDA0MSwiZXhwIjoxNzY1MDgyMDQxLCJqdGkiOiI1ZDkwMDI2MC02NTE2LTQxYjctOTI4Ny1jODAyMjNiN2EwNTMifQ.oLMvW9mftfJ9Oivy2riQjx8uK12Ur6aaFy02sDs6DSc',
  'tbilisi': 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxNjA0NiIsInNjcCI6InVzZXIiLCJhdWQiOm51bGwsImlhdCI6MTc2MjQ5MDExMywiZXhwIjoxNzY1MDgyMTEzLCJqdGkiOiI0MmUxNzQ5Zi02MjEyLTRmOTMtOGM0Zi02ZWMwODUzYmUwYWQifQ.20oXaXcgK_hdofbUK3RGdQuPa0pGWtZTV4b42-A8oY4',
  'batumi': 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxNjA0OCIsInNjcCI6InVzZXIiLCJhdWQiOm51bGwsImlhdCI6MTc2MjQ5MDE1NCwiZXhwIjoxNzY1MDgyMTU0LCJqdGkiOiI0MWUxMjRjOS01MDgxLTQ2NmMtOTUxNS0xNWEwMjE4ZDA1OTEifQ.l2MfCEf1LJLe-kCuF-MKyOMdhAmd3UWfzG7xECMy37o',
  'kutaisi': 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxNjA0OSIsInNjcCI6InVzZXIiLCJhdWQiOm51bGwsImlhdCI6MTc2MjQ5MDIwMiwiZXhwIjoxNzY1MDgyMjAyLCJqdGkiOiIxZWVlMWU2YS1kMTNhLTQwMzEtYjI2Mi04NGRiM2Y0ZmFiMGEifQ.xGIpTLumIwLxpitlLbeclqb9XBedY8jV1wCIuMP69Vs'
};

async function testAPI(branch, token) {
  console.log(`\n🔍 Тестирую ${branch.toUpperCase()}...`);
  
  // Формируем даты (последний месяц)
  const now = new Date();
  const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  
  const formatDate = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  
  const startDate = formatDate(monthAgo);
  const endDate = formatDate(now);
  
  // Test 1: Company Cash V2 с датами
  const cashUrl = `https://rentprog.net/api/v1/company_counts_v2?start_date=${startDate}&end_date=${endDate}`;
  
  return new Promise((resolve) => {
    const options = {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json, text/plain, */*',
        'Origin': 'https://web.rentprog.ru',
        'Referer': 'https://web.rentprog.ru/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36'
      }
    };
    
    const req = https.request(cashUrl, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log(`   Status: ${res.statusCode}`);
        
        if (res.statusCode === 200) {
          try {
            const json = JSON.parse(data);
            console.log(`   ✅ Company Cash: OK`);
            console.log(`   📊 Counts: ${json.counts ? json.counts.length : 0} платежей`);
            console.log(`   💰 Cash GEL: ${json.cash_gel || 0}`);
          } catch (e) {
            console.log(`   ❌ Parse error: ${e.message}`);
          }
        } else {
          console.log(`   ❌ Error: ${data.substring(0, 200)}`);
        }
        
        resolve();
      });
    });
    
    req.on('error', (err) => {
      console.log(`   ❌ Request error: ${err.message}`);
      resolve();
    });
    
    req.end();
  });
}

async function testBookings(branch, token) {
  console.log(`\n🔍 Тестирую Users для ${branch.toUpperCase()}...`);
  
  // Test: Users (employees)
  const usersUrl = 'https://rentprog.net/api/v1/users';
  
  await new Promise((resolve) => {
    const options = {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json, text/plain, */*',
        'Origin': 'https://web.rentprog.ru',
        'Referer': 'https://web.rentprog.ru/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36'
      }
    };
    
    const req = https.request(usersUrl, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log(`   Status: ${res.statusCode}`);
        
        if (res.statusCode === 200) {
          try {
            const json = JSON.parse(data);
            const users = Array.isArray(json) ? json : (json.data || []);
            console.log(`   ✅ Users: OK`);
            console.log(`   👥 Users count: ${users.length}`);
            
            // Показать пример первого пользователя
            if (users.length > 0) {
              const firstUser = users[0];
              console.log(`   📋 Sample user: ${firstUser.name || firstUser.email || 'N/A'}`);
              if (firstUser.currency_accounts) {
                console.log(`   💰 Currency accounts: ${firstUser.currency_accounts.length}`);
              }
            }
          } catch (e) {
            console.log(`   ⚠️ Parse error: ${e.message}`);
          }
        } else {
          console.log(`   ❌ Error: ${res.statusCode}`);
        }
        
        resolve();
      });
    });
    
    req.on('error', (error) => {
      console.log(`   ❌ Request failed: ${error.message}`);
      resolve();
    });
    
    req.end();
  });

  console.log(`\n🔍 Тестирую Bookings для ${branch.toUpperCase()}...`);
  
  const now = new Date();
  const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000);
  const updatedAtFrom = tenMinutesAgo.toISOString();
  
  const bookingsUrl = `https://rentprog.net/api/v1/bookings?updated_at_from=${encodeURIComponent(updatedAtFrom)}&per_page=50`;
  
  return new Promise((resolve) => {
    const options = {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json, text/plain, */*',
        'Origin': 'https://web.rentprog.ru',
        'Referer': 'https://web.rentprog.ru/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36'
      }
    };
    
    const req = https.request(bookingsUrl, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log(`   Status: ${res.statusCode}`);
        
        if (res.statusCode === 200) {
          try {
            const json = JSON.parse(data);
            console.log(`   ✅ Bookings: OK`);
            console.log(`   📋 Data: ${json.data ? json.data.length : 0} броней`);
          } catch (e) {
            console.log(`   ❌ Parse error: ${e.message}`);
          }
        } else {
          console.log(`   ❌ Error: ${data.substring(0, 200)}`);
        }
        
        resolve();
      });
    });
    
    req.on('error', (err) => {
      console.log(`   ❌ Request error: ${err.message}`);
      resolve();
    });
    
    req.end();
  });
}

async function runTests() {
  console.log('🚀 Тестирование RentProg API...\n');
  console.log('═'.repeat(60));
  
  for (const [branch, token] of Object.entries(TOKENS)) {
    await testAPI(branch, token);
    await testBookings(branch, token);
    console.log('═'.repeat(60));
  }
  
  console.log('\n✅ Тестирование завершено!');
}

runTests();

