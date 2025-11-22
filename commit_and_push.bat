@echo off
echo Adding files...
git add -A
echo.
echo Status:
git status --short
echo.
echo Committing...
git commit -m "fix: исправление парсинга дат из RentProg с учетом часового пояса Asia/Tbilisi

- Исправлена функция parseRentProgDate для правильной обработки часового пояса
- Добавлен явный часовой пояс +04:00 (Asia/Tbilisi) при парсинге дат
- Добавлены тесты для parseRentProgDate
- Создан документ BOOKING_DATES_TIMEZONE_ISSUE.md с описанием проблемы
- Экспортирована функция parseRentProgDate для тестирования
- Добавлен скрипт check_booking_changes_qz101qq.mjs для проверки истории изменений

Проблема: даты из RentProg парсились без часового пояса, что приводило к неправильному сохранению времени (UTC вместо Asia/Tbilisi)

Исправление: теперь даты парсятся с явным указанием +04:00, что соответствует часовому поясу RentProg"
echo.
echo Pushing...
git push
echo.
echo Done!
pause
