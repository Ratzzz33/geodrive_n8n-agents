#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Дебаг маппинга диалогов
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
    
    print("🔍 Дебаг маппинга conversation_id")
    print("="*80)
    
    all_data = []
    for filepath in excel_files:
        df = pd.read_excel(filepath)
        df[['channel', 'direction']] = df['Контекст'].apply(lambda x: pd.Series(parse_context(x)))
        df['sent_at'] = df['Написано'].apply(parse_timestamp)
        df = df.rename(columns={
            'Канал': 'channel_name',
            'Клиент': 'client_identifier',
            'Содержимое': 'content',
            'Контекст': 'raw_context'
        })
        all_data.append(df)
    
    combined_df = pd.concat(all_data, ignore_index=True)
    print(f"\n📋 Всего строк: {len(combined_df):,}")
    
    # Проверяем что передается в create_conversations
    print("\n" + "="*80)
    print("1️⃣  ЧТО ПЕРЕДАЕТСЯ В create_conversations()")
    print("="*80)
    
    print(f"\nВсего строк: {len(combined_df):,}")
    print(f"Уникальных (channel, client): {combined_df[['channel', 'client_identifier']].drop_duplicates().shape[0]:,}")
    
    # Проверяем NaN
    nan_channel = combined_df['channel'].isna().sum()
    nan_client = combined_df['client_identifier'].isna().sum()
    print(f"\nNaN в channel: {nan_channel:,}")
    print(f"NaN в client_identifier: {nan_client:,}")
    
    # Создаем grouped (как в оригинальном скрипте)
    print("\n" + "="*80)
    print("2️⃣  ГРУППИРОВКА (create_conversations)")
    print("="*80)
    
    grouped = combined_df.groupby(['channel', 'client_identifier']).agg({
        'sent_at': ['min', 'max', 'count'],
        'direction': lambda x: (x == 'incoming').sum(),
        'channel_name': 'first'
    }).reset_index()
    
    grouped.columns = [
        'channel', 'client_identifier', 
        'first_message_at', 'last_message_at', 'total_messages',
        'incoming_count', 'channel_name'
    ]
    
    print(f"\nДиалогов после группировки: {len(grouped):,}")
    print(f"Сумма сообщений в grouped: {grouped['total_messages'].sum():,}")
    
    # Создаем mapping
    conv_map = {(row['channel'], row['client_identifier']): f"uuid_{i}" 
                for i, row in grouped.iterrows()}
    
    print(f"Записей в conv_map: {len(conv_map):,}")
    
    # Применяем mapping (как в import_messages)
    print("\n" + "="*80)
    print("3️⃣  ПРИМЕНЕНИЕ МАППИНГА (import_messages)")
    print("="*80)
    
    combined_df['conversation_id'] = combined_df.apply(
        lambda row: conv_map.get((row['channel'], row['client_identifier'])),
        axis=1
    )
    
    with_conv = combined_df[combined_df['conversation_id'].notna()]
    without_conv = combined_df[combined_df['conversation_id'].isna()]
    
    print(f"\nС conversation_id: {len(with_conv):,}")
    print(f"БЕЗ conversation_id: {len(without_conv):,}")
    
    if len(without_conv) > 0:
        print("\n❌ ПРОБЛЕМА!")
        print("\nАнализ строк БЕЗ conversation_id:")
        
        # Проверяем что в них не так
        print(f"\nNaN в channel: {without_conv['channel'].isna().sum():,}")
        print(f"NaN в client_identifier: {without_conv['client_identifier'].isna().sum():,}")
        
        # Проверяем уникальные комбинации
        unique_without = without_conv[['channel', 'client_identifier']].drop_duplicates()
        print(f"\nУникальных комбинаций БЕЗ conversation_id: {len(unique_without):,}")
        
        # Проверяем есть ли эти комбинации в grouped
        print("\nПроверяем первые 10 комбинаций в grouped:")
        for idx, row in unique_without.head(10).iterrows():
            key = (row['channel'], row['client_identifier'])
            exists = key in conv_map
            print(f"   {key}: {'✅' if exists else '❌'}")
        
        # Смотрим примеры
        print("\nПримеры строк БЕЗ conversation_id:")
        print(without_conv[['channel', 'channel_name', 'client_identifier', 'content', 'sent_at']].head(10).to_string())
    
    print("\n" + "="*80)
    print("💡 ДИАГНОСТИКА")
    print("="*80)
    
    print(f"\nИсходных строк: {len(combined_df):,}")
    print(f"Групп создано: {len(grouped):,}")
    print(f"Сумма в группах: {grouped['total_messages'].sum():,}")
    print(f"Будет импортировано: {len(with_conv):,}")
    print(f"Будет пропущено: {len(without_conv):,}")
    
    if grouped['total_messages'].sum() != len(combined_df):
        diff = len(combined_df) - grouped['total_messages'].sum()
        print(f"\n⚠️  НЕСООТВЕТСТВИЕ: {diff:,} строк потеряно при группировке!")

if __name__ == "__main__":
    main()

