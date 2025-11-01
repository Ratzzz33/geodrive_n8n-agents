/**
 * Утилиты для работы с n8n REST API
 * Можно импортировать и использовать в вашем коде
 */

import http from 'http';
import https from 'https';
import { URL } from 'url';

const N8N_HOST = process.env.N8N_HOST || 'http://46.224.17.15:5678';
const N8N_API_KEY = process.env.N8N_API_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDEzNDI5fQ.OKx4tazufS_mMQ7sg30r08MOAUliYVWCRNYNEVEjHI8';

const baseURL = N8N_HOST.includes('/api/v1') ? N8N_HOST : `${N8N_HOST}/api/v1`;

/**
 * Выполняет HTTP запрос к n8n API
 */
export function makeN8nRequest(method, path, data = null) {
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

/**
 * Получить список всех workflow
 */
export async function listWorkflows() {
  return await makeN8nRequest('GET', '/workflows');
}

/**
 * Получить workflow по ID
 */
export async function getWorkflow(id) {
  return await makeN8nRequest('GET', `/workflows/${id}`);
}

/**
 * Создать новый workflow
 */
export async function createWorkflow(workflow) {
  return await makeN8nRequest('POST', '/workflows', workflow);
}

/**
 * Обновить существующий workflow
 */
export async function updateWorkflow(id, workflow) {
  return await makeN8nRequest('PUT', `/workflows/${id}`, workflow);
}

/**
 * Удалить workflow
 */
export async function deleteWorkflow(id) {
  return await makeN8nRequest('DELETE', `/workflows/${id}`);
}

/**
 * Активировать workflow
 */
export async function activateWorkflow(id) {
  return await makeN8nRequest('POST', `/workflows/${id}/activate`);
}

/**
 * Деактивировать workflow
 */
export async function deactivateWorkflow(id) {
  return await makeN8nRequest('POST', `/workflows/${id}/deactivate`);
}

/**
 * Выполнить workflow
 */
export async function executeWorkflow(id, data = {}) {
  return await makeN8nRequest('POST', `/workflows/${id}/execute`, data);
}

