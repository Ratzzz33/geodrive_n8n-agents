import pandas as pd
from pathlib import Path
from datetime import datetime

def parse_context(s):
    if pd.isna(s): return 'unknown', 'unknown'
    s_lower = str(s).lower()
    channel = 'telegram' if 'telegram' in s_lower else 'whatsapp' if 'whatsapp' in s_lower else 'unknown'
    direction = 'incoming' if '(вх)' in s else 'outgoing'
    return channel, direction

def parse_ts(s):
    try: return datetime.strptime(str(s).strip(), '%d.%m.%Y %H:%M:%S')
    except: return None

all_data = []
for f in sorted(Path("excel").glob("*.xlsx")):
    try:
        df = pd.read_excel(f)
        if not all(c in df.columns for c in ['Контекст', 'Написано', 'Клиент', 'Содержимое']):
            continue
        df[['channel','direction']] = df['Контекст'].apply(lambda x: pd.Series(parse_context(x)))
        df['sent_at'] = df['Написано'].apply(parse_ts)
        df = df[df['sent_at'].notna() & df['channel'].isin(['telegram','whatsapp'])]
        all_data.append(df)
        with open('excel_result.txt', 'a', encoding='utf-8') as out:
            out.write(f"{f.name}: {len(df):,}\n")
    except Exception as e:
        with open('excel_result.txt', 'a', encoding='utf-8') as out:
            out.write(f"{f.name}: ERROR - {str(e)[:50]}\n")

if all_data:
    combined = pd.concat(all_data, ignore_index=True)
    tg = len(combined[combined['channel']=='telegram'])
    wa = len(combined[combined['channel']=='whatsapp'])
    inc = len(combined[combined['direction']=='incoming'])
    out_dir = len(combined[combined['direction']=='outgoing'])
    
    with open('excel_result.txt', 'a', encoding='utf-8') as f:
        f.write(f"\nИТОГО Excel:\n")
        f.write(f"  Всего: {len(combined):,}\n")
        f.write(f"  Telegram: {tg:,}\n")
        f.write(f"  WhatsApp: {wa:,}\n")
        f.write(f"  Входящие: {inc:,}\n")
        f.write(f"  Исходящие: {out_dir:,}\n")

