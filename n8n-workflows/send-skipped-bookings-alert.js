// ✅ КОД для новой ноды "Check Skipped Bookings"
//
// Тип: Code Node (JavaScript)
// Позиция: После "Process All Bookings", перед "Save to DB"
// 
// Проверяет наличие пропущенных броней и формирует алерт

const items = $input.all();

// Проверяем первый item на наличие информации о пропущенных бронях
const firstItem = items[0]?.json;
const skippedCount = firstItem?._skipped_count || 0;
const skippedBookings = firstItem?._skipped_bookings || [];

if (skippedCount === 0) {
  // Нет пропущенных броней - просто передаем данные дальше
  return items;
}

// ⚠️ Есть пропущенные брони - формируем алерт
console.warn(`⚠️ Found ${skippedCount} bookings without number field!`);

// Формируем сообщение для Telegram
let alertMessage = `⚠️ <b>ВНИМАНИЕ: Брони без номера!</b>\n\n`;
alertMessage += `Обнаружено <b>${skippedCount}</b> брон${skippedCount === 1 ? 'ь' : 'и/ей'} без поля number.\n`;
alertMessage += `Эти брони <b>НЕ СОХРАНЕНЫ</b> в БД.\n\n`;

// Показываем до 5 примеров
const samplesToShow = Math.min(5, skippedBookings.length);
alertMessage += `<b>Примеры (${samplesToShow} из ${skippedCount}):</b>\n\n`;

for (let i = 0; i < samplesToShow; i++) {
  const booking = skippedBookings[i];
  alertMessage += `${i + 1}. RentProg ID: <code>${booking.rentprog_id}</code>\n`;
  alertMessage += `   Филиал: ${booking.branch}\n`;
  alertMessage += `   Клиент: ${booking.client_name}\n`;
  alertMessage += `   Авто: ${booking.car_name}\n`;
  alertMessage += `   Причина: ${booking.reason}\n\n`;
}

if (skippedCount > samplesToShow) {
  alertMessage += `<i>... и еще ${skippedCount - samplesToShow}</i>\n\n`;
}

alertMessage += `\n<b>Действия:</b>\n`;
alertMessage += `1. Проверить RentProg API\n`;
alertMessage += `2. Убедиться что поле number заполнено\n`;
alertMessage += `3. Переобработать эти брони вручную\n`;

// Добавляем алерт как отдельный item для отправки в Telegram
const alertItem = {
  json: {
    alert_type: 'skipped_bookings',
    severity: 'warning',
    count: skippedCount,
    message: alertMessage,
    skipped_bookings: skippedBookings,
    timestamp: new Date().toISOString(),
  },
};

// Возвращаем и данные для сохранения, и алерт
// Алерт будет в последнем item
return [...items, alertItem];

