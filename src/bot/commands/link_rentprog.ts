/**
 * Команда /link_rentprog - связывание Telegram аккаунта с RentProg ID
 * 
 * Использование: /link_rentprog 14714
 */

import { Context } from 'telegraf';
import { sql } from '../../db';

export async function linkRentprogCommand(ctx: Context) {
  const args = ctx.message?.text?.split(' ');
  const rentprogId = args?.[1];
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
    const employee = await sql`
      SELECT id, name FROM employees 
      WHERE tg_user_id = ${tgUserId}
    `.then(rows => rows[0]);

    if (!employee) {
      await ctx.reply(
        '❌ Вы не зарегистрированы в системе Jarvis\n\n' +
        'Сначала зарегистрируйтесь командой:\n' +
        '/start'
      );
      return;
    }

    // 2. Проверить что RentProg сотрудник существует
    const rentprogEmployee = await sql`
      SELECT * FROM rentprog_employees 
      WHERE rentprog_id = ${rentprogId}
    `.then(rows => rows[0]);

    if (!rentprogEmployee) {
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

    // 3. Проверить не связан ли уже с другим сотрудником
    if (rentprogEmployee.employee_id) {
      const linkedEmployee = await sql`
        SELECT name, tg_user_id FROM employees 
        WHERE id = ${rentprogEmployee.employee_id}
      `.then(rows => rows[0]);

      if (linkedEmployee.tg_user_id === tgUserId) {
        await ctx.reply(
          '✅ Вы уже связаны с этим RentProg аккаунтом!\n\n' +
          `👤 Jarvis: ${employee.name}\n` +
          `🔗 RentProg: ${rentprogEmployee.name} (ID: ${rentprogId})\n\n` +
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

    // 4. Проверить не связан ли текущий сотрудник с другим RentProg ID
    const existingLink = await sql`
      SELECT rentprog_id, name FROM rentprog_employees
      WHERE employee_id = ${employee.id}
    `.then(rows => rows[0]);

    if (existingLink) {
      await ctx.reply(
        `⚠️ Вы уже связаны с другим RentProg аккаунтом:\n` +
        `ID: ${existingLink.rentprog_id}\n` +
        `Имя: ${existingLink.name}\n\n` +
        'Если это ошибка, обратитесь к администратору'
      );
      return;
    }

    // 5. Создать связь
    await sql`
      UPDATE rentprog_employees
      SET employee_id = ${employee.id},
          updated_at = NOW()
      WHERE rentprog_id = ${rentprogId}
    `;

    // 6. Подтверждение
    await ctx.reply(
      '✅ Успешно связано!\n\n' +
      `👤 Jarvis: ${employee.name}\n` +
      `🔗 RentProg: ${rentprogEmployee.name} (ID: ${rentprogId})\n\n` +
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

