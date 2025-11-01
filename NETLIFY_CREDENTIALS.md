# 🔐 Netlify Доступы и Секреты

## Домен
- **URL**: https://geodrive.netlify.app/
- Используется как `WEBHOOK_URL` в n8n

## Netlify API Token
⚠️ **Требуется заполнить**

Для получения API токена Netlify:
1. Войдите в [Netlify Dashboard](https://app.netlify.com/)
2. Перейдите в **User settings** → **Applications** → **New access token**
3. Создайте токен с необходимыми правами
4. Сохраните токен здесь:

```
NETLIFY_API_TOKEN=ваш_токен_здесь
```

## Netlify Site ID
⚠️ **Требуется заполнить**

Для получения Site ID:
1. Откройте сайт в Netlify Dashboard
2. Перейдите в **Site settings** → **General**
3. Скопируйте **Site ID**:

```
NETLIFY_SITE_ID=ваш_site_id_здесь
```

## Netlify Deploy Hook
⚠️ **Требуется заполнить** (опционально)

Для создания Deploy Hook:
1. Откройте **Site settings** → **Build & deploy** → **Deploy hooks**
2. Создайте новый hook
3. Скопируйте URL:

```
NETLIFY_DEPLOY_HOOK=https://api.netlify.com/build_hooks/...
```

## Использование в проекте

### В .env файле:
```env
NETLIFY_API_TOKEN=ваш_токен
NETLIFY_SITE_ID=ваш_site_id
NETLIFY_DEPLOY_HOOK=ваш_deploy_hook_url
```

### В коде:
```typescript
// Пример использования в TypeScript
const NETLIFY_API_TOKEN = process.env.NETLIFY_API_TOKEN;
const NETLIFY_SITE_ID = process.env.NETLIFY_SITE_ID;
```

## Команды Netlify CLI

Установка:
```bash
npm install -g netlify-cli
```

Вход:
```bash
netlify login
```

Получение токена через CLI:
```bash
netlify status
```

## ⚠️ Важно

- **Никогда не коммитьте** этот файл с реальными токенами в репозиторий
- Используйте `.env` файл для хранения секретов
- Добавьте `NETLIFY_CREDENTIALS.md` в `.gitignore` если будете хранить реальные токены
- Храните токены в безопасном месте (например, в GitHub Secrets для CI/CD)

## Быстрые ссылки

- [Netlify Dashboard](https://app.netlify.com/)
- [Netlify API Documentation](https://docs.netlify.com/api/get-started/)
- [Netlify CLI Documentation](https://cli.netlify.com/)




