-- Добавление полей для ссылок на страницы автомобилей на сайте geodrive.info

ALTER TABLE cars ADD COLUMN IF NOT EXISTS ru_link TEXT;
ALTER TABLE cars ADD COLUMN IF NOT EXISTS en_link TEXT;

-- Создаем индексы для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_cars_ru_link ON cars(ru_link) WHERE ru_link IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cars_en_link ON cars(en_link) WHERE en_link IS NOT NULL;

COMMENT ON COLUMN cars.ru_link IS 'Ссылка на русскую версию страницы авто на geodrive.info';
COMMENT ON COLUMN cars.en_link IS 'Ссылка на английскую версию страницы авто на geodrive.info';

