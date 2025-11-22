#!/usr/bin/env node
/**
 * Обновляет workflow rCCVTgR2FcWWRxpq:
 * меняем ноду "Save to DB" на Code-ноду,
 * которая сохраняет брони и external_refs корректно.
 */

import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';

const WORKFLOW_ID = 'rCCVTgR2FcWWRxpq';
const API_URL = `https://n8n.rentflow.rentals/api/v1/workflows/${WORKFLOW_ID}`;
const API_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CODE_NODE_BODY = readFileSync(
  path.join(__dirname, 'snippets', 'save_bookings_code.js'),
  'utf8',
);

async function main() {
  const headers = {
    'X-N8N-API-KEY': API_KEY,
    'Content-Type': 'application/json',
  };

  const getRes = await fetch(API_URL, { headers });
  if (!getRes.ok) {
    throw new Error(`Failed to fetch workflow: ${getRes.status} ${getRes.statusText}`);
  }
  const payload = await getRes.json();
  const workflow = payload.data || payload;

  const updatedNodes = workflow.nodes.map((node) => {
    if (node.name !== 'Save to DB') {
      return node;
    }
    return {
      ...node,
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      parameters: {
        jsCode: CODE_NODE_BODY,
      },
      credentials: {},
      retryOnFail: true,
      maxTries: 2,
      continueOnFail: true,
    };
  });

  const workflowBody = {
    id: workflow.id,
    name: workflow.name,
    nodes: updatedNodes,
    connections: workflow.connections,
    settings: workflow.settings,
    active: workflow.active,
    pinData: workflow.pinData || {},
    tags: workflow.tags || [],
    versionId: workflow.versionId,
  };

  const updateRes = await fetch(API_URL, {
    method: 'PUT',
    headers,
    body: JSON.stringify(workflowBody),
  });

  if (!updateRes.ok) {
    const err = await updateRes.text();
    throw new Error(`Failed to update workflow: ${updateRes.status} ${updateRes.statusText} :: ${err}`);
  }

  const updatePayload = await updateRes.json();
  console.log('✅ Workflow updated', updatePayload?.success ?? updatePayload?.data?.id);
}

main().catch((error) => {
  console.error('❌ Failed to update workflow:', error);
  process.exit(1);
});

