@echo off
C:\Python313\python.exe setup\run_db_analysis.py > db_analysis_result.txt 2>&1
type db_analysis_result.txt

