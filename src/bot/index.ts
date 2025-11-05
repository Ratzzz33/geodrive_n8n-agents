/**
 * Telegram-бот Jarvis
 * Основной интерфейс системы
 */

import { Telegraf, Context } from 'telegraf';
import { config } from '../config/index.js';
import { logger } from '../utils/logger';
import { checkDatabaseHealth } from '../db';
import { healthCheck, paginate, type BranchName } from '../integrations/rentprog';
import { checkUmnicoHealth } from '../integrations/umnico';
import { checkStripeHealth } from '../integrations/stripe';
import {
  upsertCarFromRentProg,
  upsertClientFromRentProg,
  upsertBookingFromRentProg,
  getLastSyncTime,
} from '../db/upsert';
import { sendSyncProgressToN8n } from '../integrations/n8n';
import { startCommand } from './commands/start.js';
import { linkRentprogCommand } from './commands/link_rentprog.js';
import { myinfoCommand } from './commands/myinfo.js';

let bot: Telegraf | null = null;

/**
 * Инициализация основного Telegram бота
 * Использует TELEGRAM_BOT_TOKEN (@test_geodrive_check_bot или другой основной бот)
 * Для работы с пользователями: команды, ответы, синхронизация
 */
export function initBot(): Telegraf {
  if (!config.telegramBotToken) {
    throw new Error('TELEGRAM_BOT_TOKEN не установлен (основной бот для работы с пользователями)');
  }

  bot = new Telegraf(config.telegramBotToken);

  // Middleware для логирования
  bot.use(async (ctx, next) => {
    try {
      logger.debug(`Update received: ${ctx.updateType}`, {
        userId: ctx.from?.id,
        chatId: ctx.chat?.id,
        messageText: ctx.message && 'text' in ctx.message ? ctx.message.text : undefined,
      });
      await next();
    } catch (error) {
      logger.error('Error in middleware:', error);
      throw error;
    }
  });

  // Команда /start
  bot.command('start', async (ctx: Context) => {
    logger.info('Command /start received', { userId: ctx.from?.id, chatId: ctx.chat?.id });
    try {
      await startCommand(ctx);
    } catch (error) {
      logger.error('Error in /start command:', error);
      try {
        await ctx.reply('Произошла ошибка при выполнении команды.');
      } catch (e) {
        // Игнорируем ошибки отправки
      }
    }
  });

  // Команда /link_rentprog
  bot.command('link_rentprog', async (ctx: Context) => {
    logger.info('Command /link_rentprog received', { userId: ctx.from?.id, chatId: ctx.chat?.id });
    try {
      await linkRentprogCommand(ctx);
    } catch (error) {
      logger.error('Error in /link_rentprog command:', error);
      try {
        await ctx.reply('Произошла ошибка при выполнении команды.');
      } catch (e) {
        // Игнорируем ошибки отправки
      }
    }
  });

  // Команда /myinfo
  bot.command('myinfo', async (ctx: Context) => {
    logger.info('Command /myinfo received', { userId: ctx.from?.id, chatId: ctx.chat?.id });
    try {
      await myinfoCommand(ctx);
    } catch (error) {
      logger.error('Error in /myinfo command:', error);
      try {
        await ctx.reply('Произошла ошибка при выполнении команды.');
      } catch (e) {
        // Игнорируем ошибки отправки
      }
    }
  });

  // Команда /help
  bot.command('help', async (ctx: Context) => {
    logger.info('Command /help received', { userId: ctx.from?.id, chatId: ctx.chat?.id });
    try {
      await ctx.reply(
        '📋 Доступные команды:\n\n' +
        '**Личные:**\n' +
        '/start - Регистрация в системе\n' +
        '/myinfo - Информация о вас\n' +
        '/link_rentprog <ID> - Связать с RentProg аккаунтом\n\n' +
        '**Система:**\n' +
        '/help - Показать это сообщение\n' +
        '/status - Проверить статус системы\n' +
        '/sync_rentprog - Первичная синхронизация RentProg\n\n' +
        '💡 Система находится в режиме разработки (MVP).'
      );
    } catch (error) {
      logger.error('Error in /help command:', error);
      try {
        await ctx.reply('Произошла ошибка при выполнении команды.');
      } catch (e) {
        // Игнорируем ошибки отправки
      }
    }
  });

  // Команда /status
  bot.command('status', async (ctx: Context) => {
    logger.info('Command /status received', { userId: ctx.from?.id, chatId: ctx.chat?.id });
    try {
      await ctx.reply('🔍 Проверяю статус системы...');
      
      const dbStatus = await checkDatabaseHealth();
      const rentprogHealth = await healthCheck();
      const umnicoStatus = await checkUmnicoHealth();
      const stripeStatus = await checkStripeHealth();

      const statusEmoji = (ok: boolean) => ok ? '✅' : '❌';
      
      // Формируем строку статуса RentProg per-branch
      const branches: BranchName[] = ['tbilisi', 'batumi', 'kutaisi', 'service-center'];
      const rentprogStatusLines = branches.map(branch => {
        const branchStatus = rentprogHealth.perBranch[branch];
        const emoji = statusEmoji(branchStatus.ok);
        const error = branchStatus.error ? ` (${branchStatus.error.substring(0, 30)})` : '';
        return `${emoji} RentProg ${branch}${error}`;
      });

      // Получаем последние времена синхронизации
      const syncTimes: string[] = [];
      for (const branch of branches) {
        try {
          const lastSync = await getLastSyncTime(branch);
          if (lastSync) {
            const timeAgo = Math.floor((Date.now() - lastSync.getTime()) / 1000 / 60); // минуты назад
            syncTimes.push(`   ${branch}: ${timeAgo} мин назад`);
          } else {
            syncTimes.push(`   ${branch}: никогда`);
          }
        } catch (error) {
          logger.error(`Error getting sync time for ${branch}:`, error);
          syncTimes.push(`   ${branch}: ошибка`);
        }
      }

      await ctx.reply(
        '📊 Статус системы:\n\n' +
        `${statusEmoji(dbStatus)} База данных\n` +
        rentprogStatusLines.join('\n') + '\n' +
        `${statusEmoji(umnicoStatus)} Umnico API\n` +
        `${statusEmoji(stripeStatus)} Stripe API\n\n` +
        '⏰ Last RP sync per branch:\n' +
        syncTimes.join('\n') + '\n\n' +
        `⏰ Время: ${new Date().toLocaleString('ru-RU')}`
      );
    } catch (error) {
      logger.error('Error in /status command:', error);
      try {
        await ctx.reply('❌ Произошла ошибка при проверке статуса системы.');
      } catch (e) {
        // Игнорируем ошибки отправки
      }
    }
  });
  
  // Команда /sync_rentprog
  bot.command('sync_rentprog', async (ctx: Context) => {
    logger.info('Command /sync_rentprog received', { userId: ctx.from?.id, chatId: ctx.chat?.id });
    try {
      await ctx.reply('🔄 Начинаю синхронизацию RentProg...');
    
    const branches: BranchName[] = ['tbilisi', 'batumi', 'kutaisi', 'service-center'];
    const pollSinceDays = config.rentprogPollSinceDays || 14;
    const sinceDate = new Date();
    sinceDate.setDate(sinceDate.getDate() - pollSinceDays);
    
    const summary: Array<{
      branch: BranchName;
      cars: { created: number; updated: number };
      clients: { created: number; updated: number };
      bookings: { created: number; updated: number };
      error?: string;
    }> = [];
    
    for (const branch of branches) {
      try {
        await ctx.reply(`📥 Синхронизация филиала ${branch}...`);
        
        const branchSummary = {
          branch,
          cars: { created: 0, updated: 0 },
          clients: { created: 0, updated: 0 },
          bookings: { created: 0, updated: 0 },
        };

        // Загружаем и upsert автомобили
        const cars = await paginate<any>(branch, '/all_cars_full');
        logger.info(`[${branch}] Загружено автомобилей: ${cars.length}`);
        
        let carCount = 0;
        for (let i = 0; i < cars.length; i++) {
          try {
            const result = await upsertCarFromRentProg(cars[i], branch);
            if (result.created) {
              branchSummary.cars.created++;
            } else {
              branchSummary.cars.updated++;
            }
            carCount++;
            
            // Отправка прогресса в n8n каждые 20 записей или в конце
            if (carCount % 20 === 0 || i === cars.length - 1) {
              await sendSyncProgressToN8n({
                ts: new Date().toISOString(),
                branch,
                entity: 'car',
                page: Math.floor(carCount / 20),
                added: branchSummary.cars.created,
                updated: branchSummary.cars.updated,
                ok: true,
              });
            }
          } catch (error) {
            logger.error(`Error upserting car ${(cars[i] as any).id}:`, error);
          }
        }

        // Загружаем и upsert клиентов
        const clients = await paginate<any>(branch, '/clients');
        logger.info(`[${branch}] Загружено клиентов: ${clients.length}`);
        
        let clientCount = 0;
        for (let i = 0; i < clients.length; i++) {
          try {
            const result = await upsertClientFromRentProg(clients[i], branch);
            if (result.created) {
              branchSummary.clients.created++;
            } else {
              branchSummary.clients.updated++;
            }
            clientCount++;
            
            // Отправка прогресса в n8n каждые 20 записей или в конце
            if (clientCount % 20 === 0 || i === clients.length - 1) {
              await sendSyncProgressToN8n({
                ts: new Date().toISOString(),
                branch,
                entity: 'client',
                page: Math.floor(clientCount / 20),
                added: branchSummary.clients.created,
                updated: branchSummary.clients.updated,
                ok: true,
              });
            }
          } catch (error) {
            logger.error(`Error upserting client ${(clients[i] as any).id}:`, error);
          }
        }

        // Загружаем и upsert бронирования (за последние pollSinceDays дней)
        const bookings = await paginate<any>(branch, '/all_bookings', {
          updated_at: sinceDate.toISOString(),
        });
        logger.info(`[${branch}] Загружено бронирований: ${bookings.length}`);
        
        let bookingCount = 0;
        for (let i = 0; i < bookings.length; i++) {
          try {
            const result = await upsertBookingFromRentProg(bookings[i], branch);
            if (result.created) {
              branchSummary.bookings.created++;
            } else {
              branchSummary.bookings.updated++;
            }
            bookingCount++;
            
            // Отправка прогресса в n8n каждые 20 записей или в конце
            if (bookingCount % 20 === 0 || i === bookings.length - 1) {
              await sendSyncProgressToN8n({
                ts: new Date().toISOString(),
                branch,
                entity: 'booking',
                page: Math.floor(bookingCount / 20),
                added: branchSummary.bookings.created,
                updated: branchSummary.bookings.updated,
                ok: true,
              });
            }
          } catch (error) {
            logger.error(`Error upserting booking ${(bookings[i] as any).id}:`, error);
          }
        }

        summary.push(branchSummary);
        
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        logger.error(`[${branch}] Ошибка синхронизации:`, errorMsg);
        summary.push({
          branch,
          cars: { created: 0, updated: 0 },
          clients: { created: 0, updated: 0 },
          bookings: { created: 0, updated: 0 },
          error: errorMsg.substring(0, 50),
        });
      }
    }
    
    // Формируем детальную сводку
    const summaryLines = summary.map((s) => {
      if (s.error) {
        return `❌ ${s.branch}: ${s.error}`;
      }
      return `✅ ${s.branch}:\n   Авто: +${s.cars.created}/~${s.cars.updated}\n   Клиенты: +${s.clients.created}/~${s.clients.updated}\n   Брони: +${s.bookings.created}/~${s.bookings.updated}`;
    });

    await ctx.reply(
      '📊 Результаты синхронизации:\n\n' + summaryLines.join('\n\n')
    );
    } catch (error) {
      logger.error('Error in /sync_rentprog command:', error);
      try {
        await ctx.reply('❌ Произошла ошибка при синхронизации RentProg.');
      } catch (e) {
        // Игнорируем ошибки отправки
      }
    }
  });

  // Обработка текстовых сообщений (эхо для MVP)
  bot.on('text', async (ctx) => {
    const text = 'text' in ctx.message ? ctx.message.text : '';
    logger.info('Text message received', { 
      userId: ctx.from?.id, 
      chatId: ctx.chat?.id,
      text,
      isCommand: text.startsWith('/')
    });
    
    // Игнорируем команды (они обрабатываются отдельно через bot.command())
    if (text.startsWith('/')) {
      logger.debug('Text handler: ignoring command, should be handled by command handler');
      return;
    }
    
    // В MVP просто возвращаем эхо
    try {
      await ctx.reply(`Получено: ${text}\n\n(В MVP режиме бот просто повторяет сообщения)`);
    } catch (error) {
      logger.error('Error replying to text message:', error);
    }
  });

  // Обработка ошибок
  bot.catch((err, ctx) => {
    logger.error('Bot error:', err);
    ctx.reply('Произошла ошибка. Попробуйте позже.').catch(() => {
      // Игнорируем ошибки отправки
    });
  });

  logger.info('Bot initialized');
  return bot;
}

/**
 * Запуск бота
 */
export async function startBot(): Promise<void> {
  if (!bot) {
    bot = initBot();
  }

  try {
    // ВАЖНО: Удаляем webhook перед запуском polling
    // Это нужно если бот был настроен на webhook (например, через n8n)
    try {
      await bot.telegram.deleteWebhook({ drop_pending_updates: true });
      logger.info('✅ Webhook удален, переходим на polling режим');
    } catch (error) {
      logger.debug('Webhook не был установлен или уже удален');
    }

    await (bot.launch as any)({
      polling: {
        dropPendingUpdates: true,
      },
    });
    logger.info('🤖 Bot started (polling mode)');
    
    // Выводим информацию о боте
    try {
      const me = await bot.telegram.getMe();
      logger.info(`📱 Bot @${me.username} connected (ID: ${me.id})`);
    } catch (error) {
      logger.warn('Не удалось получить информацию о боте:', error);
    }
  } catch (error) {
    logger.error('Failed to launch bot:', error);
    throw error;
  }
  
  // Выводим URL вебхука в логи
  const webhookUrl = 'https://webhook.rentflow.rentals/';
  
  logger.info('🔗 RentProg Webhook URL (для настройки в RentProg UI):');
  logger.info('   ⚠️  Используйте один адрес для всех филиалов:');
  logger.info(`  ${webhookUrl}`);

  // Graceful shutdown
  process.once('SIGINT', () => {
    logger.info('SIGINT received, shutting down bot...');
    bot?.stop('SIGINT');
    process.exit(0);
  });

  process.once('SIGTERM', () => {
    logger.info('SIGTERM received, shutting down bot...');
    bot?.stop('SIGTERM');
    process.exit(0);
  });
}

/**
 * Остановка бота
 */
export async function stopBot(): Promise<void> {
  if (bot) {
    await bot.stop();
    logger.info('Bot stopped');
  }
}

/**
 * Получить экземпляр бота
 */
export function getBot(): Telegraf {
  if (!bot) {
    throw new Error('Бот не инициализирован');
  }
  return bot;
}

