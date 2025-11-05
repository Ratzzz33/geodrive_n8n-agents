#!/usr/bin/env node
import fetch from 'node-fetch';

const N8N_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI';
const N8N_HOST = 'https://n8n.rentflow.rentals/api/v1';

async function getCredentials() {
  console.log('🔍 Получение credentials...\n');
  
  try {
    const response = await fetch(`${N8N_HOST}/credentials`, {
      headers: { 'X-N8N-API-KEY': N8N_API_KEY }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to get credentials: ${response.status}`);
    }
    
    const data = await response.json();
    const credentials = data.data || data;
    
    console.log(`Найдено credentials: ${credentials.length}\n`);
    
    for (const cred of credentials) {
      console.log(`📋 ${cred.name}`);
      console.log(`   Type: ${cred.type}`);
      console.log(`   ID: ${cred.id}`);
      console.log('');
    }
    
    // Найти Telegram
    const telegramCred = credentials.find(c => 
      c.name.toLowerCase().includes('telegram') || 
      c.type === 'telegramApi'
    );
    
    if (telegramCred) {
      console.log('✅ Telegram credential найден:');
      console.log(`   Name: ${telegramCred.name}`);
      console.log(`   ID: ${telegramCred.id}`);
      console.log(`   Type: ${telegramCred.type}`);
    } else {
      console.log('❌ Telegram credential не найден');
    }
    
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    process.exit(1);
  }
}

getCredentials();

