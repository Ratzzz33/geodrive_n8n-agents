import pandas as pd

# Читаем WhatsApp файл
df = pd.read_excel("excel/whatsapp_995599001665_2025_11_11_08_40_00_0.xlsx")

with open('whatsapp_samples.txt', 'w', encoding='utf-8') as f:
    f.write("ОБРАЗЦЫ ПОЛЯ 'Контекст' из WhatsApp файла:\n")
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

print("Результат в whatsapp_samples.txt")

