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

results = []
for f in sorted(Path("excel").glob("*.xlsx")):
    try:
        df = pd.read_excel(f)
        required = ['Контекст', 'Написано', 'Клиент', 'Содержимое']
        if not all(c in df.columns for c in required):
            continue
        
        # ТОЧНО так же как в импорте
        df[['channel','direction']] = df['Контекст'].apply(lambda x: pd.Series(parse_context(x)))
        df['sent_at'] = df['Написано'].apply(parse_ts)
        
        # ФИЛЬТР как в импорте
        df_valid = df[df['sent_at'].notna() & df['channel'].isin(['telegram','whatsapp'])]
        
        tg_count = len(df_valid[df_valid['channel']=='telegram'])
        wa_count = len(df_valid[df_valid['channel']=='whatsapp'])
        
        results.append(f"{f.name}:\n  Total: {len(df_valid):,}\n  Telegram: {tg_count:,}\n  WhatsApp: {wa_count:,}\n")
    except Exception as e:
        results.append(f"{f.name}: ERROR - {str(e)[:50]}\n")

# Итого
all_data = []
for f in sorted(Path("excel").glob("*.xlsx")):
    try:
        df = pd.read_excel(f)
        required = ['Контекст', 'Написано', 'Клиент', 'Содержимое']
        if not all(c in df.columns for c in required):
            continue
        df[['channel','direction']] = df['Контекст'].apply(lambda x: pd.Series(parse_context(x)))
        df['sent_at'] = df['Написано'].apply(parse_ts)
        df_valid = df[df['sent_at'].notna() & df['channel'].isin(['telegram','whatsapp'])]
        all_data.append(df_valid)
    except:
        pass

if all_data:
    combined = pd.concat(all_data, ignore_index=True)
    total_tg = len(combined[combined['channel']=='telegram'])
    total_wa = len(combined[combined['channel']=='whatsapp'])
    
    results.append(f"\nИТОГО:\n  Total: {len(combined):,}\n  Telegram: {total_tg:,}\n  WhatsApp: {total_wa:,}\n")

result_text = '\n'.join(results)
with open('excel_recount.txt', 'w', encoding='utf-8') as f:
    f.write(result_text)

print(result_text)

