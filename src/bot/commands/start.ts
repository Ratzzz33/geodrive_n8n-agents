/**
 * Команда /start - регистрация нового пользователя
 * 
 * Создает запись в таблице employees
 */

import { Context } from 'telegraf';
import { getDatabase } from '../../db/index.js';
import { employees } from '../../db/schema.js';
import { eq } from 'drizzle-orm';

export async function startCommand(ctx: Context) {
  const tgUserId = ctx.from?.id;
  const username = ctx.from?.username;
  const firstName = ctx.from?.first_name;
  const lastName = ctx.from?.last_name;

  if (!tgUserId) {
    await ctx.reply('❌ Не удалось определить ваш Telegram ID');
    return;
  }

  try {
    const db = getDatabase();

    // Проверить существует ли уже пользователь
    const [existing] = await db
      .select()
      .from(employees)
      .where(eq(employees.tg_user_id, tgUserId))
      .limit(1);

    if (existing) {
      await ctx.reply(
        '✅ Вы уже зарегистрированы!\n\n' +
        `👤 ${existing.name}\n\n` +
        'Используйте:\n' +
        '• /myinfo - информация о вас\n' +
        '• /link_rentprog <ID> - связать с RentProg\n' +
        '• /help - список команд'
      );
      return;
    }

    // Формируем имя из Telegram данных
    const name = [firstName, lastName].filter(Boolean).join(' ') || username || `User_${tgUserId}`;

    // Создать нового сотрудника
    const [newEmployee] = await db
      .insert(employees)
      .values({
        name,
        tg_user_id: tgUserId,
        tg_username: username,
        role: 'employee', // дефолтная роль
        created_at: new Date(),
        updated_at: new Date(),
      })
      .returning();

    await ctx.reply(
      '🎉 Добро пожаловать в систему Jarvis!\n\n' +
      `👤 Зарегистрированы как: ${newEmployee.name}\n` +
      `🆔 Ваш ID: \`${newEmployee.id}\`\n\n` +
      '**Следующие шаги:**\n' +
      '1️⃣ Свяжите ваш аккаунт с RentProg:\n' +
      '   `/link_rentprog <ваш_RentProg_ID>`\n\n' +
      '2️⃣ Проверьте информацию:\n' +
      '   `/myinfo`\n\n' +
      '💡 Используйте /help для списка команд',
      { parse_mode: 'Markdown' }
    );

    console.log(`✅ New employee registered: ${newEmployee.id} (${newEmployee.name})`);

  } catch (error) {
    console.error('Error in startCommand:', error);
    await ctx.reply(
      '❌ Произошла ошибка при регистрации\n\n' +
      'Попробуйте позже или обратитесь к администратору'
    );
  }
}

