# Аптека ИИ — Управление рецептами и заказами

Веб-приложение и автоматизация для учебного проекта **Pharmacy & Prescription Management** (Generative AI · ISE MNU).

## Архитектура

- **Frontend + API Proxy (`Next.js App Router` + `TypeScript` + `Tailwind CSS` → Vercel):**
  - Вкладка **«Проверка рецепта»**: загрузка текста или фото рецепта, указание аллергий, ИИ-разбор препаратов, проверка наличия, подбор аналогов и предупреждения безопасности.
  - Вкладка **«Панель фармацевта»**: очередь рецептурных заказов и подтверждение/отклонение (Human-in-the-Loop).
  - Вкладка **«Склад аптеки»**: каталог препаратов, отпуск (`Rx`/`OTC`), цены в `₸` и остатки.
  - Серверные роуты `/api/prescriptions/analyze`, `/api/orders`, `/api/orders/[id]/decision` проксируют запросы в `n8n` и `Supabase` без CORS-ошибок в браузере.
- **База данных (`Supabase`):** таблицы `medications` и `orders` (`supabase/schema.sql`).
- **AI & Автоматизация (`n8n` на `ai2.mnu.kz` + `OpenRouter` + `Telegram`):** шаблоны для импорта лежат в папке `n8n/`.

## Быстрый старт локально

1. Установите зависимости:
   ```bash
   pnpm install
   ```
2. Скопируйте `.env.example` в `.env.local` и заполните ключи Supabase и URL вебхуков `n8n`:
   ```bash
   cp .env.example .env.local
   ```
3. В Supabase откройте **SQL Editor** и выполните содержимое файла `supabase/schema.sql`.
4. Запустите проект:
   ```bash
   pnpm dev
   ```
   Приложение работает и без заполненных ключей — в локальном демо-режиме на тестовых данных.

## Настройка n8n (`ai2.mnu.kz`)

1. Импортируйте `n8n/workflow-analyze-prescription.json` и `n8n/workflow-pharmacist-approval.json`.
2. В ноде **OpenRouter: Разбор рецепта** создайте credential типа **Header Auth**:
   - Name: `Authorization`
   - Value: `Bearer <OPENROUTER_API_KEY>`
3. Добавьте ноды **Supabase** (сохранение/обновление таблицы `orders`) и **Telegram** (уведомление фармацевту с кнопками `Одобрить` / `Отклонить`).
4. Активируйте workflow и пропишите их production URL в переменные `N8N_ANALYZE_WEBHOOK_URL` и `N8N_APPROVE_WEBHOOK_URL` в `.env.local` и на Vercel.

## Проверки

```bash
pnpm typecheck
pnpm lint
pnpm build
```
