#!/usr/bin/env node
/**
 * MCP Server для управления браузером через Chrome DevTools Protocol
 * Использует Puppeteer для работы с headless браузером
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import puppeteer from 'puppeteer';
import { writeFile } from 'fs/promises';

// Глобальная переменная для хранения браузера и страницы
let browser = null;
let page = null;

// Функция для инициализации браузера
async function initBrowser() {
  if (!browser) {
    browser = await puppeteer.launch({
      headless: false, // Видимый браузер для отладки
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        // Убираем отключение GPU для видимого режима
        '--start-maximized', // Запускать в полноэкранном режиме
      ],
    });
    page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
  }
  return { browser, page };
}

// Функция для закрытия браузера
async function closeBrowser() {
  if (browser) {
    await browser.close();
    browser = null;
    page = null;
  }
}

// Инициализация MCP сервера
const server = new Server(
  {
    name: 'chrome-devtools-mcp-server',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Список доступных инструментов для работы с браузером
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'navigate',
        description: 'Навигация на указанный URL в браузере',
        inputSchema: {
          type: 'object',
          properties: {
            url: {
              type: 'string',
              description: 'URL для навигации',
            },
            waitUntil: {
              type: 'string',
              enum: ['load', 'domcontentloaded', 'networkidle0', 'networkidle2'],
              description: 'Когда считать навигацию завершенной',
              default: 'networkidle2',
            },
          },
          required: ['url'],
        },
      },
      {
        name: 'screenshot',
        description: 'Сделать скриншот текущей страницы',
        inputSchema: {
          type: 'object',
          properties: {
            fullPage: {
              type: 'boolean',
              description: 'Сделать скриншот всей страницы или только видимой части',
              default: false,
            },
            path: {
              type: 'string',
              description: 'Путь для сохранения скриншота (опционально)',
            },
          },
        },
      },
      {
        name: 'click',
        description: 'Кликнуть на элемент по селектору',
        inputSchema: {
          type: 'object',
          properties: {
            selector: {
              type: 'string',
              description: 'CSS селектор элемента',
            },
            waitForNavigation: {
              type: 'boolean',
              description: 'Ждать навигации после клика',
              default: false,
            },
          },
          required: ['selector'],
        },
      },
      {
        name: 'type',
        description: 'Ввести текст в элемент',
        inputSchema: {
          type: 'object',
          properties: {
            selector: {
              type: 'string',
              description: 'CSS селектор элемента',
            },
            text: {
              type: 'string',
              description: 'Текст для ввода',
            },
            clear: {
              type: 'boolean',
              description: 'Очистить поле перед вводом',
              default: true,
            },
          },
          required: ['selector', 'text'],
        },
      },
      {
        name: 'evaluate',
        description: 'Выполнить JavaScript на странице и вернуть результат',
        inputSchema: {
          type: 'object',
          properties: {
            expression: {
              type: 'string',
              description: 'JavaScript выражение для выполнения',
            },
          },
          required: ['expression'],
        },
      },
      {
        name: 'wait_for',
        description: 'Ожидать появления элемента или текста',
        inputSchema: {
          type: 'object',
          properties: {
            selector: {
              type: 'string',
              description: 'CSS селектор для ожидания',
            },
            visible: {
              type: 'boolean',
              description: 'Ждать, пока элемент станет видимым',
              default: true,
            },
            timeout: {
              type: 'number',
              description: 'Таймаут в миллисекундах',
              default: 30000,
            },
          },
        },
      },
      {
        name: 'get_content',
        description: 'Получить HTML содержимое страницы или элемента',
        inputSchema: {
          type: 'object',
          properties: {
            selector: {
              type: 'string',
              description: 'CSS селектор элемента (опционально, если не указан - вернет весь HTML)',
            },
          },
        },
      },
      {
        name: 'get_text',
        description: 'Получить текстовое содержимое элемента',
        inputSchema: {
          type: 'object',
          properties: {
            selector: {
              type: 'string',
              description: 'CSS селектор элемента',
            },
          },
          required: ['selector'],
        },
      },
      {
        name: 'close_browser',
        description: 'Закрыть браузер и освободить ресурсы',
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
    await initBrowser();

    switch (name) {
      case 'navigate': {
        await page.goto(args.url, {
          waitUntil: args.waitUntil || 'networkidle2',
          timeout: 60000,
        });
        const title = await page.title();
        const url = page.url();
        return {
          content: [
            {
              type: 'text',
              text: `Навигация выполнена:\nURL: ${url}\nЗаголовок: ${title}`,
            },
          ],
        };
      }

      case 'screenshot': {
        const screenshot = await page.screenshot({
          fullPage: args.fullPage || false,
          type: 'png',
        });
        
        let result = 'Скриншот сделан';
        if (args.path) {
          await writeFile(args.path, screenshot);
          result += `\nСохранен в: ${args.path}`;
        } else {
          result += `\nРазмер: ${screenshot.length} байт`;
        }
        
        return {
          content: [
            {
              type: 'text',
              text: result,
            },
          ],
        };
      }

      case 'click': {
        await page.waitForSelector(args.selector, { visible: true, timeout: 30000 });
        if (args.waitForNavigation) {
          await Promise.all([
            page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }),
            page.click(args.selector),
          ]);
        } else {
          await page.click(args.selector);
        }
        return {
          content: [
            {
              type: 'text',
              text: `Клик по селектору "${args.selector}" выполнен`,
            },
          ],
        };
      }

      case 'type': {
        await page.waitForSelector(args.selector, { visible: true, timeout: 30000 });
        if (args.clear !== false) {
          await page.click(args.selector, { clickCount: 3 });
        }
        await page.type(args.selector, args.text, { delay: 50 });
        return {
          content: [
            {
              type: 'text',
              text: `Текст "${args.text}" введен в элемент "${args.selector}"`,
            },
          ],
        };
      }

      case 'evaluate': {
        const result = await page.evaluate((expr) => {
          return eval(expr);
        }, args.expression);
        return {
          content: [
            {
              type: 'text',
              text: `Результат выполнения JavaScript:\n${JSON.stringify(result, null, 2)}`,
            },
          ],
        };
      }

      case 'wait_for': {
        await page.waitForSelector(args.selector, {
          visible: args.visible !== false,
          timeout: args.timeout || 30000,
        });
        return {
          content: [
            {
              type: 'text',
              text: `Элемент "${args.selector}" найден`,
            },
          ],
        };
      }

      case 'get_content': {
        let content;
        if (args.selector) {
          content = await page.evaluate((sel) => {
            const element = document.querySelector(sel);
            return element ? element.outerHTML : null;
          }, args.selector);
        } else {
          content = await page.content();
        }
        return {
          content: [
            {
              type: 'text',
              text: content || 'Элемент не найден',
            },
          ],
        };
      }

      case 'get_text': {
        const text = await page.evaluate((sel) => {
          const element = document.querySelector(sel);
          return element ? element.textContent.trim() : null;
        }, args.selector);
        return {
          content: [
            {
              type: 'text',
              text: text || 'Элемент не найден',
            },
          ],
        };
      }

      case 'close_browser': {
        await closeBrowser();
        return {
          content: [
            {
              type: 'text',
              text: 'Браузер закрыт',
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

// Обработка завершения работы
process.on('SIGINT', async () => {
  await closeBrowser();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await closeBrowser();
  process.exit(0);
});

// Запуск сервера
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('MCP Chrome DevTools Server запущен');
}

main().catch((error) => {
  console.error('Ошибка запуска сервера:', error);
  process.exit(1);
});

