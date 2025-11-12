@echo off
del excel_result.txt 2>nul
C:\Python313\python.exe check_excel_simple.py
type excel_result.txt

