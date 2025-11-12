@echo off
echo Running duplicate check...
C:\Python313\python.exe setup\run_dup_check.py > dup_check_result.txt 2>&1
echo.
echo Result saved to dup_check_result.txt
type dup_check_result.txt

