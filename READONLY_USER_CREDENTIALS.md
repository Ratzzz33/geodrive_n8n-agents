# 🔐 READ-ONLY Пользователь БД - Быстрый доступ

**⚠️ КОНФИДЕНЦИАЛЬНО - Не публиковать в открытый доступ!**

---

## 🔗 Connection String (копируй и вставляй)

```
postgresql://bot_readonly:qNMSE5wAiPKRDYxJ719DeX9nm6Y4xWr1@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require
```

---

## 📋 Компоненты

| Параметр | Значение |
|----------|----------|
| Host | `ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech` |
| Port | `5432` (default) |
| Database | `neondb` |
| Username | `bot_readonly` |
| Password | `qNMSE5wAiPKRDYxJ719DeX9nm6Y4xWr1` |
| SSL Mode | `require` |

---

## 🛡️ Права

✅ **SELECT** (чтение) - разрешено  
❌ **INSERT/UPDATE/DELETE** - запрещено

---

## 🚀 Быстрый тест

### Node.js
```javascript
import pg from 'pg';
const client = new pg.Client({
  connectionString: 'postgresql://bot_readonly:qNMSE5wAiPKRDYxJ719DeX9nm6Y4xWr1@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require',
  ssl: { rejectUnauthorized: false }
});
await client.connect();
const result = await client.query('SELECT code, name FROM branches');
console.log(result.rows);
await client.end();
```

### Python
```python
import psycopg2
conn = psycopg2.connect("postgresql://bot_readonly:qNMSE5wAiPKRDYxJ719DeX9nm6Y4xWr1@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require")
cur = conn.cursor()
cur.execute("SELECT code, name FROM branches")
print(cur.fetchall())
conn.close()
```

---

## 📖 Полная документация

См. файл: [docs/EXTERNAL_BOT_DATABASE_ACCESS.md](docs/EXTERNAL_BOT_DATABASE_ACCESS.md)

---

**Создан:** 2025-11-08  
**Статус:** ✅ Протестирован

