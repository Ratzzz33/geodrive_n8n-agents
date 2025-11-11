#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Проверка дубликатов в Excel файлах i2crm
"""

import sys
import io
import pandas as pd
from pathlib import Path
from datetime import datetime

if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

def parse_context(context_str):
    context_lower = context_str.lower()
    if 'telegram' in context_lower:
        channel = 'telegram'
    elif 'whatsapp' in context_lower:
        channel = 'whatsapp'
    else:
        channel = 'unknown'
    
    if '(вх)' in context_str or 'incoming' in context_lower:
        direction = 'incoming'
    elif '(исх)' in context_str or 'outgoing' in context_lower:
        direction = 'outgoing'
    else:
        direction = 'unknown'
    
    return channel, direction

def parse_timestamp(ts_str):
    try:
        return datetime.strptime(ts_str, '%d.%m.%Y %H:%M:%S')
    except:
        return None

def main():
    excel_dir = Path("excel")
    excel_files = sorted(excel_dir.glob("*.xlsx"))
    
    print("🔍 Проверка дубликатов в выгрузке i2crm")
    print("="*80)
    
    all_data = []
    for filepath in excel_files:
        print(f"\n📖 {filepath.name}")
        df = pd.read_excel(filepath)
        
        # Парсим контекст
        df[['channel', 'direction']] = df['Контекст'].apply(
            lambda x: pd.Series(parse_context(x))
        )
        df['sent_at'] = df['Написано'].apply(parse_timestamp)
        
        df = df.rename(columns={
            'Канал': 'channel_name',
            'Клиент': 'client_identifier',
            'Содержимое': 'content',
            'Контекст': 'raw_context'
        })
        
        print(f"   Всего строк: {len(df):,}")
        
        # Проверяем дубликаты внутри файла
        duplicates_in_file = df.duplicated(subset=['channel', 'client_identifier', 'content', 'sent_at'], keep=False).sum()
        print(f"   Дубликаты (точные): {duplicates_in_file:,}")
        
        all_data.append(df)
    
    # Объединяем все
    print("\n" + "="*80)
    print("📊 АНАЛИЗ ВСЕХ ДАННЫХ")
    print("="*80)
    
    combined = pd.concat(all_data, ignore_index=True)
    print(f"\nВсего строк после объединения: {len(combined):,}")
    
    # Проверяем точные дубликаты (по всем ключевым полям)
    print("\n🔍 Дубликаты по (channel, client, content, timestamp):")
    exact_dups = combined.duplicated(subset=['channel', 'client_identifier', 'content', 'sent_at'], keep=False)
    print(f"   Дубликатов: {exact_dups.sum():,}")
    
    if exact_dups.sum() > 0:
        unique_exact = combined[~combined.duplicated(subset=['channel', 'client_identifier', 'content', 'sent_at'])]
        print(f"   Уникальных: {len(unique_exact):,}")
        print(f"   Удалится при дедупликации: {len(combined) - len(unique_exact):,}")
    
    # Проверяем дубликаты только по timestamp и client (разные сообщения в одно время)
    print("\n🔍 Сообщения в одно время от одного клиента (channel, client, timestamp):")
    time_dups = combined.duplicated(subset=['channel', 'client_identifier', 'sent_at'], keep=False)
    print(f"   Строк: {time_dups.sum():,}")
    
    # Проверяем дубликаты по content и client (одинаковый текст в разное время)
    print("\n🔍 Одинаковый текст от одного клиента (channel, client, content):")
    content_dups = combined.duplicated(subset=['channel', 'client_identifier', 'content'], keep=False)
    print(f"   Строк: {content_dups.sum():,}")
    
    # Статистика по файлам WhatsApp
    print("\n" + "="*80)
    print("📱 АНАЛИЗ ФАЙЛОВ WHATSAPP")
    print("="*80)
    
    whatsapp_files = [df for filepath, df in zip(excel_files, all_data) if 'whatsapp' in filepath.name.lower()]
    
    if len(whatsapp_files) > 1:
        print(f"\nНайдено {len(whatsapp_files)} файлов WhatsApp")
        
        # Проверяем пересечения между файлами
        for i, df1 in enumerate(whatsapp_files):
            for j, df2 in enumerate(whatsapp_files):
                if i >= j:
                    continue
                
                # Создаем ключи для сравнения
                df1_keys = set(df1.apply(lambda r: (r['channel'], r['client_identifier'], str(r['content'])[:100], str(r['sent_at'])), axis=1))
                df2_keys = set(df2.apply(lambda r: (r['channel'], r['client_identifier'], str(r['content'])[:100], str(r['sent_at'])), axis=1))
                
                intersection = len(df1_keys & df2_keys)
                print(f"\n   Файл {i} ∩ Файл {j}: {intersection:,} общих записей")
        
        # Объединяем все WhatsApp
        whatsapp_combined = pd.concat(whatsapp_files, ignore_index=True)
        print(f"\n   Всего WhatsApp строк: {len(whatsapp_combined):,}")
        
        # Уникальные после дедупликации
        whatsapp_unique = whatsapp_combined.drop_duplicates(subset=['channel', 'client_identifier', 'content', 'sent_at'])
        print(f"   Уникальных WhatsApp: {len(whatsapp_unique):,}")
        print(f"   Дубликатов в WhatsApp: {len(whatsapp_combined) - len(whatsapp_unique):,}")
    
    print("\n" + "="*80)
    print("💡 ВЫВОД")
    print("="*80)
    print(f"\nПрочитано из Excel: {len(combined):,}")
    
    # Считаем уникальные
    unique_all = combined.drop_duplicates(subset=['channel', 'client_identifier', 'content', 'sent_at'])
    print(f"Уникальных сообщений: {len(unique_all):,}")
    print(f"Дубликатов: {len(combined) - len(unique_all):,}")
    
    if len(combined) - len(unique_all) > 0:
        print(f"\n⚠️  ПРИЧИНА: {len(combined) - len(unique_all):,} сообщений - это ДУБЛИКАТЫ!")
        print(f"   WhatsApp файлы содержат пересекающиеся данные (выгружены в несколько частей)")

if __name__ == "__main__":
    main()

