import fetch from 'node-fetch';

// Токены для каждого филиала
const TOKENS = {
  'service-center': 'eyJhbGciOiJIUzI1NiJ9.eyJ1c2VyX2lkIjoxOTI4MywiZXhwIjoxNzQ2NTUyMDAwfQ.F4tzmSwPzgU2SYxbgaKfBB-kLKpJIk1q3uCDZU4-8QU',
  'tbilisi': 'eyJhbGciOiJIUzI1NiJ9.eyJ1c2VyX2lkIjoxMTg1MiwiZXhwIjoxNzQ2NTUyMDAwfQ.qPq8E7zLtvRcP3zOXiJ_k7UdTBJMWw2TJixIZDbFZWI',
  'batumi': 'eyJhbGciOiJIUzI1NiJ9.eyJ1c2VyX2lkIjoxMjk3NiwiZXhwIjoxNzQ2NTUyMDAwfQ.dJ--AUmjYrqR0lmB1YcVXtXx2HB90DWOCebjm5KNdwU',
  'kutaisi': 'eyJhbGciOiJIUzI1NiJ9.eyJ1c2VyX2lkIjoxNjMwNSwiZXhwIjoxNzQ2NTUyMDAwfQ.XLX4U0EIbHVR4esDj-g2GdS_7RKK6lYgpXX3EF8pbAg'
};

const BASE_URL = 'https://rentprog.net/api/v1';

async function fetchEmployees(branch) {
  const token = TOKENS[branch];
  
  console.log(`\n📥 Fetching employees for ${branch}...`);
  
  try {
    // Пробуем разные возможные endpoints
    const endpoints = [
      '/users',
      '/employees', 
      '/company_users',
      '/staff'
    ];
    
    for (const endpoint of endpoints) {
      const url = `${BASE_URL}${endpoint}`;
      console.log(`   Trying: ${url}`);
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
          'Origin': 'https://web.rentprog.ru',
          'Referer': 'https://web.rentprog.ru/'
        }
      });
      
      console.log(`   Status: ${response.status}`);
      
      if (response.status === 200) {
        const data = await response.json();
        console.log(`   ✅ SUCCESS! Found endpoint: ${endpoint}`);
        console.log(`   Data keys:`, Object.keys(data));
        console.log(`   Sample:`, JSON.stringify(data).substring(0, 500));
        return { endpoint, data };
      }
    }
    
    console.log(`   ❌ No working endpoint found`);
    return null;
    
  } catch (error) {
    console.error(`   ❌ Error:`, error.message);
    return null;
  }
}

// Тестируем на одном филиале
const result = await fetchEmployees('tbilisi');

if (result) {
  console.log(`\n✅ Working endpoint: ${result.endpoint}`);
  console.log(`\nFull response:`);
  console.log(JSON.stringify(result.data, null, 2));
}

