#!/bin/bash

# Разовая проверка автомобилей без цен с задержками между филиалами

echo "🚀 Запуск проверки автомобилей без цен..."
echo "Дата: $(date)"
echo ""

BRANCHES=("tbilisi" "batumi" "kutaisi" "service-center")
DELAY=60  # 60 секунд между запросами для rate limit

for BRANCH in "${BRANCHES[@]}"; do
  echo "📊 Проверка филиала: $BRANCH"
  
  RESULT=$(curl -s "http://localhost:3000/check-cars-without-prices/$BRANCH")
  
  # Проверка на успех
  if echo "$RESULT" | grep -q '"ok":true'; then
    TOTAL=$(echo "$RESULT" | grep -o '"total":[0-9]*' | head -1 | cut -d':' -f2)
    WITHOUT=$(echo "$RESULT" | grep -o '"withoutPrices":[0-9]*' | head -1 | cut -d':' -f2)
    echo "  ✅ Успешно: всего $TOTAL авто, без цен: $WITHOUT"
  else
    echo "  ❌ Ошибка: $RESULT"
  fi
  
  echo ""
  
  # Задержка перед следующим филиалом (кроме последнего)
  if [ "$BRANCH" != "service-center" ]; then
    echo "⏳ Ожидание $DELAY секунд перед следующим филиалом..."
    sleep $DELAY
    echo ""
  fi
done

echo "✅ Проверка завершена: $(date)"

