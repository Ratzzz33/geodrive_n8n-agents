#!/usr/bin/env node
/**
 * MCP Server для прямой работы с n8n API
 * Предоставляет инструменты для управления workflows, execution, credentials и т.д.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import axios from 'axios';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Загрузка переменных окружения из корня проекта
const envPath = join(__dirname, '..', '.env');
try {
  const envFile = readFileSync(envPath, 'utf-8');
  envFile.split('\n').forEach(line => {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim().replace(/^["']|["']$/g, '');
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  });
} catch (e) {
  // .env файл не обязателен, если переменные установлены в системе
}

// Конфигурация n8n
const N8N_BASE_URL = process.env.N8N_BASE_URL || process.env.N8N_URL || 'http://46.224.17.15:5678';
const N8N_API_KEY = process.env.N8N_API_KEY || '';

// Убираем trailing slash и добавляем /api/v1 если нужно
const n8nApiUrl = N8N_BASE_URL.replace(/\/$/, '').replace(/\/api\/v1$/, '') + '/api/v1';

// Инициализация MCP сервера
const server = new Server(
  {
    name: 'n8n-mcp-server',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Функция для выполнения запросов к n8n API
async function n8nRequest(method, endpoint, data = null) {
  if (!N8N_API_KEY) {
    throw new Error('N8N_API_KEY не настроен. Установите переменную окружения N8N_API_KEY');
  }

  const url = `${n8nApiUrl}${endpoint}`;
  const config = {
    method,
    url,
    headers: {
      'X-N8N-API-KEY': N8N_API_KEY,
      'Content-Type': 'application/json',
    },
    timeout: 30000,
  };

  if (data) {
    config.data = data;
  }

  try {
    const response = await axios(config);
    return {
      success: true,
      status: response.status,
      data: response.data,
    };
  } catch (error) {
    if (error.response) {
      return {
        success: false,
        status: error.response.status,
        error: error.response.data?.message || error.message,
        data: error.response.data,
      };
    }
    throw error;
  }
}

// Список доступных инструментов
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'n8n_list_workflows',
        description: 'Получить список всех workflows в n8n',
        inputSchema: {
          type: 'object',
          properties: {
            active: {
              type: 'boolean',
              description: 'Только активные workflow (опционально)',
            },
          },
        },
      },
      {
        name: 'n8n_get_workflow',
        description: 'Получить информацию о конкретном workflow по ID или имени',
        inputSchema: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'ID workflow',
            },
            name: {
              type: 'string',
              description: 'Имя workflow для поиска',
            },
          },
        },
      },
      {
        name: 'n8n_create_workflow',
        description: 'Создать новый workflow в n8n',
        inputSchema: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: 'Имя workflow',
            },
            nodes: {
              type: 'array',
              description: 'Массив нод workflow',
            },
            connections: {
              type: 'object',
              description: 'Соединения между нодами',
            },
            settings: {
              type: 'object',
              description: 'Настройки workflow',
            },
            tags: {
              type: 'array',
              description: 'Теги для workflow',
            },
          },
          required: ['name'],
        },
      },
      {
        name: 'n8n_update_workflow',
        description: 'Обновить существующий workflow',
        inputSchema: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'ID workflow для обновления',
            },
            name: {
              type: 'string',
              description: 'Новое имя (опционально)',
            },
            nodes: {
              type: 'array',
              description: 'Обновленные ноды (опционально)',
            },
            connections: {
              type: 'object',
              description: 'Обновленные соединения (опционально)',
            },
            active: {
              type: 'boolean',
              description: 'Активировать/деактивировать workflow',
            },
          },
          required: ['id'],
        },
      },
      {
        name: 'n8n_activate_workflow',
        description: 'Активировать workflow',
        inputSchema: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'ID workflow',
            },
          },
          required: ['id'],
        },
      },
      {
        name: 'n8n_deactivate_workflow',
        description: 'Деактивировать workflow',
        inputSchema: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'ID workflow',
            },
          },
          required: ['id'],
        },
      },
      {
        name: 'n8n_delete_workflow',
        description: 'Удалить workflow',
        inputSchema: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'ID workflow для удаления',
            },
          },
          required: ['id'],
        },
      },
      {
        name: 'n8n_execute_workflow',
        description: 'Запустить workflow вручную',
        inputSchema: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'ID workflow',
            },
            data: {
              type: 'object',
              description: 'Входные данные для workflow (опционально)',
            },
          },
          required: ['id'],
        },
      },
      {
        name: 'n8n_list_executions',
        description: 'Получить список выполнений workflow',
        inputSchema: {
          type: 'object',
          properties: {
            workflowId: {
              type: 'string',
              description: 'ID workflow (опционально, для фильтрации)',
            },
            status: {
              type: 'string',
              enum: ['success', 'error', 'waiting', 'running'],
              description: 'Фильтр по статусу (опционально)',
            },
            limit: {
              type: 'number',
              description: 'Лимит результатов (по умолчанию 20)',
              default: 20,
            },
          },
        },
      },
      {
        name: 'n8n_get_execution',
        description: 'Получить информацию о конкретном выполнении',
        inputSchema: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'ID выполнения',
            },
          },
          required: ['id'],
        },
      },
      {
        name: 'n8n_list_credentials',
        description: 'Получить список credentials',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'n8n_test_connection',
        description: 'Проверить подключение к n8n API',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
    ],
  };
});

// Обработка вызовов инструментов
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'n8n_test_connection': {
        const result = await n8nRequest('GET', '/workflows?limit=1');
        if (result.success) {
          return {
            content: [
              {
                type: 'text',
                text: `✅ Подключение к n8n успешно!\nURL: ${n8nApiUrl}\nНайдено workflows: ${result.data?.data?.length || 0}`,
              },
            ],
          };
        } else {
          return {
            content: [
              {
                type: 'text',
                text: `❌ Ошибка подключения: ${result.error || 'Неизвестная ошибка'}\nURL: ${n8nApiUrl}\nСтатус: ${result.status}`,
              },
            ],
            isError: true,
          };
        }
      }

      case 'n8n_list_workflows': {
        const result = await n8nRequest('GET', '/workflows');
        if (!result.success) {
          throw new Error(result.error || 'Ошибка получения списка workflows');
        }

        let workflows = result.data?.data || [];
        if (args.active !== undefined) {
          workflows = workflows.filter((wf) => wf.active === args.active);
        }

        return {
          content: [
            {
              type: 'text',
              text: `Найдено workflows: ${workflows.length}\n\n${workflows.map((wf) => 
                `- ${wf.name} (ID: ${wf.id}, Active: ${wf.active ? 'Да' : 'Нет'})`
              ).join('\n')}`,
            },
          ],
        };
      }

      case 'n8n_get_workflow': {
        if (args.id) {
          const result = await n8nRequest('GET', `/workflows/${args.id}`);
          if (!result.success) {
            throw new Error(result.error || 'Ошибка получения workflow');
          }
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result.data, null, 2),
              },
            ],
          };
        } else if (args.name) {
          const listResult = await n8nRequest('GET', '/workflows');
          if (!listResult.success) {
            throw new Error(listResult.error || 'Ошибка получения списка workflows');
          }
          const workflows = listResult.data?.data || [];
          const workflow = workflows.find((wf) => wf.name === args.name);
          if (!workflow) {
            throw new Error(`Workflow с именем "${args.name}" не найден`);
          }
          const result = await n8nRequest('GET', `/workflows/${workflow.id}`);
          if (!result.success) {
            throw new Error(result.error || 'Ошибка получения workflow');
          }
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result.data, null, 2),
              },
            ],
          };
        } else {
          throw new Error('Необходимо указать либо id, либо name');
        }
      }

      case 'n8n_create_workflow': {
        const workflowData = {
          name: args.name,
        };
        if (args.nodes) workflowData.nodes = args.nodes;
        if (args.connections) workflowData.connections = args.connections;
        if (args.settings) workflowData.settings = args.settings;
        if (args.tags) workflowData.tags = args.tags;

        const result = await n8nRequest('POST', '/workflows', workflowData);
        if (!result.success) {
          throw new Error(result.error || 'Ошибка создания workflow');
        }

        return {
          content: [
            {
              type: 'text',
              text: `✅ Workflow создан!\nID: ${result.data.id}\nИмя: ${result.data.name}`,
            },
          ],
        };
      }

      case 'n8n_update_workflow': {
        const updateData = {};
        if (args.name) updateData.name = args.name;
        if (args.nodes) updateData.nodes = args.nodes;
        if (args.connections) updateData.connections = args.connections;
        if (args.active !== undefined) updateData.active = args.active;

        const result = await n8nRequest('PUT', `/workflows/${args.id}`, updateData);
        if (!result.success) {
          throw new Error(result.error || 'Ошибка обновления workflow');
        }

        return {
          content: [
            {
              type: 'text',
              text: `✅ Workflow обновлен!\nID: ${result.data.id}\nИмя: ${result.data.name}\nActive: ${result.data.active ? 'Да' : 'Нет'}`,
            },
          ],
        };
      }

      case 'n8n_activate_workflow': {
        const result = await n8nRequest('POST', `/workflows/${args.id}/activate`);
        if (!result.success) {
          throw new Error(result.error || 'Ошибка активации workflow');
        }

        return {
          content: [
            {
              type: 'text',
              text: `✅ Workflow активирован!\nID: ${args.id}`,
            },
          ],
        };
      }

      case 'n8n_deactivate_workflow': {
        const result = await n8nRequest('POST', `/workflows/${args.id}/deactivate`);
        if (!result.success) {
          throw new Error(result.error || 'Ошибка деактивации workflow');
        }

        return {
          content: [
            {
              type: 'text',
              text: `✅ Workflow деактивирован!\nID: ${args.id}`,
            },
          ],
        };
      }

      case 'n8n_delete_workflow': {
        const result = await n8nRequest('DELETE', `/workflows/${args.id}`);
        if (!result.success) {
          throw new Error(result.error || 'Ошибка удаления workflow');
        }

        return {
          content: [
            {
              type: 'text',
              text: `✅ Workflow удален!\nID: ${args.id}`,
            },
          ],
        };
      }

      case 'n8n_execute_workflow': {
        const executeData = args.data ? { data: args.data } : {};
        const result = await n8nRequest('POST', `/workflows/${args.id}/execute`, executeData);
        if (!result.success) {
          throw new Error(result.error || 'Ошибка выполнения workflow');
        }

        return {
          content: [
            {
              type: 'text',
              text: `✅ Workflow запущен!\nExecution ID: ${result.data.id}\nСтатус: ${result.data.finished ? 'Завершен' : 'Выполняется'}`,
            },
          ],
        };
      }

      case 'n8n_list_executions': {
        const params = new URLSearchParams();
        if (args.workflowId) params.append('workflowId', args.workflowId);
        if (args.status) params.append('status', args.status);
        params.append('limit', String(args.limit || 20));

        const result = await n8nRequest('GET', `/executions?${params.toString()}`);
        if (!result.success) {
          throw new Error(result.error || 'Ошибка получения списка выполнений');
        }

        const executions = result.data?.data || [];
        return {
          content: [
            {
              type: 'text',
              text: `Найдено выполнений: ${executions.length}\n\n${executions.map((ex) => 
                `- ${ex.workflowId} (ID: ${ex.id}, Статус: ${ex.finished ? 'Завершен' : 'Выполняется'}, ${new Date(ex.startedAt).toLocaleString()})`
              ).join('\n')}`,
            },
          ],
        };
      }

      case 'n8n_get_execution': {
        const result = await n8nRequest('GET', `/executions/${args.id}`);
        if (!result.success) {
          throw new Error(result.error || 'Ошибка получения выполнения');
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result.data, null, 2),
            },
          ],
        };
      }

      case 'n8n_list_credentials': {
        const result = await n8nRequest('GET', '/credentials');
        if (!result.success) {
          throw new Error(result.error || 'Ошибка получения списка credentials');
        }

        const credentials = result.data?.data || [];
        return {
          content: [
            {
              type: 'text',
              text: `Найдено credentials: ${credentials.length}\n\n${credentials.map((cred) => 
                `- ${cred.name} (ID: ${cred.id}, Тип: ${cred.type})`
              ).join('\n')}`,
            },
          ],
        };
      }

      default:
        throw new Error(`Неизвестный инструмент: ${name}`);
    }
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Ошибка: ${error.message}\n${error.stack || ''}`,
        },
      ],
      isError: true,
    };
  }
});

// Запуск сервера
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('MCP n8n Server запущен');
  console.error(`n8n API URL: ${n8nApiUrl}`);
  console.error(`N8N_API_KEY: ${N8N_API_KEY ? 'настроен' : 'НЕ настроен'}`);
}

main().catch((error) => {
  console.error('Ошибка запуска сервера:', error);
  process.exit(1);
});

