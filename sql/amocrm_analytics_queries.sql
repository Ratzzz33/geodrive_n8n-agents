-- ============================================
-- Аналитические запросы для AmoCRM Big Data
-- Дата: 2025-11-09
-- Назначение: Анализ продаж, клиентов, связей
-- ============================================

-- 1. Полная картина клиента со всеми связями
-- Использование: Получить всю информацию о клиенте из всех систем
SELECT 
  c.id as client_id,
  c.phone,
  c.name,
  c.email,
  
  -- External IDs
  MAX(CASE WHEN er.system = 'amocrm' THEN er.external_id END) as amocrm_contact_id,
  MAX(CASE WHEN er.system = 'rentprog' THEN er.external_id END) as rentprog_client_id,
  MAX(CASE WHEN er.system = 'umnico' THEN er.external_id END) as umnico_phone,
  
  -- Статистика по сделкам
  COUNT(DISTINCT d.id) as total_deals,
  COUNT(DISTINCT CASE WHEN d.status_label = 'successful' THEN d.id END) as successful_deals,
  COUNT(DISTINCT CASE WHEN d.status_label = 'unsuccessful' THEN d.id END) as unsuccessful_deals,
  COUNT(DISTINCT CASE WHEN d.status_label = 'in_progress' THEN d.id END) as active_deals,
  SUM(CASE WHEN d.status_label = 'successful' THEN d.price ELSE 0 END) as total_revenue,
  AVG(CASE WHEN d.status_label = 'successful' THEN d.price END) as avg_deal_price,
  
  -- Статистика по броням
  COUNT(DISTINCT b.id) as total_bookings,
  
  -- Статистика по машинам
  COUNT(DISTINCT car.id) as total_cars_rented,
  STRING_AGG(DISTINCT car.plate, ', ') as cars_plates,
  
  -- Статистика по сообщениям
  COUNT(DISTINCT m.id) as total_messages,
  COUNT(DISTINCT CASE WHEN m.channel = 'whatsapp' THEN m.id END) as whatsapp_messages,
  COUNT(DISTINCT CASE WHEN m.channel = 'amocrm_note' THEN m.id END) as amocrm_notes,
  
  -- Последняя активность
  MAX(d.updated_at) as last_deal_update,
  MAX(m.sent_at) as last_message_at,
  MAX(b.updated_at) as last_booking_update

FROM clients c
LEFT JOIN external_refs er ON c.id = er.entity_id AND er.entity_type = 'client'
LEFT JOIN amocrm_deals d ON c.id = d.client_id
LEFT JOIN bookings b ON c.id = b.client_id
LEFT JOIN cars car ON b.car_id = car.id
LEFT JOIN messages m ON c.id = m.client_id

GROUP BY c.id, c.phone, c.name, c.email
ORDER BY total_revenue DESC NULLS LAST;

-- 2. Анализ успешных vs неуспешных сделок
-- Использование: Понимание конверсии и причин отказов
SELECT 
  status_label,
  COUNT(*) as deals_count,
  AVG(price) as avg_price,
  SUM(price) as total_revenue,
  COUNT(DISTINCT client_id) as unique_clients,
  AVG(notes_count) as avg_notes_per_deal,
  AVG(CASE WHEN closed_at IS NOT NULL AND created_at IS NOT NULL 
    THEN EXTRACT(EPOCH FROM (closed_at - created_at)) / 86400 
    END) as avg_days_to_close,
  MIN(price) as min_price,
  MAX(price) as max_price,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY price) as median_price
FROM amocrm_deals
WHERE status_label IN ('successful', 'unsuccessful')
GROUP BY status_label
ORDER BY status_label;

-- 3. Связь сделок с бронями и машинами
-- Использование: Понимание какие сделки привели к броням
SELECT 
  d.amocrm_deal_id,
  d.status_label,
  d.price,
  d.custom_fields->>'rentprog_booking_id' as rentprog_booking_id,
  d.metadata->>'booking_id' as booking_uuid,
  d.metadata->>'car_id' as car_uuid,
  d.metadata->>'rentprog_car_id' as rentprog_car_id,
  b.status as booking_status,
  b.start_at as booking_start,
  b.end_at as booking_end,
  car.plate as car_plate,
  car.model as car_model,
  c.phone as client_phone,
  c.name as client_name
FROM amocrm_deals d
LEFT JOIN bookings b ON b.id::text = d.metadata->>'booking_id'
LEFT JOIN cars car ON car.id::text = d.metadata->>'car_id'
LEFT JOIN clients c ON c.id = d.client_id
WHERE d.custom_fields->>'rentprog_booking_id' IS NOT NULL
ORDER BY d.updated_at DESC;

-- 4. Топ клиентов по выручке
-- Использование: Выявление VIP клиентов
SELECT 
  c.id,
  c.phone,
  c.name,
  COUNT(DISTINCT d.id) as total_deals,
  COUNT(DISTINCT CASE WHEN d.status_label = 'successful' THEN d.id END) as successful_deals,
  SUM(CASE WHEN d.status_label = 'successful' THEN d.price ELSE 0 END) as total_revenue,
  AVG(CASE WHEN d.status_label = 'successful' THEN d.price END) as avg_deal_price,
  COUNT(DISTINCT b.id) as total_bookings,
  MAX(d.updated_at) as last_deal_date
FROM clients c
INNER JOIN amocrm_deals d ON c.id = d.client_id
LEFT JOIN bookings b ON c.id = b.client_id
WHERE d.status_label = 'successful'
GROUP BY c.id, c.phone, c.name
HAVING SUM(CASE WHEN d.status_label = 'successful' THEN d.price ELSE 0 END) > 0
ORDER BY total_revenue DESC
LIMIT 50;

-- 5. Анализ по статусам воронки
-- Использование: Понимание где теряются клиенты
SELECT 
  d.status_id,
  d.status_label,
  COUNT(*) as deals_count,
  COUNT(DISTINCT d.client_id) as unique_clients,
  AVG(d.price) as avg_price,
  SUM(d.price) as total_value,
  AVG(d.notes_count) as avg_notes,
  AVG(CASE WHEN d.closed_at IS NOT NULL 
    THEN EXTRACT(EPOCH FROM (d.closed_at - d.created_at)) / 86400 
    END) as avg_days_in_status
FROM amocrm_deals d
GROUP BY d.status_id, d.status_label
ORDER BY deals_count DESC;

-- 6. Клиенты с активными сделками и бронями
-- Использование: Понимание текущей активности
SELECT 
  c.id,
  c.phone,
  c.name,
  COUNT(DISTINCT d.id) as active_deals,
  COUNT(DISTINCT b.id) as active_bookings,
  STRING_AGG(DISTINCT d.amocrm_deal_id, ', ') as deal_ids,
  MAX(d.updated_at) as last_deal_update,
  MAX(b.updated_at) as last_booking_update
FROM clients c
INNER JOIN amocrm_deals d ON c.id = d.client_id AND d.status_label = 'in_progress'
LEFT JOIN bookings b ON c.id = b.client_id AND b.status IN ('planned', 'active')
GROUP BY c.id, c.phone, c.name
ORDER BY active_deals DESC, active_bookings DESC;

-- 7. Связь сделок с чатами (Umnico)
-- Использование: Понимание влияния коммуникации на конверсию
SELECT 
  d.amocrm_deal_id,
  d.status_label,
  d.price,
  CASE WHEN conv.id IS NOT NULL THEN 'Yes' ELSE 'No' END as has_umnico_chat,
  COUNT(DISTINCT m.id) as total_messages,
  COUNT(DISTINCT CASE WHEN m.channel = 'whatsapp' THEN m.id END) as whatsapp_messages,
  COUNT(DISTINCT CASE WHEN m.channel = 'amocrm_note' THEN m.id END) as amocrm_notes
FROM amocrm_deals d
LEFT JOIN conversations conv ON d.conversation_id = conv.id
LEFT JOIN messages m ON conv.id = m.conversation_id OR m.client_id = d.client_id
GROUP BY d.amocrm_deal_id, d.status_label, d.price, conv.id
ORDER BY d.updated_at DESC;

-- 8. Анализ custom fields
-- Использование: Понимание какие поля заполняются чаще
SELECT 
  key as custom_field_name,
  COUNT(*) as deals_with_field,
  COUNT(DISTINCT value) as unique_values,
  STRING_AGG(DISTINCT value::text, ', ' ORDER BY value::text) as sample_values
FROM amocrm_deals,
LATERAL jsonb_each_text(custom_fields) AS t(key, value)
WHERE custom_fields != '{}'::jsonb
GROUP BY key
ORDER BY deals_with_field DESC;

-- 9. Временной анализ сделок
-- Использование: Понимание сезонности и трендов
SELECT 
  DATE_TRUNC('month', d.created_at) as month,
  d.status_label,
  COUNT(*) as deals_count,
  SUM(d.price) as total_revenue,
  AVG(d.price) as avg_price,
  COUNT(DISTINCT d.client_id) as unique_clients
FROM amocrm_deals d
WHERE d.created_at >= NOW() - INTERVAL '12 months'
GROUP BY DATE_TRUNC('month', d.created_at), d.status_label
ORDER BY month DESC, status_label;

-- 10. Сделки без связей с RentProg
-- Использование: Выявление сделок требующих ручной обработки
SELECT 
  d.amocrm_deal_id,
  d.status_label,
  d.price,
  d.created_at,
  d.updated_at,
  c.phone,
  c.name,
  d.custom_fields,
  CASE 
    WHEN d.custom_fields->>'rentprog_booking_id' IS NULL THEN 'No booking link'
    WHEN d.metadata->>'booking_id' IS NULL THEN 'Booking not found in DB'
    ELSE 'OK'
  END as link_status
FROM amocrm_deals d
INNER JOIN clients c ON d.client_id = c.id
WHERE d.custom_fields->>'rentprog_booking_id' IS NULL
   OR d.metadata->>'booking_id' IS NULL
ORDER BY d.updated_at DESC;

-- 11. Конверсия по этапам воронки
-- Использование: Понимание эффективности воронки
WITH status_order AS (
  SELECT 
    status_id,
    status_label,
    ROW_NUMBER() OVER (ORDER BY 
      CASE status_label 
        WHEN 'in_progress' THEN 1
        WHEN 'successful' THEN 2
        WHEN 'unsuccessful' THEN 3
        ELSE 4
      END
    ) as stage_num
  FROM amocrm_deals
  GROUP BY status_id, status_label
)
SELECT 
  so.status_id,
  so.status_label,
  so.stage_num,
  COUNT(d.id) as deals_count,
  COUNT(DISTINCT d.client_id) as unique_clients,
  SUM(d.price) as total_value,
  AVG(d.price) as avg_price,
  ROUND(100.0 * COUNT(d.id) / SUM(COUNT(d.id)) OVER (), 2) as percentage
FROM status_order so
LEFT JOIN amocrm_deals d ON so.status_id = d.status_id
GROUP BY so.status_id, so.status_label, so.stage_num
ORDER BY so.stage_num;

-- 12. Клиенты с множественными сделками
-- Использование: Выявление лояльных клиентов
SELECT 
  c.id,
  c.phone,
  c.name,
  COUNT(DISTINCT d.id) as total_deals,
  COUNT(DISTINCT CASE WHEN d.status_label = 'successful' THEN d.id END) as successful_deals,
  COUNT(DISTINCT CASE WHEN d.status_label = 'unsuccessful' THEN d.id END) as unsuccessful_deals,
  SUM(CASE WHEN d.status_label = 'successful' THEN d.price ELSE 0 END) as total_revenue,
  MIN(d.created_at) as first_deal_date,
  MAX(d.created_at) as last_deal_date,
  EXTRACT(EPOCH FROM (MAX(d.created_at) - MIN(d.created_at))) / 86400 as days_between_first_last
FROM clients c
INNER JOIN amocrm_deals d ON c.id = d.client_id
GROUP BY c.id, c.phone, c.name
HAVING COUNT(DISTINCT d.id) > 1
ORDER BY total_deals DESC, total_revenue DESC;

