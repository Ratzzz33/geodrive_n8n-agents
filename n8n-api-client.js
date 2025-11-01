#!/usr/bin/env node
/**
 * Прямой клиент для работы с n8n REST API
 * Использование:
 *   node n8n-api-client.js list
 *   node n8n-api-client.js get <workflow-id>
 *   node n8n-api-client.js create <workflow-json-file>
 *   node n8n-api-client.js update <workflow-id> <workflow-json-file>
 *   node n8n-api-client.js delete <workflow-id>
 *   node n8n-api-client.js activate <workflow-id>
 *   node n8n-api-client.js deactivate <workflow-id>
 *   node n8n-api-client.js execute <workflow-id> [data-json-file]
 */

import http from 'http';
import https from 'https';
import { URL } from 'url';
import fs from 'fs';
import readline from 'readline';

const N8N_HOST = process.env.N8N_HOST || 'http://46.224.17.15:5678';
const N8N_API_KEY = process.env.N8N_API_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDEzNDI5fQ.OKx4tazufS_mMQ7sg30r08MOAUliYVWCRNYNEVEjHI8';

const baseURL = N8N_HOST.includes('/api/v1') ? N8N_HOST : `${N8N_HOST}/api/v1`;

function makeRequest(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, baseURL);
    const options = {
      method,
      headers: {
        'X-N8N-API-KEY': N8N_API_KEY,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    };

    const client = url.protocol === 'https:' ? https : http;
    const req = client.request(url, options, (res) => {
      let body = '';
      
      res.on('data', (chunk) => {
        body += chunk;
      });
      
      res.on('end', () => {
        try {
          const parsed = body ? JSON.parse(body) : {};
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve({ data: parsed, status: res.statusCode });
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${body}`));
          }
        } catch (e) {
          reject(new Error(`Failed to parse response: ${e.message}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    if (data) {
      req.write(JSON.stringify(data));
    }
    
    req.end();
  });
}

async function main() {
  const command = process.argv[2];
  
  try {
    switch (command) {
      case 'list':
        const listResult = await makeRequest('GET', '/workflows');
        console.log(JSON.stringify(listResult.data, null, 2));
        break;
        
      case 'get':
        const workflowId = process.argv[3];
        if (!workflowId) {
          console.error('Error: Workflow ID required');
          process.exit(1);
        }
        const getResult = await makeRequest('GET', `/workflows/${workflowId}`);
        console.log(JSON.stringify(getResult.data, null, 2));
        break;
        
      case 'create':
        const createFile = process.argv[3];
        if (!createFile) {
          console.error('Error: Workflow JSON file required');
          process.exit(1);
        }
        const createData = JSON.parse(fs.readFileSync(createFile, 'utf8'));
        const createResult = await makeRequest('POST', '/workflows', createData);
        console.log(JSON.stringify(createResult.data, null, 2));
        break;
        
      case 'update':
        const updateId = process.argv[3];
        const updateFile = process.argv[4];
        if (!updateId || !updateFile) {
          console.error('Error: Workflow ID and JSON file required');
          process.exit(1);
        }
        const updateData = JSON.parse(fs.readFileSync(updateFile, 'utf8'));
        const updateResult = await makeRequest('PUT', `/workflows/${updateId}`, updateData);
        console.log(JSON.stringify(updateResult.data, null, 2));
        break;
        
      case 'delete':
        const deleteId = process.argv[3];
        if (!deleteId) {
          console.error('Error: Workflow ID required');
          process.exit(1);
        }
        const deleteResult = await makeRequest('DELETE', `/workflows/${deleteId}`);
        console.log(JSON.stringify(deleteResult.data, null, 2));
        break;
        
      case 'activate':
        const activateId = process.argv[3];
        if (!activateId) {
          console.error('Error: Workflow ID required');
          process.exit(1);
        }
        const activateResult = await makeRequest('POST', `/workflows/${activateId}/activate`);
        console.log(JSON.stringify(activateResult.data, null, 2));
        break;
        
      case 'deactivate':
        const deactivateId = process.argv[3];
        if (!deactivateId) {
          console.error('Error: Workflow ID required');
          process.exit(1);
        }
        const deactivateResult = await makeRequest('POST', `/workflows/${deactivateId}/deactivate`);
        console.log(JSON.stringify(deactivateResult.data, null, 2));
        break;
        
      case 'execute':
        const executeId = process.argv[3];
        if (!executeId) {
          console.error('Error: Workflow ID required');
          process.exit(1);
        }
        const executeData = process.argv[4] 
          ? JSON.parse(fs.readFileSync(process.argv[4], 'utf8'))
          : {};
        const executeResult = await makeRequest('POST', `/workflows/${executeId}/execute`, executeData);
        console.log(JSON.stringify(executeResult.data, null, 2));
        break;
        
      default:
        console.error(`Unknown command: ${command}`);
        console.error(`
Usage:
  node n8n-api-client.js list
  node n8n-api-client.js get <workflow-id>
  node n8n-api-client.js create <workflow-json-file>
  node n8n-api-client.js update <workflow-id> <workflow-json-file>
  node n8n-api-client.js delete <workflow-id>
  node n8n-api-client.js activate <workflow-id>
  node n8n-api-client.js deactivate <workflow-id>
  node n8n-api-client.js execute <workflow-id> [data-json-file]
        `);
        process.exit(1);
    }
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();

