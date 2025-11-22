#!/usr/bin/env node
import { readFileSync } from 'fs';

const wf = JSON.parse(readFileSync('n8n-workflows/_RentProg__Active_Bookings.json', 'utf8'));
const node = wf.nodes.find(n => n.name === 'Process All Bookings');

if (!node) {
  console.error('❌ Node not found');
  process.exit(1);
}

const code = node.parameters.jsCode;
const matches = code.match(/const bookingId/g);

console.log(`Occurrences of "const bookingId": ${matches ? matches.length : 0}\n`);

if (matches && matches.length > 1) {
  console.log('❌ Duplicate declarations found!\n');
  
  const lines = code.split('\n');
  lines.forEach((line, i) => {
    if (line.includes('const bookingId')) {
      console.log(`Line ${i + 1}: ${line.trim()}`);
    }
  });
  
  process.exit(1);
} else {
  console.log('✅ No duplicates found');
  process.exit(0);
}

