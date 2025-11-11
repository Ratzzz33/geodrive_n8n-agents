#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Анализ РЕАЛЬНЫХ данных в Excel файлах
"""
import sys, io
if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

import pandas as pd
from pathlib import Path

def analyze_file(filepath):
    df = pd.read_excel(filepath)
    print(f"\n📄 {filepath.name}")
    print(f"   Всего строк: {len(df):,}")
    
    # Проверяем структуру
    print(f"   Колонки: {', '.join(df.columns[:5])}...")
    
    # Проверяем валидные строки
    if all(col in df.columns for col in ['Контекст', 'Написано', 'Клиент']):
        # i2crm формат
        valid = df.dropna(subset=['Клиент', 'Написано'])
        print(f"   Валидных (с client + timestamp): {len(valid):,}")
        
        # Уникальные
        unique = valid.drop_duplicates(subset=['Клиент', 'Написано', 'Содержимое'])
        print(f"   Уникальных: {len(unique):,}")
        print(f"   Дубликатов: {len(valid) - len(unique):,}")
    else:
        print(f"   ⚠️  НЕ i2crm формат!")
    
    return len(df)

print("="*80)
print("📊 АНАЛИЗ EXCEL ФАЙЛОВ")
print("="*80)

excel_dir = Path("excel")
files = sorted(excel_dir.glob("*.xlsx"))

total = 0
for f in files:
    rows = analyze_file(f)
    total += rows

print(f"\n" + "="*80)
print(f"ИТОГО строк во всех файлах: {total:,}")
print("="*80)

