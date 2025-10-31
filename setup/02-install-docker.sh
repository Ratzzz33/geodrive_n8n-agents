#!/bin/bash
# Скрипт для установки Docker и Docker Compose на Ubuntu

set -e

echo "Обновление списка пакетов..."
apt-get update

echo "Установка зависимостей..."
apt-get install -y \
    ca-certificates \
    curl \
    gnupg \
    lsb-release

echo "Добавление официального GPG ключа Docker..."
mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg

echo "Настройка репозитория Docker..."
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null

echo "Установка Docker Engine..."
apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

echo "Добавление текущего пользователя в группу docker..."
usermod -aG docker $USER || usermod -aG docker root

echo "Запуск и включение Docker..."
systemctl start docker
systemctl enable docker

echo "Проверка установки..."
docker --version
docker compose version

echo "Docker и Docker Compose успешно установлены!"

