# Установка Node.js на сервере Hetzner

Если на сервере не установлен Node.js, выполните эти команды:

```bash
ssh root@46.224.17.15
# Пароль: enebit7Lschwrkb93vnm

# Установка Node.js 18.x
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt-get install -y nodejs

# Проверка установки
node --version
npm --version

# Установка зависимостей проекта
cd /root/geodrive_n8n-agents
npm install
```

После установки Node.js перезапустите бота через GitHub Actions workflow или вручную.

