# Импорт объектов из PDF застройщиков — дизайн

**Дата:** 2026-06-03
**Статус:** утверждён к реализации (ожидает финального ревью спеки)

## Проблема

Застройщики, с которыми у агентства подписаны договоры, присылают инвентарь
в виде **PDF-брошюр/прайс-листов через WhatsApp**. Сейчас агент вручную
переносит данные на сайт worldwise.pro. Нужен механизм, который сократит этот
труд: извлекает объекты из PDF (поля + фото) и даёт опубликовать их на сайт
после быстрой ручной проверки.

## Решения (зафиксированы в брейншторме)

| Развилка | Выбор |
| --- | --- |
| Источник | PDF-брошюры застройщиков |
| Канал доставки | WhatsApp → **ручной форвард** (агент скачивает PDF и грузит сам). Интеграция WhatsApp НЕ делается. |
| Точка входа | **Встроено в существующую `/admin`** (страница со списком объектов), без новой вкладки в `AdminNav` |
| Движок извлечения полей | **Gemini multimodal** по PDF (`inlineData`, `application/pdf`), модель `gemini-2.5-flash` |
| Сценарий публикации | **Стейджинг + апрув**: AI создаёт черновики → оператор правит/одобряет → публикация |
| Фото | Извлекаются из PDF: **`pdfimages` (встроенные) с fallback на `pdftoppm` (рендер страниц)**, оператор отмечает нужные |

## Принцип

AI только **предзаполняет** черновик. На публичный сайт данные уходят **только
после ручного апрува** — защита от неверно считанной цены/площади (PDF —
ненадёжный источник).

## Поток end-to-end

1. Агент получает PDF в WhatsApp → скачивает на устройство.
2. На `/admin` жмёт **«Import from PDF»** → выбирает файл.
3. `POST /api/admin/import`:
   - валидирует PDF по magic-bytes (`%PDF`) и лимиту размера;
   - **Gemini** извлекает `1..N` объектов → поля `Property`;
   - **`pdfimages`** вытаскивает встроенные картинки (fallback `pdftoppm`), фильтрует мелочь → пул кандидатов;
   - сохраняет `PropertyDraft[]` в `data/property-drafts.json`, картинки во `public/images/imports/<draftId>/`.
4. На `/admin` появляется панель **«Pending imports»** с карточками-черновиками.
5. Оператор по каждому черновику:
   - **Edit** → `/admin/property/new?draft=<draftId>` (существующий `PropertyForm`, предзаполнен), правит поля, отмечает нужные фото из кандидатов, добавляет свои при желании;
   - **Publish** → быстрая публикация без правок (если данные полные);
   - **Reject** → удалить черновик.
6. Публикация: выбранные картинки переносятся `imports/<draftId>/` → `properties/<id>/`,
   запись через `coercePropertyInput()` → `createProperty()`; черновик удаляется;
   публичные страницы ревалидируются (механизм уже есть в проекте).

## Компоненты

### 1. `lib/property-extract.ts` (server-only)

- `extractPropertiesFromPdf(buf: Buffer): Promise<Partial<Property>[]>`
- Вызывает Gemini `gemini-2.5-flash` (`generativelanguage.googleapis.com/v1beta`,
  `inlineData` с `mimeType: 'application/pdf'`), строгий JSON-промпт.
- Маппит в поля `Property`: `title, developer, area, type, status, priceAed,
  bedrooms, pricePerSqft, paymentPlan, completionDate, description,
  shortDescription, amenities`.
- Промпт требует: «не угадывай — если поля нет в PDF, верни null». Никаких
  выдуманных значений.
- Опц. fallback: при пустом/ошибочном ответе — markitdown PDF→текст → повтор
  запроса по тексту (дешевле токенов, для чисто текстовых PDF).

### 2. `lib/pdf-images.ts` (server-only)

- `extractImagesFromPdf(buf, draftId): Promise<string[]>` — пути сохранённых кандидатов.
- Через `child_process`:
  1. `pdfimages -all <tmp.pdf> <out>` → встроенные растры;
  2. фильтр: отбросить картинки меньше порога (сторона < ~600px **или** размер < ~50 КБ) — отсекает логотипы/иконки;
  3. если пригодных 0 → fallback `pdftoppm -jpeg -r 150 <tmp.pdf> <out>` (страницы целиком);
  4. нормализовать в web-safe JPEG (учесть CMYK через флаги poppler).
- Сохраняет во `public/images/imports/<draftId>/`.

### 3. `lib/property-drafts.ts` (по образцу `lib/dynamic-articles.ts`)

- Хранилище `data/property-drafts.json` = `PropertyDraft[]`.
- `PropertyDraft = { draftId: string; fields: Partial<Property>;
  imageCandidates: string[]; sourcePdf: string; extractedAt: string;
  status: 'pending' }`.
- API: `listDrafts`, `getDraft`, `updateDraft`, `deleteDraft`, `publishDraft`.
- `publishDraft(draftId, finalFields, selectedImages)`:
  - переносит `selectedImages` из `imports/<draftId>/` в `properties/<newId>/`;
  - `coercePropertyInput(finalFields, { partial:false })` → `createProperty()`;
  - удаляет черновик и остаточные файлы `imports/<draftId>/`.
- Все записи — через `writeFileAtomic`.

### 4. API-маршруты (все под `requireSection('properties')` → 403)

| Маршрут | Назначение |
| --- | --- |
| `POST /api/admin/import` | приём PDF, извлечение полей+фото, запись черновиков |
| `GET /api/admin/import` | список черновиков (для панели) |
| `PUT /api/admin/import/[draftId]` | правка полей черновика |
| `DELETE /api/admin/import/[draftId]` | отклонить черновик (+ чистка `imports/<draftId>/`) |
| `POST /api/admin/import/[draftId]/publish` | опубликовать (поля + выбранные фото) |

Guard на **каждом** суб-роуте (не только индексе) — инвариант проекта.

### 5. UI: интеграция в `/admin`

- Новый клиентский компонент `app/admin/ImportPanel.tsx`:
  - кнопка **«Import from PDF»** рядом с «+ Add Property»;
  - аплоад → `POST /api/admin/import` → обновление списка черновиков;
  - панель **«Pending imports»** (рендерится только при наличии черновиков),
    над таблицей Properties; карточки: title/developer/area/price + фото-кандидаты
    (чекбоксы) + кнопки **Edit / Publish / Reject**.
- `PropertyForm` получает опциональный префилл: при `?draft=<id>` подтягивает
  поля и `imageCandidates` черновика как начальные значения; после успешного
  `createProperty` дёргает публикацию/удаление черновика.
- `AdminNav` не меняется.

## Что НЕ делаем (YAGNI / scope)

- ❌ Интеграция с WhatsApp (выбран ручной форвард).
- ❌ Полная автопубликация без ревью.
- ❌ Авто-маппинг «картинка → конкретный объект» при нескольких объектах в одном
  PDF (кандидаты идут в общий пул, оператор распределяет).
- ❌ Массовый импорт сотен юнитов из availability-таблиц (старт: проект/объект на черновик).
- ❌ Постобработка изображений через `sharp` (обходимся выводом poppler).

## Инварианты проекта, которые соблюдаем

- Запись в JSON — только через `writeFileAtomic`.
- Публикация — через `coercePropertyInput()` + `createProperty()` (не лить сырой
  ответ AI в `properties.json`).
- Картинки — только в `public/images/`; финал в `public/images/properties/<id>/`.
- Каждый API-роут под секцией `properties`.
- PDF-загрузка валидируется по magic-bytes, как `/api/upload` для картинок.
- Gemini-ключ только на сервере (`.env.local`), не на клиенте.
- Никакой БД; один PM2-инстанс.

## Новые зависимости

- **poppler-utils** — системный бинарь (`apt-get install poppler-utils` на Hetzner,
  `brew install poppler` локально). НЕ npm-пакет с нативными биндингами → запрет
  из CLAUDE.md (про Edge-runtime C++ addons) не нарушается; вызывается из Node API-роута.
- Деплой: добавить `poppler-utils` в подготовку сервера (разово).

## Проверка корректности (как поймём, что работает)

- `npm run build` проходит.
- Локально: загрузить реальный PDF застройщика на `/admin` → в «Pending imports»
  появляются черновик(и) с разумно заполненными полями и фото-кандидатами без
  логотипов → Edit → Publish → объект виден на `/properties/[slug]` с фото из PDF.
- Negative: не-PDF файл и PDF без объектов обрабатываются без падения (понятная ошибка).
- Юнит-тесты для чистых хелперов (фильтр картинок по размеру, маппинг полей
  Gemini→Property) в духе `lib/*.test.ts`.
