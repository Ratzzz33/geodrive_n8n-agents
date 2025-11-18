#!/usr/bin/env node
/**
 * Обновление данных AmoCRM с момента последней синхронизации
 * 
 * Использует Playwright Service (логин/пароль) или AmoCRM API v4 (Access Token)
 * Получает все обновленные сделки/контакты с последней даты обновления в БД
 */

import postgres from 'postgres';
import dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL ||
  'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

// Настройки: Playwright Service (приоритет) или прямой API
const PLAYWRIGHT_SERVICE_URL = process.env.AMOCRM_PLAYWRIGHT_URL || 'http://localhost:3002';
const AMOCRM_ACCESS_TOKEN = process.env.AMOCRM_ACCESS_TOKEN;
const AMOCRM_SUBDOMAIN = process.env.AMOCRM_SUBDOMAIN || 'geodrive';
const AMOCRM_BASE_URL = `https://${AMOCRM_SUBDOMAIN}.amocrm.ru/api/v4`;

// Режим работы: 'playwright' (логин/пароль) или 'api' (Access Token)
const USE_PLAYWRIGHT = !AMOCRM_ACCESS_TOKEN || process.env.AMOCRM_USE_PLAYWRIGHT === 'true';

const sql = postgres(DATABASE_URL, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

/**
 * Получить последнюю дату обновления из БД
 */
async function getLastSyncDate() {
  try {
    const result = await sql`
      SELECT MAX(updated_at) as last_sync
      FROM amocrm_deals
    `;
    
    if (result[0]?.last_sync) {
      // Конвертируем в Unix timestamp (секунды) для AmoCRM API
      const date = new Date(result[0].last_sync);
      return Math.floor(date.getTime() / 1000);
    }
    
    // Если нет данных, берем последние 7 дней
    const sevenDaysAgo = Math.floor((Date.now() - 7 * 24 * 60 * 60 * 1000) / 1000);
    console.log('⚠️  Нет данных в БД, берем последние 7 дней');
    return sevenDaysAgo;
  } catch (error) {
    console.error('❌ Ошибка при получении последней даты:', error);
    // Fallback: последние 7 дней
    return Math.floor((Date.now() - 7 * 24 * 60 * 60 * 1000) / 1000);
  }
}

/**
 * Проверить доступность Playwright Service
 */
async function checkPlaywrightService() {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch(`${PLAYWRIGHT_SERVICE_URL}/health`, {
      method: 'GET',
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    return response.ok;
  } catch (error) {
    return false;
  }
}

/**
 * Получить сделки через Playwright Service (логин/пароль)
 */
async function getDealsViaPlaywright(updatedSince, page = 1) {
  // Используем /api/deals/all для получения всех сделок с пагинацией
  const url = new URL(`${PLAYWRIGHT_SERVICE_URL}/api/deals/all`);
  url.searchParams.set('limit', '250');
  url.searchParams.set('pipeline_id', '8580102');
  
  if (updatedSince) {
    // Playwright Service ожидает Unix timestamp в секундах
    url.searchParams.set('updated_since', updatedSince.toString());
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000); // 2 минуты для большого объема
    
    const response = await fetch(url.toString(), {
      method: 'GET',
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Playwright Service error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    
    if (!data.ok) {
      throw new Error(data.error || 'Unknown error from Playwright Service');
    }
    
    // /api/deals/all возвращает все сделки сразу, без пагинации
    // Но мы можем обрабатывать их порциями
    const allDeals = data.deals || [];
    const pageSize = 250;
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const pageDeals = allDeals.slice(startIndex, endIndex);
    
    return {
      deals: pageDeals,
      total: pageDeals.length,
      hasMore: endIndex < allDeals.length
    };
  } catch (error) {
    console.error(`❌ Ошибка при получении сделок через Playwright (страница ${page}):`, error.message);
    throw error;
  }
}

/**
 * Получить сделки через AmoCRM API v4 (Access Token)
 */
async function getDealsViaAPI(updatedSince, page = 1) {
  const url = new URL(`${AMOCRM_BASE_URL}/leads`);
  url.searchParams.set('limit', '250');
  url.searchParams.set('page', page.toString());
  url.searchParams.set('with', 'contacts,companies');
  
  if (updatedSince) {
    // AmoCRM API ожидает Unix timestamp в секундах
    url.searchParams.set('filter[updated_at][from]', updatedSince.toString());
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);
    
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${AMOCRM_ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      },
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    
    return {
      deals: data._embedded?.leads || [],
      total: data._embedded?.leads?.length || 0,
      hasMore: data._embedded?.leads?.length === 250
    };
  } catch (error) {
    console.error(`❌ Ошибка при получении сделок через API (страница ${page}):`, error.message);
    throw error;
  }
}

/**
 * Получить сделки (автоматический выбор метода)
 */
async function getDeals(updatedSince, page = 1) {
  if (USE_PLAYWRIGHT) {
    return await getDealsViaPlaywright(updatedSince, page);
  } else {
    return await getDealsViaAPI(updatedSince, page);
  }
}

/**
 * Извлечь данные сделки для сохранения в БД
 */
function extractDealData(deal) {
  // Найти RentProg Booking ID в custom_fields
  let rentprogBookingId = null;
  if (deal.custom_fields_values) {
    const rentprogField = deal.custom_fields_values.find(
      f => f.field_id === 902255 || f.field_name?.toLowerCase().includes('rentprog')
    );
    if (rentprogField) {
      rentprogBookingId = rentprogField.values?.[0]?.value || null;
    }
  }

  // Извлечь контакты
  const contacts = deal._embedded?.contacts || [];
  const contactIds = contacts.map(c => c.id).filter(Boolean);

  // Извлечь custom_fields как JSONB
  const customFields = {};
  if (deal.custom_fields_values) {
    for (const field of deal.custom_fields_values) {
      const fieldName = field.field_name || `field_${field.field_id}`;
      const value = field.values?.[0]?.value || field.values?.[0]?.enum_value || null;
      customFields[fieldName] = value;
    }
  }

  return {
    amocrm_deal_id: String(deal.id),
    pipeline_id: deal.pipeline_id ? String(deal.pipeline_id) : null,
    status_id: deal.status_id ? String(deal.status_id) : null,
    status_label: deal.status_name || null,
    price: deal.price || 0,
    created_at: deal.created_at ? new Date(deal.created_at * 1000) : null,
    closed_at: deal.closed_at ? new Date(deal.closed_at * 1000) : null,
    updated_at: deal.updated_at ? new Date(deal.updated_at * 1000) : new Date(),
    custom_fields: customFields,
    deal_full_data: deal,
    metadata: {
      rentprog_booking_id: rentprogBookingId,
      booking_data_source: 'rentprog_only',
      contact_ids: contactIds,
      updated_via: 'api_sync'
    }
  };
}

/**
 * Сохранить сделку в БД
 */
async function upsertDeal(dealData) {
  try {
    const query = `
      INSERT INTO amocrm_deals (
        amocrm_deal_id,
        pipeline_id,
        status_id,
        status_label,
        price,
        created_at,
        closed_at,
        updated_at,
        custom_fields,
        deal_full_data,
        metadata
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10::jsonb, $11::jsonb
      )
      ON CONFLICT (amocrm_deal_id) 
      DO UPDATE SET
        pipeline_id = EXCLUDED.pipeline_id,
        status_id = EXCLUDED.status_id,
        status_label = EXCLUDED.status_label,
        price = EXCLUDED.price,
        closed_at = EXCLUDED.closed_at,
        updated_at = EXCLUDED.updated_at,
        custom_fields = EXCLUDED.custom_fields,
        deal_full_data = EXCLUDED.deal_full_data,
        metadata = EXCLUDED.metadata
      RETURNING id
    `;

    const result = await sql.unsafe(query, [
      dealData.amocrm_deal_id,
      dealData.pipeline_id,
      dealData.status_id,
      dealData.status_label,
      dealData.price,
      dealData.created_at,
      dealData.closed_at,
      dealData.updated_at,
      JSON.stringify(dealData.custom_fields),
      JSON.stringify(dealData.deal_full_data),
      JSON.stringify(dealData.metadata)
    ]);

    return result[0]?.id;
  } catch (error) {
    console.error(`❌ Ошибка при сохранении сделки ${dealData.amocrm_deal_id}:`, error.message);
    throw error;
  }
}

/**
 * Основная функция
 */
async function main() {
  console.log('\n🔄 Обновление данных AmoCRM с момента последней синхронизации\n');

  // Определяем режим работы
  if (USE_PLAYWRIGHT) {
    console.log('📡 Режим: Playwright Service (логин/пароль)');
    console.log(`   URL: ${PLAYWRIGHT_SERVICE_URL}\n`);
    
    // Проверяем доступность Playwright Service
    const isAvailable = await checkPlaywrightService();
    if (!isAvailable) {
      console.error('❌ Playwright Service недоступен!');
      console.error(`   Проверьте, что сервис запущен на ${PLAYWRIGHT_SERVICE_URL}`);
      console.error('   Или установите AMOCRM_ACCESS_TOKEN для использования прямого API\n');
      process.exit(1);
    }
    console.log('✅ Playwright Service доступен\n');
  } else {
    console.log('📡 Режим: AmoCRM API v4 (Access Token)');
    console.log(`   Base URL: ${AMOCRM_BASE_URL}\n`);
  }

  // Получаем последнюю дату обновления
  const lastSyncTimestamp = await getLastSyncDate();
  const lastSyncDate = new Date(lastSyncTimestamp * 1000);
  console.log(`📅 Последняя синхронизация: ${lastSyncDate.toISOString()}`);
  console.log(`   (Unix timestamp: ${lastSyncTimestamp})\n`);

  let totalProcessed = 0;
  let totalUpdated = 0;
  let totalNew = 0;
  let page = 1;
  let hasMore = true;

  try {
    while (hasMore) {
      console.log(`📄 Страница ${page}...`);
      
      const { deals, hasMore: more } = await getDeals(lastSyncTimestamp, page);
      
      if (deals.length === 0) {
        console.log('   Нет новых сделок на этой странице\n');
        break;
      }

      console.log(`   Получено сделок: ${deals.length}`);

      for (const deal of deals) {
        try {
          const dealData = extractDealData(deal);
          
          // Проверяем, существует ли уже
          const existing = await sql`
            SELECT id FROM amocrm_deals WHERE amocrm_deal_id = ${dealData.amocrm_deal_id}
          `;

          const dealId = await upsertDeal(dealData);
          
          if (existing.length > 0) {
            totalUpdated++;
          } else {
            totalNew++;
          }
          
          totalProcessed++;
          
          if (dealData.metadata.rentprog_booking_id) {
            process.stdout.write(`   ✓ ${dealData.amocrm_deal_id} (RentProg: ${dealData.metadata.rentprog_booking_id})\n`);
          } else {
            process.stdout.write(`   ✓ ${dealData.amocrm_deal_id}\n`);
          }
        } catch (error) {
          console.error(`   ✗ Ошибка обработки сделки ${deal.id}:`, error.message);
        }
      }

      hasMore = more && deals.length === 250;
      page++;
      
      // Небольшая задержка между страницами
      if (hasMore) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    console.log('\n✅ Обновление завершено!');
    console.log(`   Всего обработано: ${totalProcessed}`);
    console.log(`   Новых: ${totalNew}`);
    console.log(`   Обновлено: ${totalUpdated}\n`);

  } catch (error) {
    console.error('\n❌ Критическая ошибка:', error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

main();

