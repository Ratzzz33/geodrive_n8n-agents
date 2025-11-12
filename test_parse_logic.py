import pandas as pd

def parse_context(s):
    s_lower = s.lower()
    channel = 'telegram' if 'telegram' in s_lower else 'whatsapp' if 'whatsapp' in s_lower else 'unknown'
    direction = 'incoming' if '(вх)' in s else 'outgoing'
    return channel, direction

# Тестируем на реальных данных
df_tg = pd.read_excel("excel/telegram_6553217554_2025_11_11_08_39_08.xlsx", nrows=1000)
df_wa = pd.read_excel("excel/whatsapp_995599001665_2025_11_11_08_40_00_0.xlsx", nrows=1000)

tg_parsed = df_tg['Контекст'].apply(lambda x: parse_context(x))
wa_parsed = df_wa['Контекст'].apply(lambda x: parse_context(x))

tg_channels = tg_parsed.apply(lambda x: x[0])
wa_channels = wa_parsed.apply(lambda x: x[0])

result = f"""TELEGRAM FILE (первые 1000):
  Контекст уникальные: {df_tg['Контекст'].unique().tolist()}
  Parsed as telegram: {(tg_channels=='telegram').sum()}
  Parsed as whatsapp: {(tg_channels=='whatsapp').sum()}
  Parsed as unknown: {(tg_channels=='unknown').sum()}

WHATSAPP FILE (первые 1000):
  Контекст уникальные: {df_wa['Контекст'].unique()[:5].tolist()}
  Parsed as telegram: {(wa_channels=='telegram').sum()}
  Parsed as whatsapp: {(wa_channels=='whatsapp').sum()}
  Parsed as unknown: {(wa_channels=='unknown').sum()}
"""

with open('parse_test_result.txt', 'w', encoding='utf-8') as f:
    f.write(result)

print(result)

