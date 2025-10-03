# PosPro Shop Frontend

Современный интерфейс для интернет-магазина PosPro Shop, построенный на Next.js 14 с TypeScript.

## Возможности

- 🛍️ Каталог товаров с фильтрацией и поиском
- 🛒 Корзина покупок
- ❤️ Избранное
- 👤 Личный кабинет пользователя
- 📱 Адаптивный дизайн
- 🎨 Современный UI с Tailwind CSS
- 🔐 Аутентификация и авторизация
- 📋 Управление заказами

## Технологии

- **Next.js 14** - React фреймворк
- **TypeScript** - типизация
- **Tailwind CSS** - стилизация
- **Radix UI** - компоненты интерфейса
- **React Hook Form** - формы
- **Framer Motion** - анимации
- **Lucide React** - иконки

## Установка и запуск

### Локальная разработка

1. Клонируйте репозиторий:
```bash
git clone <repository-url>
cd pospro_new_ui
```

2. Установите зависимости:
```bash
npm install
# или
yarn install
# или
pnpm install
```

3. Настройте переменные окружения (опционально):
```bash
# Скопируйте пример файла
cp env.local.example .env.local

# Для локальной разработки (по умолчанию используется Render сервер)
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:5000

# Для продакшена (по умолчанию)
NEXT_PUBLIC_API_BASE_URL=https://pospro-new-server.onrender.com
```

4. Запустите сервер разработки:
```bash
npm run dev
# или
yarn dev
# или
pnpm dev
```

Откройте [http://localhost:3000](http://localhost:3000) в браузере.

### Сборка для продакшена

```bash
npm run build
npm run start
```

### Статическая сборка (для Render)

```bash
npm run build
```

Статические файлы будут в папке `out/`.

## Структура проекта

```
pospro_new_ui/
├── app/                    # App Router (Next.js 14)
│   ├── admin/             # Админ панель
│   ├── auth/              # Аутентификация
│   ├── profile/           # Профиль пользователя
│   ├── brand/             # Страницы брендов
│   ├── category/          # Страницы категорий
│   ├── product/           # Страницы товаров
│   ├── layout.tsx         # Основной layout
│   └── page.tsx           # Главная страница
├── components/            # React компоненты
│   ├── ui/               # Базовые UI компоненты
│   ├── forms/            # Формы
│   ├── layout/           # Компоненты макета
│   └── ...
├── lib/                  # Утилиты и конфигурация
│   ├── api-client.ts     # API клиент
│   ├── api-address.ts    # Настройки API
│   ├── utils.ts          # Утилиты
│   └── constants.ts      # Константы
├── context/              # React контексты
│   ├── auth-context.tsx  # Контекст аутентификации
│   └── cart-context.tsx  # Контекст корзины
├── hooks/                # Кастомные хуки
├── public/               # Статические файлы
└── styles/               # Глобальные стили
```

## Основные страницы

### Публичные страницы
- `/` - Главная страница
- `/category/[slug]` - Страница категории
- `/brand/[brand]` - Страница бренда
- `/product/[id]` - Страница товара

### Пользовательские страницы
- `/auth/login` - Вход
- `/auth/register` - Регистрация
- `/profile` - Профиль пользователя
- `/profile/orders` - История заказов
- `/profile/favorites` - Избранное

### Админ панель
- `/admin` - Главная админ панели
- `/admin/products` - Управление товарами
- `/admin/categories` - Управление категориями
- `/admin/orders` - Управление заказами
- `/admin/banners` - Управление баннерами

## API интеграция

Frontend взаимодействует с backend API через:
- `lib/api-client.ts` - основной API клиент
- `lib/api-address.ts` - настройки адресов API
- `lib/server-api.ts` - серверные API вызовы

## Переменные окружения

- `NEXT_PUBLIC_API_BASE_URL` - Базовый URL backend API
  - По умолчанию: `https://pospro-new-server.onrender.com`
  - Для локальной разработки: `http://127.0.0.1:5000`

## Стилизация

Проект использует:
- **Tailwind CSS** для утилитарных стилей
- **Radix UI** для доступных компонентов
- **CSS Modules** для локальных стилей
- **Framer Motion** для анимаций

## Развертывание

### На Render (статический сайт)

1. Создайте Static Site на Render
2. Подключите репозиторий `POSPRO_NEW_UI`
3. Настройте переменную окружения:
   ```
   NEXT_PUBLIC_API_BASE_URL=https://pospro-new-server.onrender.com
   ```
4. Build Command: `npm run build`
5. Publish Directory: `out`

### На Vercel

```bash
npm install -g vercel
vercel
```

## Лицензия

MIT License