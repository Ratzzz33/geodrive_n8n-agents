import pandas as pd
from pathlib import Path

all_contexts = set()

for f in sorted(Path("excel").glob("*.xlsx")):
    try:
        df = pd.read_excel(f)
        if 'Контекст' in df.columns:
            contexts = df['Контекст'].unique()
            for ctx in contexts:
                if pd.notna(ctx):
                    all_contexts.add(str(ctx))
    except Exception as e:
        pass

with open('all_contexts.txt', 'w', encoding='utf-8') as out:
    out.write(f"Всего уникальных значений 'Контекст': {len(all_contexts)}\n\n")
    
    telegram_contexts = sorted([c for c in all_contexts if 'telegram' in c.lower()])
    whatsapp_contexts = sorted([c for c in all_contexts if 'whatsapp' in c.lower()])
    
    out.write(f"Telegram ({len(telegram_contexts)}):\n")
    for ctx in telegram_contexts:
        out.write(f"  - {ctx}\n")
    
    out.write(f"\nWhatsApp ({len(whatsapp_contexts)}):\n")
    for ctx in whatsapp_contexts:
        out.write(f"  - {ctx}\n")

print("Результат в all_contexts.txt")

