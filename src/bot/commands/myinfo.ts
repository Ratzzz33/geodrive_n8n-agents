/**
 * Команда /myinfo - информация о текущем пользователе
 * 
 * Показывает:
 * - Данные из Jarvis (employees)
 * - Связь с RentProg (через external_refs)
 * - Статистику (брони, задачи)
 */

import { Context } from 'telegraf';
import { getDatabase } from '../../db/index.js';
import { employees, externalRefs, bookings } from '../../db/schema.js';
import { eq, and, count } from 'drizzle-orm';

export async function myinfoCommand(ctx: Context) {
  const tgUserId = ctx.from?.id;

  if (!tgUserId) {
    await ctx.reply('❌ Не удалось определить ваш Telegram ID');
    return;
  }

  try {
    const db = getDatabase();

    // 1. Получить данные сотрудника
    const [employee] = await db
      .select()
      .from(employees)
      .where(eq(employees.tg_user_id, tgUserId))
      .limit(1);

    if (!employee) {
      await ctx.reply(
        '❌ Вы не зарегистрированы в системе Jarvis\n\n' +
        'Зарегистрируйтесь командой:\n' +
        '/start'
      );
      return;
    }

    // 2. Получить связь с RentProg
    const [rentprogRef] = await db
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

    // 3. Получить статистику броней (если есть связь)
    let bookingsCount = 0;
    if (rentprogRef) {
      const result = await db
        .select({ count: count() })
        .from(bookings)
        .where(
          // Проверяем поля issue_employee_id или return_employee_id
          // TODO: добавить когда будут эти поля в schema
        );
      // bookingsCount = result[0]?.count || 0;
    }

    // 4. Формирование ответа
    let message = '👤 **Информация о вас**\n\n';

    // Jarvis данные
    message += `**Jarvis:**\n`;
    message += `• ID: \`${employee.id}\`\n`;
    message += `• Имя: ${employee.name}\n`;
    message += `• Telegram ID: \`${tgUserId}\`\n`;
    message += `• Роль: ${employee.role || 'не указана'}\n`;
    if (employee.branch_id) {
      message += `• Филиал ID: \`${employee.branch_id}\`\n`;
    }
    message += `• Зарегистрирован: ${employee.created_at?.toLocaleDateString('ru-RU') || 'н/д'}\n`;

    message += '\n';

    // RentProg связь
    if (rentprogRef) {
      const rentprogName = (rentprogRef.data as any)?.name || 'Неизвестно';
      message += `**RentProg:**\n`;
      message += `• ✅ Связан\n`;
      message += `• ID: \`${rentprogRef.external_id}\`\n`;
      message += `• Имя: ${rentprogName}\n`;
      
      // TODO: добавить статистику когда будут данные
      // if (bookingsCount > 0) {
      //   message += `• Броней: ${bookingsCount}\n`;
      // }
    } else {
      message += `**RentProg:**\n`;
      message += `• ❌ Не связан\n`;
      message += `• Используйте /link_rentprog для связи\n`;
    }

    message += '\n';
    message += '**Доступные команды:**\n';
    message += '• /myinfo - эта информация\n';
    if (!rentprogRef) {
      message += '• /link_rentprog <ID> - связать с RentProg\n';
    }
    message += '• /help - помощь\n';

    await ctx.reply(message, { parse_mode: 'Markdown' });

  } catch (error) {
    console.error('Error in myinfoCommand:', error);
    await ctx.reply(
      '❌ Произошла ошибка при получении информации\n\n' +
      'Попробуйте позже'
    );
  }
}

