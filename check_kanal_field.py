import pandas as pd

files = [
    "excel/telegram_6553217554_2025_11_11_08_39_08.xlsx",
    "excel/whatsapp_995599001665_2025_11_11_08_40_00_0.xlsx"
]

with open('kanal_field_check.txt', 'w', encoding='utf-8') as f:
    for filepath in files:
        df = pd.read_excel(filepath)
        f.write(f"\n{'='*60}\n")
        f.write(f"Файл: {filepath.split('/')[-1]}\n")
        f.write(f"{'='*60}\n\n")
        
        f.write("Колонки в файле:\n")
        for col in df.columns:
            f.write(f"  - {col}\n")
        
        if 'Канал' in df.columns:
            f.write(f"\nУникальные значения поля 'Канал':\n")
            unique = df['Канал'].unique()
            for val in unique[:10]:
                f.write(f"  - {val}\n")
            f.write(f"\nВсего уникальных: {len(unique)}\n")
        else:
            f.write("\n⚠️  Поле 'Канал' НЕ НАЙДЕНО!\n")
        
        f.write(f"\nОбразцы (первые 3 строки):\n")
        for i, row in df.head(3).iterrows():
            f.write(f"\nСтрока {i+1}:\n")
            f.write(f"  Канал: {row.get('Канал', 'N/A')}\n")
            f.write(f"  Контекст: {row.get('Контекст', 'N/A')}\n")
            f.write(f"  Клиент: {row.get('Клиент', 'N/A')}\n")

print("Результат в kanal_field_check.txt")

