# Beach Lounger Booking Platform

Платформа для онлайн-бронирования пляжных лежаков с интерактивной картой и административной панелью.

## 🚀 Основные возможности

- **Для пользователей:**
  - Поиск пляжей по геолокации
  - Интерактивная карта лежаков
  - Онлайн-бронирование с выбором времени
  - История бронирований
  - Real-time обновления доступности

- **Для администраторов:**
  - Управление пляжами и лежаками
  - Визуальный редактор расположения лежаков
  - Статистика и аналитика
  - Управление бронированиями

## 🛠 Технологический стек

### Frontend
- HTML5, CSS3, JavaScript (ES6+)
- Leaflet.js для карт
- Socket.io для real-time обновлений
- Chart.js для графиков в админке

### Backend
- Node.js + Express
- PostgreSQL (основная БД)
- Redis (кэширование)
- JWT для аутентификации
- Socket.io для WebSocket

### Инфраструктура
- Docker и Docker Compose
- Nginx (веб-сервер)
- PM2 (production)

## 📋 Требования

- Node.js 16+
- PostgreSQL 13+
- Redis 6+
- Docker (опционально)

## 🚀 Быстрый старт

### 1. Клонирование репозитория
```bash
git clone [repository-url]
cd beach-booking-platform
```

### 2. Установка зависимостей
```bash
npm install
```

### 3. Настройка окружения
```bash
cp backend/.env.example backend/.env
# Отредактируйте .env файл с вашими настройками
```

### 4. Запуск с Docker
```bash
docker-compose up -d
```

### 5. Запуск без Docker

#### База данных
```bash
# Создайте базу данных PostgreSQL
createdb beach_booking

# Запустите Redis
redis-server
```

#### Backend
```bash
npm run server
```

#### Frontend
```bash
npm run client
```

## 📁 Структура проекта

```
beach-booking-platform/
├── frontend/                # Frontend приложение
│   ├── index.html          # Главная страница
│   ├── admin.html          # Админ-панель
│   ├── css/                # Стили
│   ├── js/                 # JavaScript
│   └── assets/             # Изображения и иконки
├── backend/                 # Backend приложение
│   ├── server.js           # Точка входа
│   ├── controllers/        # Контроллеры
│   ├── models/             # Модели данных
│   ├── routes/             # API маршруты
│   ├── middleware/         # Middleware
│   └── config/             # Конфигурация
├── docker-compose.yml      # Docker конфигурация
├── Dockerfile              # Docker образ
└── package.json            # NPM зависимости
```

## 🔑 API Endpoints

### Аутентификация
- `POST /api/auth/register` - Регистрация
- `POST /api/auth/login` - Вход
- `GET /api/auth/me` - Текущий пользователь

### Пляжи
- `GET /api/beaches` - Список пляжей
- `GET /api/beaches/nearby` - Ближайшие пляжи
- `GET /api/beaches/:id` - Информация о пляже

### Лежаки
- `GET /api/beaches/:beachId/loungers` - Лежаки пляжа
- `GET /api/loungers/:id/availability` - Доступность лежака

### Бронирования
- `POST /api/bookings` - Создать бронирование
- `GET /api/bookings/my` - Мои бронирования
- `PUT /api/bookings/:id/cancel` - Отменить бронирование

## 👥 Роли пользователей

- **user** - обычный пользователь
- **moderator** - модератор (управление пляжами)
- **admin** - администратор (полный доступ)

## 🔐 Безопасность

- Пароли хешируются с bcrypt
- JWT токены для аутентификации
- CORS настройки
- Rate limiting
- Параметризованные SQL запросы

## 🚀 Production деплой

1. Настройте SSL сертификаты в `nginx/ssl/`
2. Обновите `docker-compose.yml` для production
3. Используйте переменные окружения для секретов
4. Настройте резервное копирование БД

## 📝 Лицензия

MIT License

## 👨‍💻 Разработка

### Запуск в режиме разработки
```bash
npm run dev:all
```

### Тестирование
```bash
npm test
```

### Линтинг
```bash
npm run lint
```