#!/usr/bin/env python3
import pandas as pd
import psycopg2
from psycopg2.extras import execute_batch
import uuid
from datetime import datetime
from pathlib import Path

CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require'

def get_conn():
    return psycopg2.connect(CONNECTION_STRING, connect_timeout=10)

def parse_context(s):
    s_lower = s.lower()
    channel = 'telegram' if 'telegram' in s_lower else 'whatsapp' if 'whatsapp' in s_lower else 'unknown'
    direction = 'incoming' if '(вх)' in s or '(исх)' not in s else 'outgoing'
    return channel, direction

def parse_ts(s):
    try:
        return datetime.strptime(str(s), '%d.%m.%Y %H:%M:%S')
    except:
        return None

def process_file(f):
    print(f'  Processing {f.name}')
    df = pd.read_excel(f)
    print(f'    Columns: {list(df.columns)[:5]}')
    cols = ['Контекст', 'Написано', 'Клиент', 'Содержимое']
    if not all(c in df.columns for c in cols):
        print(f'    SKIP - missing columns')
        return None
    df[['channel','direction']] = df['Контекст'].apply(lambda x: pd.Series(parse_context(x)))
    df['sent_at'] = df['Написано'].apply(parse_ts)
    df = df.rename(columns={'Канал':'channel_name','Клиент':'client_identifier','Содержимое':'content','Контекст':'raw_context'})
    df = df.dropna(subset=['client_identifier','sent_at'])
    print(f'    Valid rows: {len(df)}')
    return df

print('='*80)
print('IMPORT I2CRM TO NEON')
print('='*80)

print('\nReading files from /root/excel...')
dfs = []
for f in sorted(Path('/root/excel').glob('*.xlsx')):
    d = process_file(f)
    if d is not None:
        dfs.append(d)

if not dfs:
    print('ERROR: No valid dataframes!')
    exit(1)

df = pd.concat(dfs, ignore_index=True)
print(f'\nTotal messages: {len(df):,}')

# Create conversations
print('\n' + '='*80)
print('CREATING CONVERSATIONS')
print('='*80)

grouped = df.groupby(['channel','client_identifier']).agg({
    'sent_at':['min','max','count'],
    'direction':lambda x:(x=='incoming').sum(),
    'channel_name':'first'
}).reset_index()

grouped.columns = ['channel','client_identifier','first_message_at','last_message_at','total_messages','incoming_count','channel_name']
grouped['outgoing_count'] = grouped['total_messages'] - grouped['incoming_count']

print(f'Unique conversations: {len(grouped):,}')

conn = get_conn()
cur = conn.cursor()
convs = []
for _,r in grouped.iterrows():
    convs.append((
        str(uuid.uuid4()),
        r['channel'],
        r['channel_name'],
        r['client_identifier'],
        r['first_message_at'],
        r['last_message_at'],
        int(r['total_messages']),
        int(r['incoming_count']),
        int(r['outgoing_count'])
    ))

execute_batch(cur, '''
    INSERT INTO i2crm_conversations 
    (id,channel,channel_name,client_identifier,first_message_at,last_message_at,total_messages,incoming_count,outgoing_count) 
    VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s) 
    ON CONFLICT (channel,client_identifier) DO NOTHING
''', convs, page_size=500)
conn.commit()
cur.close()
conn.close()
print(f'Created {len(convs):,} conversations')

# Get mapping
print('\nBuilding conversation map...')
conn = get_conn()
cur = conn.cursor()
cur.execute('SELECT channel,client_identifier,id FROM i2crm_conversations')
conv_map = {(r[0],r[1]):r[2] for r in cur.fetchall()}
cur.close()
conn.close()
print(f'Mapping size: {len(conv_map):,}')

# Messages
print('\n' + '='*80)
print('IMPORTING MESSAGES')
print('='*80)

df['conversation_id'] = df.apply(lambda r: conv_map.get((r['channel'],r['client_identifier'])), axis=1)
df = df.dropna(subset=['conversation_id'])

conn = get_conn()
cur = conn.cursor()
cur.execute('SELECT COUNT(*) FROM i2crm_messages')
already = cur.fetchone()[0]
cur.close()
conn.close()

if already > 0:
    print(f'Already imported: {already:,}')
    print(f'Skipping first {already:,} rows...')
    df = df.iloc[already:]

total = len(df)
print(f'To import: {total:,}')

CHUNK = 100
imported = 0
errors = 0

for start in range(0, total, CHUNK):
    chunk = df.iloc[start:start+CHUNK]
    msgs = []
    for _,r in chunk.iterrows():
        msgs.append((
            str(uuid.uuid4()),
            r['conversation_id'],
            r['channel'],
            r['channel_name'],
            r['client_identifier'],
            str(r['content'])[:10000] if pd.notna(r['content']) else '',
            r['direction'],
            r['sent_at'],
            str(r['raw_context'])[:1000] if pd.notna(r['raw_context']) else ''
        ))
    
    try:
        conn = get_conn()
        cur = conn.cursor()
        cur.executemany('''
            INSERT INTO i2crm_messages 
            (id,conversation_id,channel,channel_name,client_identifier,content,direction,sent_at,raw_context) 
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)
        ''', msgs)
        conn.commit()
        cur.close()
        conn.close()
        
        imported += len(msgs)
        
        if start % 5000 == 0 or imported == total:
            pct = (imported / total) * 100
            print(f'  {imported:,} / {total:,} ({pct:.1f}%)')
            
    except Exception as e:
        errors += 1
        print(f'ERROR at {start}: {e}')
        try:
            conn.close()
        except:
            pass
        if errors > 10:
            print('Too many errors, stopping!')
            break

print('\n' + '='*80)
print('DONE!')
print('='*80)
print(f'Imported: {imported:,} messages')
print(f'Errors: {errors}')

