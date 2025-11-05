# 🎯 Ручной запуск Deploy Playwright через n8n

Я создал workflow **"Deploy Playwright Service"** с SSH командами.

**ID:** `OyQziBSfiFcDdvZF`  
**URL:** https://n8n.rentflow.rentals/workflow/OyQziBSfiFcDdvZF

---

## ✅ Как запустить:

1. **Открой n8n UI:** https://n8n.rentflow.rentals

2. **Найди workflow "Deploy Playwright Service"**

3. **Открой его в редакторе**

4. **Нажми "Execute Workflow"** в правом верхнем углу

---

## 📋 Что он делает:

1. 🔄 Git Pull (обновление кода)
2. ⬇️ Install Chromium (~2-3 минуты)
3. 🔄 Restart PM2 service
4. ✅ Health Check
5. ✅ Ответ с результатом

---

## 🎯 Workflow содержит:

- **5 SSH нод** с логином `root@46.224.17.15`
- Пароль уже прописан
- Все команды готовы к выполнению

---

## ⚡ После успешного выполнения:

Ты увидишь в последней ноде ответ:
```json
{
  "success": true,
  "message": "Playwright deployed",
  "health": "{\"status\":\"ok\",\"service\":\"playwright-service\"}"
}
```

---

## 🔧 Альтернатива: Активировать workflow

Если хочешь, чтобы он работал через webhook:

1. В редакторе workflow нажми переключатель **"Inactive" → "Active"** вверху
2. Дождись сообщения "Workflow activated"
3. Вызови webhook:
```bash
curl -X POST https://webhook.rentflow.rentals/webhook/deploy-playwright
```

---

**Открывай n8n и запускай!** 🚀

