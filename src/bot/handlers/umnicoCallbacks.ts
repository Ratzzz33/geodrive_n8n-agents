/**
 * Обработчики callback кнопок для Umnico диалогов
 */

import { Context } from 'telegraf';
import { logger } from '../../utils/logger.js';
import { UmnicoTelegramBridge } from '../../services/umnicoTelegramBridge.js';

const bridge = new UmnicoTelegramBridge();

/**
 * Обработчик закрытия диалога
 */
export async function handleCloseDialog(ctx: Context, conversationId: string): Promise<void> {
  try {
    await ctx.answerCbQuery('Закрываю диалог...');
    
    await bridge.closeSession(conversationId);
    
    await ctx.editMessageText(
      '✅ Диалог закрыт',
      { reply_markup: undefined }
    ).catch(() => {
      // Игнорируем ошибки редактирования (сообщение может быть уже удалено)
    });
    
    logger.info(`Dialog ${conversationId} closed by user ${ctx.from?.id}`);
  } catch (error) {
    logger.error(`Failed to close dialog ${conversationId}:`, error);
    await ctx.answerCbQuery('Ошибка при закрытии диалога').catch(() => {});
  }
}

/**
 * Обработчик продления сессии
 */
export async function handleExtendDialog(ctx: Context, conversationId: string): Promise<void> {
  try {
    await ctx.answerCbQuery('Продлеваю сессию...');
    
    await bridge.extendSession(conversationId);
    
    await ctx.answerCbQuery('✅ Сессия продлена на 1 час');
    
    logger.info(`Dialog ${conversationId} extended by user ${ctx.from?.id}`);
  } catch (error) {
    logger.error(`Failed to extend dialog ${conversationId}:`, error);
    await ctx.answerCbQuery('Ошибка при продлении сессии').catch(() => {});
  }
}

