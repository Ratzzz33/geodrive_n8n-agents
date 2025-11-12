import pandas as pd
from pathlib import Path

# Читаем один файл и смотрим образцы
df = pd.read_excel("excel/telegram_6553217554_2025_11_11_08_39_08.xlsx")

with open('context_samples.txt', 'w', encoding='utf-8') as f:
    f.write("ОБРАЗЦЫ ПОЛЯ 'Контекст' из Telegram файла:\n")
    f.write("="*60 + "\n\n")
    
    for i, row in df.head(10).iterrows():
        context = row.get('Контекст', 'N/A')
        f.write(f"{i+1}. {context}\n")
    
    f.write("\n" + "="*60 + "\n")
    f.write("УНИКАЛЬНЫЕ ЗНАЧЕНИЯ 'Контекст':\n")
    f.write("="*60 + "\n\n")
    
    unique = df['Контекст'].unique()
    for val in unique[:20]:
        f.write(f"- {val}\n")

print("Результат в context_samples.txt")

