#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Диагностика пропущенных сообщений при импорте из i2crm
"""

import sys
import io
import pandas as pd
import os
from pathlib import Path
from datetime import datetime

# Фикс кодировки для Windows
if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

def parse_context(context_str):
    """Парсит колонку 'Контекст'"""
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
    """Парсит timestamp"""
    try:
        return datetime.strptime(ts_str, '%d.%m.%Y %H:%M:%S')
    except:
        return None

def process_excel_file(filepath):
    """Читает и обрабатывает Excel файл"""
    print(f"📖 Читаем файл: {os.path.basename(filepath)}")
    
    df = pd.read_excel(filepath)
    print(f"   Прочитано строк: {len(df):,}")
    
    # Парсим контекст
    df[['channel', 'direction']] = df['Контекст'].apply(
        lambda x: pd.Series(parse_context(x))
    )
    
    # Парсим timestamp
    df['sent_at'] = df['Написано'].apply(parse_timestamp)
    
    # Переименовываем колонки
    df = df.rename(columns={
        'Канал': 'channel_name',
        'Клиент': 'client_identifier',
        'Содержимое': 'content',
        'Контекст': 'raw_context'
    })
    
    return df

def main():
    excel_dir = Path("excel")
    
    print("🔍 Диагностика пропущенных сообщений")
    print("="*80)
    
    # Читаем все файлы
    excel_files = sorted(excel_dir.glob("*.xlsx"))
    print(f"\n📁 Читаем {len(excel_files)} файлов...")
    
    all_data = []
    for filepath in excel_files:
        df = process_excel_file(filepath)
        all_data.append(df)
    
    # Объединяем
    combined_df = pd.concat(all_data, ignore_index=True)
    print(f"\n✅ Всего сообщений прочитано: {len(combined_df):,}")
    
    # Проверяем данные ДО очистки
    print("\n" + "="*80)
    print("📊 АНАЛИЗ ДАННЫХ ДО ОЧИСТКИ")
    print("="*80)
    
    print(f"\nВсего строк: {len(combined_df):,}")
    
    # Проверяем пустые значения
    print(f"\nПустые значения:")
    for col in ['client_identifier', 'sent_at', 'channel', 'direction']:
        null_count = combined_df[col].isna().sum()
        if null_count > 0:
            print(f"  • {col}: {null_count:,} пустых ({null_count/len(combined_df)*100:.1f}%)")
    
    # Проверяем уникальные комбинации
    print(f"\nУникальных комбинаций (channel, client_identifier):")
    unique_before_clean = combined_df[['channel', 'client_identifier']].drop_duplicates()
    print(f"  До очистки: {len(unique_before_clean):,}")
    
    # Проверяем комбинации с NaN
    has_nan = combined_df[
        combined_df['client_identifier'].isna() | combined_df['channel'].isna()
    ]
    print(f"  С пустыми значениями: {len(has_nan):,}")
    
    if len(has_nan) > 0:
        print(f"\n⚠️  Примеры строк с пустыми значениями:")
        print(has_nan[['channel', 'channel_name', 'client_identifier', 'content', 'sent_at']].head(10).to_string())
    
    # Очищаем данные (как в оригинальном скрипте)
    print("\n" + "="*80)
    print("🧹 ОЧИСТКА ДАННЫХ")
    print("="*80)
    
    initial_count = len(combined_df)
    combined_df = combined_df.dropna(subset=['client_identifier', 'sent_at'])
    removed = initial_count - len(combined_df)
    
    print(f"\nУдалено строк с невалидными данными: {removed:,}")
    print(f"Осталось строк: {len(combined_df):,}")
    
    # Группируем по диалогам
    print("\n" + "="*80)
    print("📋 ГРУППИРОВКА ПО ДИАЛОГАМ")
    print("="*80)
    
    grouped = combined_df.groupby(['channel', 'client_identifier']).size().reset_index(name='count')
    print(f"\nУникальных диалогов создано: {len(grouped):,}")
    
    print(f"\nПо каналам:")
    channel_stats = grouped.groupby('channel')['count'].agg(['count', 'sum']).reset_index()
    channel_stats.columns = ['Канал', 'Диалогов', 'Сообщений']
    print(channel_stats.to_string(index=False))
    
    # Создаем mapping (как в оригинальном скрипте)
    conv_map = {(row['channel'], row['client_identifier']): f"uuid_{i}" 
                for i, row in grouped.iterrows()}
    
    print(f"\nMapping создан: {len(conv_map):,} записей")
    
    # Проверяем сколько сообщений НЕ найдут свой диалог
    print("\n" + "="*80)
    print("🔍 ПРОВЕРКА МАППИНГА")
    print("="*80)
    
    combined_df['conversation_id'] = combined_df.apply(
        lambda row: conv_map.get((row['channel'], row['client_identifier'])),
        axis=1
    )
    
    without_conv = combined_df[combined_df['conversation_id'].isna()]
    
    print(f"\nСообщений без диалога: {len(without_conv):,}")
    
    if len(without_conv) > 0:
        print(f"\n⚠️  ПРОБЛЕМА НАЙДЕНА!")
        print(f"\nПримеры сообщений без диалога:")
        print(without_conv[['channel', 'channel_name', 'client_identifier', 'content', 'sent_at']].head(20).to_string())
        
        # Анализируем почему
        print(f"\n🔎 АНАЛИЗ ПРИЧИН:")
        
        # Проверяем типы данных
        print(f"\nТипы данных в сообщениях без диалога:")
        print(f"  • channel: {without_conv['channel'].dtype}")
        print(f"  • client_identifier: {without_conv['client_identifier'].dtype}")
        
        # Проверяем есть ли эти комбинации в grouped
        sample_combos = without_conv[['channel', 'client_identifier']].head(10).values
        print(f"\nПроверяем первые 10 комбинаций в mapping:")
        for channel, client in sample_combos:
            exists = (channel, client) in conv_map
            print(f"  • ({channel}, {client}): {'✅ найдена' if exists else '❌ НЕ найдена'}")
        
        # Проверяем уникальные комбинации
        unique_without = without_conv[['channel', 'client_identifier']].drop_duplicates()
        print(f"\nУникальных комбинаций в сообщениях без диалога: {len(unique_without):,}")
        
        # Проверяем пересечение
        all_combos = set((r['channel'], r['client_identifier']) 
                        for _, r in combined_df.iterrows())
        grouped_combos = set(conv_map.keys())
        missing_combos = all_combos - grouped_combos
        
        print(f"\nВсего уникальных комбинаций в данных: {len(all_combos):,}")
        print(f"Комбинаций в grouped: {len(grouped_combos):,}")
        print(f"Комбинаций НЕ в grouped: {len(missing_combos):,}")
        
        if missing_combos:
            print(f"\n❌ ПРИЧИНА: {len(missing_combos):,} комбинаций есть в сообщениях, но НЕТ в grouped!")
            print(f"\nПримеры пропущенных комбинаций:")
            for combo in list(missing_combos)[:10]:
                count = combined_df[
                    (combined_df['channel'] == combo[0]) & 
                    (combined_df['client_identifier'] == combo[1])
                ].shape[0]
                print(f"  • {combo}: {count} сообщений")
    
    print("\n" + "="*80)
    print("📊 ИТОГО")
    print("="*80)
    print(f"Прочитано сообщений: {initial_count:,}")
    print(f"После очистки: {len(combined_df):,}")
    print(f"Будет импортировано: {len(combined_df[combined_df['conversation_id'].notna()]):,}")
    print(f"Будет пропущено: {len(without_conv):,}")
    print(f"Потери: {len(without_conv) / initial_count * 100:.1f}%")

if __name__ == "__main__":
    main()

