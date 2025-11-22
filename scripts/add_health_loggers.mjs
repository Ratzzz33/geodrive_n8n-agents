import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const API_URL =
  process.env.N8N_API_URL?.replace(/\/$/, '') ||
  'https://n8n.rentflow.rentals/api/v1';
const API_KEY =
  process.env.N8N_API_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI';

if (!API_KEY) {
  console.error('❌ N8N_API_KEY is required');
  process.exit(1);
}

const WORKFLOWS = [
  {
    id: 'DmgFVhxEeXl9AOjg',
    file: 'n8n-workflows/_RentProg__Inactive_Kutaisi_Service.json',
    branch: 'wf_rentprog_inactive_kutaisi_service',
    label: 'Inactive Kutaisi+Service',
  },
  {
    id: 'ihRLR0QCJySx319b',
    file: 'n8n-workflows/rentprog-car-prices-daily.json',
    branch: 'wf_rentprog_prices_daily',
    label: 'Car Prices Daily',
  },
  {
    id: 'w8g8cJb0ccReaqIE',
    file: 'n8n-workflows/rentprog-company-cash-parser.json',
    branch: 'wf_company_cash',
    label: 'Company Cash Parser',
  },
  {
    id: 'u3cOUuoaH5RSw7hm',
    file: 'n8n-workflows/cars-parser-current.json',
    branch: 'wf_cars_parser',
    label: 'Cars Parser',
  },
  {
    id: 'xSjwtwrrWUGcBduU',
    file: 'n8n-workflows/rentprog-history-parser-final.json',
    branch: 'wf_history_parser',
    label: 'History Parser',
  },
  {
    id: '7gKTEFi1wyEaY8Ri',
    file: 'n8n-workflows/_RentProg__Inactive_Tbilisi.json',
    branch: 'wf_rentprog_inactive_tbilisi',
    label: 'Inactive Tbilisi',
  },
  {
    id: 'FDMvu8P8DKilQTOK',
    file: 'n8n-workflows/_RentProg__Inactive_Batumi.json',
    branch: 'wf_rentprog_inactive_batumi',
    label: 'Inactive Batumi',
  },
  {
    id: 'rCCVTgR2FcWWRxpq',
    file: 'n8n-workflows/_RentProg__Active_Bookings.json',
    branch: 'wf_rentprog_active_bookings',
    label: 'Active Bookings',
  },
];

const headers = {
  'Content-Type': 'application/json',
  'X-N8N-API-KEY': API_KEY,
  Accept: 'application/json',
};

async function fetchWorkflow(id) {
  const res = await fetch(`${API_URL.replace(/\/api\/v1$/, '')}/api/v1/workflows/${id}`, {
    headers,
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch workflow ${id}: ${res.status} ${res.statusText}`);
  }
  const body = await res.json();
  return body.data;
}

function buildHealthNode(cfg, successNode, credentials) {
  const name = `Log Health - ${cfg.label}`;
  const id = `log-health-${crypto.randomUUID()}`;
  const position = successNode?.position
    ? [successNode.position[0] + 200, successNode.position[1]]
    : [0, 0];

  return {
    parameters: {
      operation: 'executeQuery',
      query: `INSERT INTO health (ts, branch, ok, reason) VALUES (NOW(), '${cfg.branch}', TRUE, 'success')`,
      options: {},
    },
    name,
    type: 'n8n-nodes-base.postgres',
    typeVersion: 2.4,
    position,
    id,
    credentials,
  };
}

function ensureConnection(connections, fromNode, toNode) {
  if (!connections[fromNode]) {
    connections[fromNode] = { main: [] };
  }
  if (!Array.isArray(connections[fromNode].main)) {
    connections[fromNode].main = [];
  }
  if (connections[fromNode].main.length === 0) {
    connections[fromNode].main.push([]);
  }
  const alreadyLinked = connections[fromNode].main[0].some(
    (entry) => entry.node === toNode
  );
  if (!alreadyLinked) {
    connections[fromNode].main[0].push({
      node: toNode,
      type: 'main',
      index: 0,
    });
  }
}

async function updateWorkflow(cfg) {
  console.log(`\n▶️  Processing workflow ${cfg.id} (${cfg.label})`);
  const workflow = await fetchWorkflow(cfg.id);

  const successNode =
    workflow.nodes.find((node) => node.name === 'Success') ||
    workflow.nodes.find((node) => node.type === 'n8n-nodes-base.noOp');
  if (!successNode) {
    throw new Error(`Success node not found in workflow ${cfg.id}`);
  }

  const existingHealth = workflow.nodes.find((node) =>
    node.name.startsWith('Log Health -')
  );
  if (existingHealth && workflow.connections?.[successNode.name]?.main?.some((branch) =>
    branch.some((entry) => entry.node === existingHealth.name)
  )) {
    console.log('   - Health logger already exists, skipping');
    return workflow;
  }

  const postgresNode = workflow.nodes.find(
    (node) =>
      node.type === 'n8n-nodes-base.postgres' && node.credentials?.postgres
  );
  if (!postgresNode) {
    throw new Error(`Postgres credentials not found in workflow ${cfg.id}`);
  }

  const healthNode = buildHealthNode(cfg, successNode, postgresNode.credentials);
  workflow.nodes.push(healthNode);
  workflow.connections = workflow.connections || {};
  ensureConnection(workflow.connections, successNode.name, healthNode.name);
  workflow.connections[healthNode.name] = { main: [] };

  const payload = {
    id: workflow.id,
    name: workflow.name,
    nodes: workflow.nodes,
    connections: workflow.connections,
    settings: workflow.settings || {},
    staticData: workflow.staticData ?? null,
    tags: workflow.tags || [],
    meta: workflow.meta || undefined,
    pinData: workflow.pinData || undefined,
    active: workflow.active,
  };

  const res = await fetch(`${API_URL.replace(/\/api\/v1$/, '')}/api/v1/workflows/${cfg.id}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errorBody = await res.text();
    throw new Error(
      `Failed to update workflow ${cfg.id}: ${res.status} ${res.statusText} - ${errorBody}`
    );
  }
  const updated = await res.json();
  const targetFile = path.join(process.cwd(), cfg.file);
  fs.writeFileSync(targetFile, JSON.stringify(updated.data, null, 2), 'utf-8');
  console.log(`   ✅ Added health logger → ${healthNode.name}`);
  return updated.data;
}

async function main() {
  for (const cfg of WORKFLOWS) {
    try {
      await updateWorkflow(cfg);
    } catch (error) {
      console.error(`   ❌ ${error.message}`);
      process.exitCode = 1;
    }
  }
}

main();

