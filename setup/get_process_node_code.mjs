#!/usr/bin/env node
import fetch from 'node-fetch';

const N8N_HOST = 'https://n8n.rentflow.rentals/api/v1';
const N8N_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI';

const headers = {
  'X-N8N-API-KEY': N8N_API_KEY,
  'Content-Type': 'application/json'
};

const WORKFLOW_ID = 'P3BnmX7Nrmh1cusF';

try {
  const getResponse = await fetch(`${N8N_HOST}/workflows/${WORKFLOW_ID}`, {
    method: 'GET',
    headers
  });
  
  if (!getResponse.ok) {
    throw new Error(`Failed to get workflow: ${getResponse.status}`);
  }
  
  const responseData = await getResponse.json();
  const workflow = responseData.data || responseData;
  
  const processNode = workflow.nodes.find(n => n.name === 'Process All Bookings');
  
  if (!processNode) {
    console.log('Нода "Process All Bookings" не найдена!');
    process.exit(1);
  }
  
  console.log('='.repeat(80));
  console.log('КОД НОДЫ "Process All Bookings":');
  console.log('='.repeat(80));
  console.log(processNode.parameters.jsCode);
  
} catch (error) {
  console.error('Ошибка:', error.message);
  process.exit(1);
}

