/**
 * Интеграция с Stripe API
 * Заглушки для MVP
 */

import { config } from '../config/index.js';
import { logger } from '../utils/logger';

/**
 * Создание payment link в Stripe
 * @param amount - Сумма в копейках/центах
 * @param currency - Валюта (GEL, USD, EUR)
 * @param description - Описание платежа
 * @param metadata - Метаданные (bookingId, clientId и т.д.)
 * @returns URL для оплаты
 */
export async function createPaymentLink(params: {
  amount: number;
  currency: string;
  description: string;
  metadata?: Record<string, string>;
}): Promise<string> {
  logger.debug('createPaymentLink called', params);
  // TODO: Реализовать создание payment link через Stripe API
  // const stripe = new Stripe(config.stripeApiKey);
  // const session = await stripe.checkout.sessions.create({...});
  // return session.url;
  
  // В MVP возвращаем заглушку
  return `https://stripe.com/payment/stub_${Date.now()}`;
}

/**
 * Проверка доступности API Stripe
 */
export async function checkStripeHealth(): Promise<boolean> {
  if (!config.stripeApiKey) {
    return false;
  }
  // TODO: Реализовать реальную проверку
  return true;
}

