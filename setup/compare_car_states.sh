#!/bin/bash
cd /root/geodrive_n8n-agents
node -e "
import('./dist/integrations/rentprog.js').then(async m => {
  try {
    const cars = await m.apiFetch('tbilisi', '/cars', { per_page: 100 });
    console.log('✅ Получено', cars.length, 'машин из RentProg API\\n');
    
    const states = {};
    cars.forEach(c => {
      const s = c.state !== undefined ? String(c.state) : 'undefined';
      if (!states[s]) states[s] = [];
      states[s].push(c.number || c.code);
    });
    
    console.log('📊 Состояния (state) в RentProg:');
    Object.entries(states).sort((a,b) => b[1].length - a[1].length).forEach(([s, ps]) => {
      console.log('State', s + ':', ps.length, 'машин | Примеры:', ps.slice(0,3).join(', '));
    });
  } catch(e) {
    console.error('❌ Ошибка:', e.message);
    process.exit(1);
  }
}).catch(e => {
  console.error('❌ Import error:', e.message);
  process.exit(1);
});
"

