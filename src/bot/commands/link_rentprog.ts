/**
 * Команда /link_rentprog - связывание Telegram аккаунта с RentProg ID
 * 
 * Использование: /link_rentprog 14714
 * 
 * Архитектура: использует external_refs для связи с RentProg
 */

import { Context } from 'telegraf';
import { getDatabase } from '../../db/index.js';
import { employees, externalRefs } from '../../db/schema.js';
import { eq, and } from 'drizzle-orm';

export async function linkRentprogCommand(ctx: Context) {
  // Type guard для проверки наличия text
  if (!ctx.message || !('text' in ctx.message)) {
    await ctx.reply('❌ Команда должна быть текстовым сообщением');
    return;
  }
  
  const db = getDatabase();
  const args = ctx.message.text.split(' ');
  const rentprogId = args[1];
  const tgUserId = ctx.from?.id;

  if (!tgUserId) {
    await ctx.reply('❌ Не удалось определить ваш Telegram ID');
    return;
  }

  // Проверка аргумента
  if (!rentprogId || rentprogId.trim() === '') {
    await ctx.reply(
      '❌ Укажите ваш RentProg ID\n\n' +
      'Использование:\n' +
      '/link_rentprog 14714\n\n' +
      '💡 Ваш RentProg ID можно найти в настройках вашего профиля или спросить у администратора.'
    );
    return;
  }

  try {
    // 1. Проверить что пользователь зарегистрирован в Jarvis
    const [employee] = await db
      .select()
      .from(employees)
      .where(eq(employees.tg_user_id, tgUserId))
      .limit(1);

    if (!employee) {
      await ctx.reply(
        '❌ Вы не зарегистрированы в системе Jarvis\n\n' +
        'Сначала зарегистрируйтесь командой:\n' +
        '/start'
      );
      return;
    }

    // 2. Проверить что RentProg сотрудник существует в external_refs
    const [rentprogRef] = await db
      .select()
      .from(externalRefs)
      .where(
        and(
          eq(externalRefs.system, 'rentprog'),
          eq(externalRefs.entity_type, 'employee'),
          eq(externalRefs.external_id, rentprogId)
        )
      )
      .limit(1);

    if (!rentprogRef) {
      await ctx.reply(
        `❌ Сотрудник с RentProg ID ${rentprogId} не найден в системе\n\n` +
        'Возможные причины:\n' +
        '• Вас ещё не упоминали в бронях\n' +
        '• Неверный ID\n' +
        '• Система ещё не синхронизировалась\n\n' +
        '💡 Попробуйте позже или обратитесь к администратору'
      );
      return;
    }

    const rentprogName = (rentprogRef.data as any)?.name || 'Неизвестно';

    // 3. Проверить не связан ли уже с другим сотрудником
    if (rentprogRef.entity_id) {
      const [linkedEmployee] = await db
        .select()
        .from(employees)
        .where(eq(employees.id, rentprogRef.entity_id))
        .limit(1);

      if (linkedEmployee) {
        if (linkedEmployee.tg_user_id === tgUserId) {
          await ctx.reply(
            '✅ Вы уже связаны с этим RentProg аккаунтом!\n\n' +
            `👤 Jarvis: ${employee.name}\n` +
            `🔗 RentProg: ${rentprogName} (ID: ${rentprogId})\n\n` +
            'Используйте /myinfo для просмотра информации'
          );
          return;
        } else {
          await ctx.reply(
            `⚠️ Этот RentProg ID уже связан с другим сотрудником: ${linkedEmployee.name}\n\n` +
            'Если это ошибка, обратитесь к администратору'
          );
          return;
        }
      }
    }

    // 4. Проверить не связан ли текущий сотрудник с другим RentProg ID
    const [existingLink] = await db
      .select()
      .from(externalRefs)
      .where(
        and(
          eq(externalRefs.system, 'rentprog'),
          eq(externalRefs.entity_type, 'employee'),
          eq(externalRefs.entity_id, employee.id)
        )
      )
      .limit(1);

    if (existingLink && existingLink.external_id !== rentprogId) {
      const existingName = (existingLink.data as any)?.name || 'Неизвестно';
      await ctx.reply(
        `⚠️ Вы уже связаны с другим RentProg аккаунтом:\n` +
        `ID: ${existingLink.external_id}\n` +
        `Имя: ${existingName}\n\n` +
        'Если это ошибка, обратитесь к администратору'
      );
      return;
    }

    // 5. Создать связь (обновить entity_id в external_refs)
    await db
      .update(externalRefs)
      .set({
        entity_id: employee.id,
        updated_at: new Date(),
      })
      .where(eq(externalRefs.id, rentprogRef.id));

    // 6. Подтверждение
    await ctx.reply(
      '✅ Успешно связано!\n\n' +
      `👤 Jarvis: ${employee.name}\n` +
      `🔗 RentProg: ${rentprogName} (ID: ${rentprogId})\n\n` +
      '🎉 Теперь вы будете получать:\n' +
      '• Уведомления о ваших бронях\n' +
      '• Напоминания о задачах\n' +
      '• Персонализированные алерты\n\n' +
      'Используйте /myinfo для просмотра информации'
    );

    // Логирование
    console.log(`✅ Linked: employee ${employee.id} (${employee.name}) → rentprog ${rentprogId}`);

  } catch (error) {
    console.error('Error in linkRentprogCommand:', error);
    await ctx.reply(
      '❌ Произошла ошибка при связывании\n\n' +
      'Попробуйте позже или обратитесь к администратору'
    );
  }
}


