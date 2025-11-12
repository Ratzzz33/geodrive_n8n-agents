import pandas as pd
from pathlib import Path
from datetime import datetime
import hashlib

def parse_context(s):
    if pd.isna(s): return 'unknown', 'unknown'
    s_lower = str(s).lower()
    channel = 'telegram' if 'telegram' in s_lower else 'whatsapp' if 'whatsapp' in s_lower else 'unknown'
    direction = 'incoming' if '(вх)' in s else 'outgoing'
    return channel, direction

def parse_ts(s):
    try: return datetime.strptime(str(s).strip(), '%d.%m.%Y %H:%M:%S')
    except: return None

def msg_hash(channel, client, timestamp, content):
    key = f"{channel}_{client}_{timestamp}_{content[:100]}"
    return hashlib.md5(key.encode()).hexdigest()

result = []
total_rows = 0
total_valid = 0
total_dups = 0

for f in sorted(Path("excel").glob("*.xlsx")):
    try:
        df = pd.read_excel(f)
        required = ['Контекст', 'Написано', 'Клиент', 'Содержимое']
        if not all(c in df.columns for c in required):
            continue
        
        df[['channel','direction']] = df['Контекст'].apply(lambda x: pd.Series(parse_context(x)))
        df['sent_at'] = df['Написано'].apply(parse_ts)
        df = df[df['sent_at'].notna() & df['channel'].isin(['telegram','whatsapp'])]
        
        # Создаем hash для каждой записи
        df['hash'] = df.apply(
            lambda r: msg_hash(r['channel'], r.get('Клиент',''), r['sent_at'], str(r.get('Содержимое',''))[:100]),
            axis=1
        )
        
        file_rows = len(df)
        unique_hashes = df['hash'].nunique()
        dups = file_rows - unique_hashes
        
        total_rows += file_rows
        total_valid += unique_hashes
        total_dups += dups
        
        result.append(f"{f.name}:")
        result.append(f"  Всего: {file_rows:,}")
        result.append(f"  Уникальных: {unique_hashes:,}")
        result.append(f"  Дубликатов: {dups:,} ({dups/file_rows*100:.1f}%)")
        result.append("")
        
    except Exception as e:
        result.append(f"{f.name}: ERROR - {str(e)[:50]}")
        result.append("")

result.append("="*60)
result.append("ИТОГО:")
result.append(f"  Всего записей: {total_rows:,}")
result.append(f"  Уникальных: {total_valid:,}")
result.append(f"  Дубликатов ВНУТРИ Excel: {total_dups:,} ({total_dups/total_rows*100:.1f}%)")

result_text = '\n'.join(result)
with open('excel_internal_dups.txt', 'w', encoding='utf-8') as f:
    f.write(result_text)

print(result_text)

