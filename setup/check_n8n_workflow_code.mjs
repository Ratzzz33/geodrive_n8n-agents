#!/usr/bin/env node
import https from 'https';

const API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI';
const WORKFLOW_ID = 'rCCVTgR2FcWWRxpq';

const options = {
  hostname: 'n8n.rentflow.rentals',
  port: 443,
  path: `/api/v1/workflows/${WORKFLOW_ID}`,
  method: 'GET',
  headers: {
    'X-N8N-API-KEY': API_KEY
  },
  rejectUnauthorized: false
};

const req = https.request(options, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const response = JSON.parse(data);
    const workflow = response.data || response;
    const nodes = workflow.nodes || [];
    const node = nodes.find(n => n.name === 'Process All Bookings');
    
    if (!node) {
      console.error('❌ Node not found in n8n workflow');
      process.exit(1);
    }
    
    const code = node.parameters.jsCode;
    const matches = code.match(/const bookingId/g);
    
    console.log(`Occurrences of "const bookingId" in n8n: ${matches ? matches.length : 0}\n`);
    
    if (matches && matches.length > 1) {
      console.log('❌ Duplicate declarations in n8n!\n');
      
      const lines = code.split('\n');
      lines.forEach((line, i) => {
        if (line.includes('const bookingId')) {
          console.log(`Line ${i + 1}: ${line.trim()}`);
        }
      });
    } else {
      console.log('✅ No duplicates in n8n');
    }
  });
});

req.on('error', (e) => {
  console.error('Error:', e);
});

req.end();

