@echo off
echo ========================================
echo IMPORTING EMPLOYEES FROM RENTPROG
echo ========================================

cd /d "%~dp0"

echo Step 1: Applying migration...
node setup/run_employee_import.mjs

echo.
echo Step 2: Building TypeScript...
call npm run build

echo.
echo Step 3: Running import...
node dist/services/importEmployees.js

echo.
echo ========================================
echo DONE!
echo ========================================
pause

