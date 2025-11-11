#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Анализ структуры Excel выгрузок из i2crm
"""

import sys
import io
import pandas as pd
import os
from pathlib import Path

# Фикс кодировки для Windows
if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

def analyze_file(filepath):
    """Анализирует структуру Excel файла"""
    try:
        print(f"\n{'='*80}")
        print(f"📄 Файл: {os.path.basename(filepath)}")
        print(f"   Размер: {os.path.getsize(filepath) / 1024 / 1024:.2f} MB")
        print(f"{'='*80}")
        
        # Читаем первые 5 строк
        df = pd.read_excel(filepath, nrows=5)
        
        print(f"\n📊 Всего колонок: {len(df.columns)}")
        print(f"📋 Названия колонок:")
        for i, col in enumerate(df.columns, 1):
            print(f"   {i}. {col}")
        
        print(f"\n📝 Первые 3 строки:")
        print("-" * 80)
        
        # Выводим построчно для лучшей читаемости
        for idx, row in df.head(3).iterrows():
            print(f"\nСтрока {idx + 1}:")
            for col in df.columns:
                value = row[col]
                if pd.isna(value):
                    value = "[пусто]"
                elif isinstance(value, str) and len(str(value)) > 100:
                    value = str(value)[:100] + "..."
                print(f"  • {col}: {value}")
        
        # Подсчитываем общее количество строк
        print(f"\n📈 Считаем общее количество строк...")
        df_full = pd.read_excel(filepath)
        total_rows = len(df_full)
        print(f"   Всего строк: {total_rows:,}")
        
        # Проверяем уникальные значения в ключевых колонках
        if 'Клиент' in df_full.columns:
            unique_clients = df_full['Клиент'].nunique()
            print(f"   Уникальных клиентов: {unique_clients:,}")
        
        if 'Диалог' in df_full.columns:
            unique_dialogs = df_full['Диалог'].nunique()
            print(f"   Уникальных диалогов: {unique_dialogs:,}")
        
        return total_rows
        
    except Exception as e:
        print(f"❌ Ошибка при обработке {filepath}: {e}")
        import traceback
        traceback.print_exc()
        return 0

def main():
    excel_dir = Path("excel")
    
    if not excel_dir.exists():
        print("❌ Директория 'excel' не найдена")
        return
    
    print("🔍 Анализ выгрузок из i2crm")
    print("="*80)
    
    # Список всех Excel файлов
    excel_files = sorted(excel_dir.glob("*.xlsx"))
    
    if not excel_files:
        print("❌ Excel файлы не найдены в директории 'excel'")
        return
    
    print(f"\n📁 Найдено файлов: {len(excel_files)}")
    
    total_messages = 0
    
    # Telegram файлы
    telegram_files = [f for f in excel_files if 'telegram' in f.name.lower()]
    if telegram_files:
        print(f"\n\n{'#'*80}")
        print("📱 TELEGRAM ВЫГРУЗКИ")
        print(f"{'#'*80}")
        for filepath in telegram_files:
            rows = analyze_file(filepath)
            total_messages += rows
    
    # WhatsApp файлы
    whatsapp_files = [f for f in excel_files if 'whatsapp' in f.name.lower()]
    if whatsapp_files:
        print(f"\n\n{'#'*80}")
        print("💬 WHATSAPP ВЫГРУЗКИ")
        print(f"{'#'*80}")
        for filepath in whatsapp_files:
            rows = analyze_file(filepath)
            total_messages += rows
    
    # Итоги
    print(f"\n\n{'='*80}")
    print("📊 ИТОГОВАЯ СТАТИСТИКА")
    print(f"{'='*80}")
    print(f"Всего файлов: {len(excel_files)}")
    print(f"  • Telegram: {len(telegram_files)}")
    print(f"  • WhatsApp: {len(whatsapp_files)}")
    print(f"\n💬 Всего сообщений: {total_messages:,}")
    print(f"={'='*80}\n")

if __name__ == "__main__":
    main()

