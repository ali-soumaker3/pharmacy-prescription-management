# Спецификация проекта: Аптека ИИ (Pharmacy & Prescription Management)

**Курс:** Generative AI · ISE MNU · Fall 2026  
**Язык интерфейса и ответов ИИ:** Русский  
**Подход:** Lightweight Spec-Driven Development (KISS — минимум инфраструктуры, максимум надёжности на 7-минутном демо)

---

## 1. Цель и границы (Scope)

### Входит в MVP
1. **Приём рецепта от пациента (Web UI):** ввод ФИО, телефона, аллергий, текста рецепта и/или загрузка фотографии бланка рецепта.
2. **ИИ-разбор рецепта (n8n + OpenRouter):** извлечение препаратов, дозировок, схемы и длительности приёма в строгий JSON; распознавание фото рецепта (Vision).
3. **Проверка склада и подбор аналогов (Supabase + AI):** сопоставление распознанных препаратов с реальной таблицей `medications`; расчёт суммы в `₸`; предложение аналога (дженерика) **только из препаратов в наличии** по действующему веществу, если оригинала нет на складе.
4. **Проверка безопасности (AI Guardrails):**
   - проверка конфликта с аллергиями пациента (`severity: "high"`);
   - проверка потенциальных лекарственных взаимодействий и правил приёма (например, НПВС после еды);
   - генерация понятной памятки пациенту на русском языке;
   - обязательный медицинский дисклеймер.
5. **Human-in-the-Loop (Telegram + Web-панель фармацевта):**
   - если в рецепте есть рецептурный препарат (`Rx`) или критичное предупреждение (`high`), заказ получает статус `pending_approval` и уходит фармацевту в Telegram с inline-кнопками **`Одобрить`** / **`Отклонить`**;
   - фармацевт может принять решение как в Telegram, так и в веб-панели;
   - при одобрении статус меняется на `approved`, а остатки (`stock_qty`) списываются в Supabase.
6. **Резервная отказоустойчивость демо:** если университетский `n8n` недоступен во время защиты, серверный роут Vercel автоматически переключается на резервный прямой вызов OpenRouter (или локальный демо-режим).

### Сознательно НЕ делаем (Non-Goals)
- Авторизация/регистрация пользователей и ролевой RBAC.
- Онлайн-оплата, эквайринг и фискальные чеки.
- gRPC, микросервисы и монорепозиторий.
- Постановка медицинских диагнозов и самостоятельное назначение лечения ИИ.

---

## 2. Архитектура и потоки данных

```text
[Браузер (Пациент / Фармацевт)]
        │  HTTPS (same-origin, 0 проблем с CORS)
        ▼
[Next.js App Router + API Routes на Vercel]
   ├── GET  /api/orders               ──► Supabase (medications + orders)
   ├── POST /api/prescriptions/analyze ──► n8n Webhook #1 (ai2.mnu.kz)
   │                                         ├─► OpenRouter (Vision/LLM, JSON)
   │                                         ├─► Supabase (insert into orders)
   │                                         └─► Telegram Bot (карточка + кнопки Rx)
   └── POST /api/orders/[id]/decision  ──► n8n Webhook #2 (ai2.mnu.kz)
                                             ├─► Supabase (update order + stock_qty)
                                             └─► Telegram Bot (подтверждение решения)

[Фармацевт в Telegram]
   └── Нажатие inline-кнопки (approve:<id> / reject:<id>)
        ▼
[n8n Workflow #2 (Telegram Trigger)]
   ├──► Supabase (update orders.status + списание stock_qty)
   └──► Telegram (редактирование сообщения: «Одобрено / Отклонено»)
```

### Хранение секретов
- `.env.example` в Git — только имена переменных (без секретов).
- `.env.local` локально — в `.gitignore`.
- Продакшн-переменные веб-части — в **Vercel Environment Variables**.
- Ключи OpenRouter, Telegram Bot Token и Supabase Service Role Key для workflow — в **n8n Credentials**.

---

## 3. Модель данных (`Supabase`)

Источник схемы: `supabase/schema.sql`.

### Таблица `public.medications`
| Поле | Тип | Описание |
|---|---|---|
| `id` | `text` PK | Идентификатор препарата (`med-amox-500`) |
| `name` | `text` | Торговое название и дозировка |
| `active_ingredient` | `text` | Действующее вещество (для подбора аналогов) |
| `dosage` | `text` | Форма выпуска |
| `price_kzt` | `integer` | Цена в тенге (`>= 0`) |
| `stock_qty` | `integer` | Остаток упаковок (`>= 0`) |
| `requires_prescription` | `boolean` | `true` = рецептурный (`Rx`), `false` = без рецепта (`OTC`) |

### Таблица `public.orders`
| Поле | Тип | Описание |
|---|---|---|
| `id` | `uuid` PK | Уникальный ID заказа |
| `order_code` | `text` UNIQUE | Короткий код для демо (`RX-1042`) |
| `patient_name` | `text` | ФИО пациента |
| `patient_phone` | `text` | Контактный телефон |
| `allergies` | `text` | Аллергии пациента |
| `raw_prescription` | `text` | Исходный текст рецепта / пометка о фото |
| `status` | `text` | `pending_approval` \| `approved` \| `rejected` \| `ready_for_pickup` |
| `requires_pharmacist_approval` | `boolean` | Нужен ли шаг подтверждения фармацевтом |
| `total_kzt` | `integer` | Сумма по позициям в наличии |
| `medications` | `jsonb` | Массив `ParsedMedication[]` |
| `safety_warnings` | `jsonb` | Массив `SafetyWarning[]` |
| `patient_instructions` | `text` | Памятка пациенту на русском языке |
| `pharmacist_note` | `text` NULL | Комментарий фармацевта при одобрении/отклонении |
| `created_at` | `timestamptz` | Время создания |

### Правило списания остатков
- При переходе заказа из `pending_approval` → `approved` (единоразово, с защитой от повторного нажатия) для каждой позиции с `in_stock: true` и `matched_medication_id != null` значение `medications.stock_qty` уменьшается на `1` (не ниже `0`).
- При `rejected` остатки не изменяются.

---

## 4. Контракты API и ИИ

Источник типов: `src/lib/schemas.ts`.

### 4.1 `POST /api/prescriptions/analyze`
**Вход (JSON):**
```json
{
  "patientName": "Айсана Батырова",
  "patientPhone": "+7 707 412 88 90",
  "allergies": "Пенициллин",
  "prescriptionText": "Rp: Амоксициллин 500 мг...",
  "imageDataUrl": "data:image/jpeg;base64,... | null"
}
```
- Валидация: `patientName` ≥ 2 символа, `patientPhone` ≥ 6 символов, заполнено хотя бы одно из полей `prescriptionText` или `imageDataUrl`.
- Проксирует в `N8N_ANALYZE_WEBHOOK_URL` вместе с актуальным списком `inventory` из Supabase.

**Выход (`200 OK`, строгий JSON по `PrescriptionAnalysisResultSchema`):**
```json
{
  "order_id": "uuid",
  "order_code": "RX-4821",
  "status": "pending_approval",
  "source": "n8n",
  "patient_name": "Айсана Батырова",
  "patient_phone": "+7 707 412 88 90",
  "allergies": "Пенициллин",
  "medications": [
    {
      "prescribed_name": "Амоксициллин 500 мг",
      "dosage": "500 мг",
      "schedule": "2 раза в день",
      "duration": "7 дней",
      "requires_prescription": true,
      "in_stock": true,
      "matched_medication_id": "med-amox-500",
      "matched_medication_name": "Амоксициллин 500 мг",
      "price_kzt": 1850,
      "alternative_suggestion": null
    }
  ],
  "safety_warnings": [
    {
      "severity": "high",
      "title": "Риск аллергии на пенициллины",
      "details": "У пациента указана аллергия на пенициллин, при этом назначен амоксициллин."
    }
  ],
  "patient_instructions": "Не начинайте приём до согласования замены с врачом и фармацевтом.",
  "total_kzt": 1850,
  "requires_pharmacist_approval": true,
  "disclaimer": "Информация носит справочный характер и не заменяет консультацию врача...",
  "created_at": "2026-11-27T08:00:00.000Z"
}
```

### 4.2 `GET /api/orders`
Возвращает `{ mode, supabaseConnected, n8nConfigured, orders, inventory }`. Панель фармацевта поддерживает ручное и автоматическое обновление (polling), чтобы изменения из Telegram отображались на экране без перезагрузки страницы.

### 4.3 `POST /api/orders/[id]/decision`
**Вход (JSON):**
```json
{
  "decision": "approve",
  "pharmacistNote": "Замена согласована с врачом"
}
```
**Выход (`200 OK`):** `{ id, status, pharmacist_note, source }`.

### 4.4 Telegram Inline Callback (n8n Workflow #2)
- Формат `callback_data`: `approve:<order_id>` и `reject:<order_id>`.
- При получении callback n8n проверяет, что заказ ещё в статусе `pending_approval`, обновляет `orders.status`, при `approve` списывает `stock_qty` и обновляет сообщение в Telegram (убирает кнопки, дописывает итог).

---

## 5. Правила безопасности ИИ (Guardrails)

1. **Запрет на выдумывание товаров и цен:** LLM получает массив `inventory` в промпте и обязана выставлять `in_stock: true` и `price_kzt` **только** при совпадении с переданным каталогом.
2. **Обязательная валидация ответа LLM:** любой ответ OpenRouter/n8n валидируется через `PrescriptionAnalysisResultSchema` (Zod) на сервере до показа пациенту.
3. **Human-in-the-Loop Gate:** `requires_pharmacist_approval = true` всегда, если:
   - хотя бы один препарат имеет `requires_prescription: true`, ИЛИ
   - есть хотя бы одно предупреждение с `severity: "high"`.
4. **Медицинский дисклеймер:** выводится в каждом ответе анализа.

---

## 6. Критерии приёмки (Тест-кейсы)

| ID | Сценарий | Входные данные | Ожидаемый результат |
|---|---|---|---|
| **TC-1** | Рецептурный заказ + подбор аналога | Текст: «Амоксициллин 500 мг, Нурофен Форте 400 мг, Омепразол 20 мг», аллергии: нет | Амоксициллин и Омепразол `in_stock: true`; Нурофен Форте `in_stock: false` + предложен аналог «Ибупрофен 400 мг (980 ₸)»; статус `pending_approval`; приходит карточка в Telegram |
| **TC-2** | Конфликт с аллергией | Текст: «Амоксициллин 500 мг», аллергии: «Пенициллин» | Появляется предупреждение `severity: "high"` про риск аллергии на пенициллины; `requires_pharmacist_approval: true` |
| **TC-3** | Распознавание фото рецепта (Vision) | Фото печатного/разборчивого рецепта без текста | OpenRouter (Vision) извлекает препараты и дозировки в JSON, заказ создаётся в Supabase |
| **TC-4** | Безрецептурный заказ (OTC) | Текст: «Парацетамол 500 мг, Цетиризин 10 мг», аллергии: нет | Все препараты `requires_prescription: false`, нет `high`-предупреждений → статус сразу `ready_for_pickup` |
| **TC-5** | Подтверждение фармацевтом в Telegram | Нажатие кнопки `✅ Одобрить` в Telegram для заказа из TC-1 | Статус заказа в Supabase меняется на `approved`, `stock_qty` по выданным препаратам уменьшается на 1, на сайте статус обновляется без перезагрузки |
| **TC-6** | Отклонение фармацевтом + неизвестный препарат | Несуществующий препарат или нажатие `❌ Отклонить` | Несуществующий препарат не выдумывается (`in_stock: false`, `price_kzt: null`); при отклонении статус `rejected`, склад не списывается |

---

## 7. Definition of Done (Готовность к защите на «отлично»)

- [ ] Репозиторий задеплоен на **Vercel** по публичному HTTPS-URL, без ошибок CORS в консоли браузера.
- [ ] Таблицы `medications` и `orders` развёрнуты в **Supabase** с тестовым каталогом.
- [ ] Оба workflow активны в университетском **n8n (`ai2.mnu.kz`)** и используют **OpenRouter** + **Supabase** + **Telegram**.
- [ ] Пройдены все 6 тест-кейсов (`TC-1` – `TC-6`), зафиксировано среднее время ответа.
- [ ] Работает резервный OpenRouter-фолбэк на случай недоступности `ai2.mnu.kz`.
- [ ] Подготовлен поминутный сценарий 7-минутной защиты (4–5 мин демо + 2–3 мин Q&A) и короткое резервное видео демо.
