# Google Ads — фиксы запуска + отслеживание конверсий

**Дата:** 2026-06-09 · **Контекст:** Search-кампания запущена (первые часы: 18 показов, 1 клик). Анализ живой страницы (claude.ai-chrome) выявил: (1) **критично** — конверсия «Отправка формы…» = «Неверная конфигурация»; (2) мусорный трафик (нужны минус-слова); (3) весь трафик в группу A; (4) Google навязывает Display/Search Partners.

**Ключевой технический факт (из кода сайта):** GA4 грузится только **после согласия на cookies** (`Analytics.tsx` ждёт `ww_consent_accepted`) → событие `lead_form_submit` срабатывает не у всех → **GA4-конверсии недосчитывают**. НО захват `gclid`/`utm_*` (`components/UtmCapture.tsx`) **не привязан к согласию** — он пишется в каждый лид и в CSV всегда. Поэтому надёжный учёт = **Offline Conversion Import по gclid** (раздел C).

---

## A. Промт для claude.ai-chrome (вставить в браузерный Claude с доступом к Google Ads + GA4)

> **КОНТЕКСТ.** Рекламный аккаунт worldwise.pro — недвижимость Дубай. Запущена Google Search кампания (группы A — Buyer-intent, B — Investor/ROI/Golden Visa, C — Brand). Цель — лиды с форм сайта. На сайте GA4 грузится ТОЛЬКО после согласия на cookies; событие конверсии = `lead_form_submit`. Сайт уже захватывает `gclid` и `utm_*` в каждый лид (CRM `/admin/leads` → строка Attribution; и CSV-экспорт). Подтверждай каждое изменение, ничего не удаляй, НЕ повышай бюджет, НЕ включай Display и Search Partners. Если шаг блокирован правами — не ломай, опиши, что нужно от владельца.
>
> **ЗАДАЧА 1 — КРИТИЧНО: починить конверсии** (сейчас «Misconfigured»):
> 1. GA4 → Admin → Events: собирается ли `lead_form_submit`? Если нет — открой сайт, **прими cookies**, отправь тестовую заявку (`/guide` или `/mortgage-calculator`), проверь в GA4 Realtime/DebugView. Без согласия событие не сработает — так устроен сайт.
> 2. GA4 → Admin → Key events: пометь `lead_form_submit` как Key event.
> 3. GA4 → Admin → Product links → Google Ads: связать аккаунт, если не связан.
> 4. Google Ads → Goals → Conversions → New → Import → Google Analytics 4 (Web): импортируй `lead_form_submit`, поставь **Primary**. Сломанную старую цель → Secondary (не удалять).
> 5. Включи Enhanced Conversions for Leads, если доступно.
> 6. Убедись: статус сменился с «Misconfigured» на «Recording»/«No recent conversions».
> 7. Отметь владельцу: из-за cookie-согласия GA4-конверсии недосчитают; надёжный путь — Offline Conversion Import по `gclid` (уже пишется в лид/CSV).
>
> **ЗАДАЧА 2 — минус-слова на уровне кампании:** `price, prices, rupees, bhk, "1 bhk", "2 bhk", villa, villas, land, "burj khalifa", cheap, salary, jobs, rent, "for rent"`. Проверь привязку к кампании.
>
> **ЗАДАЧА 3 — отклонить авто-рекомендации:** Dismiss «Search Partners» и «Display Network». Подтверди Networks → Search only.
>
> **ЗАДАЧА 4 — типы соответствия:** мусор тянет phrase `"dubai property for sale"`. Пока не паузь; если после минус-слов продолжится — сузь грязные phrase до exact. Отметь владельцу.
>
> **НЕ ДЕЛАЙ:** Display/Partners, рост бюджета, смену стратегии ставок (Manual CPC до конверсий), удаление ключей/кампаний.
>
> **ОТЧЁТ:** (1) статус конверсии после правок; (2) добавленные минус-слова; (3) что отклонил; (4) что требует владельца (доступы, OCI).

---

## B. Чек-лист отслеживания конверсий (GA4 → Google Ads)

1. **Событие есть в GA4** — `lead_form_submit` виден в Events/Realtime (после согласия + тестовой отправки).
2. **Key event** — помечен в GA4 Admin → Key events.
3. **Линк GA4 ↔ Google Ads** — Admin → Product links.
4. **Импорт в Ads** — Conversions → Import → GA4 Web → `lead_form_submit` → **Primary**.
5. **Enhanced Conversions for Leads** — включить (хэш email/phone, улучшает матчинг).
6. **Статус** — «Recording», не «Misconfigured».
7. **Сверка GA ID** — `NEXT_PUBLIC_GA_ID` сайта = тот же GA4-ресурс, что линкуется.

**Ограничение:** п.1–6 покрывают только согласившихся на cookies. Тех, кто отклонил, ловит только раздел C.

---

## C. Offline Conversion Import (OCI) по gclid — надёжный, не зависит от cookie-согласия

**Почему работает:** `gclid` мы кладём в лид при заходе с рекламы **до и независимо от** cookie-баннера. Значит в CSV-экспорте лидов (`/admin/leads` → Export) у каждого ad-лида есть `gclid`. Его можно загрузить в Google Ads как офлайн-конверсию — это считает даже тех, кого GA4 пропустил, и даёт «правду» по факту квалификации/сделки.

**Настройка (один раз):**
1. Google Ads → Goals → Conversions → **New conversion action** → **Import** → **CRMs, files or other data sources** → **Track conversions from clicks**.
2. Создай действия (можно несколько по воронке): например `CRM Lead` (Count: One, окно 90 дней) и `CRM Qualified` / `CRM Deal` (с Value, валюта AED). Для оптимизации лучше грузить именно качественную стадию (Qualified/Deal), а не сырой лид.

**Загрузка (еженедельно):**
1. Экспортируй лиды из CRM (`/admin/leads` → Export CSV). В файле есть колонки `gclid`, `createdAt`, `status`.
2. Отфильтруй строки, где `gclid` не пуст И лид достиг нужной стадии (например `status = won` для `CRM Deal`, или квалифицирован).
3. Сформируй файл загрузки по шаблону Google Ads (Goals → Conversions → **Uploads** → шаблон):
   ```
   Parameters:TimeZone=+0400
   Google Click ID,Conversion Name,Conversion Time,Conversion Value,Conversion Currency
   Cj0KCQ...gclid...,CRM Qualified,2026-06-15 14:30:00,0,AED
   Cj0KCQ...gclid...,CRM Deal,2026-06-18 11:00:00,50000,AED
   ```
   - `Conversion Time` — момент достижения стадии (или `createdAt` для сырого лида), формат `yyyy-MM-dd HH:mm:ss`, таймзона из строки Parameters (Dubai = `+0400`).
   - `Conversion Value` — комиссия/ценность сделки (для `Deal`); для лида можно 0.
4. Google Ads → Goals → Conversions → **Uploads** → Upload файл → Preview → Apply.

**Правила:**
- Грузить **в пределах окна** (по умолчанию gclid-клик не старше ~90 дней; время конверсии — после клика).
- Раз в неделю догружать новые квалифицированные/сделки — Google «дообучается» на реальном качестве.
- Не дублировать одну и ту же (gclid + Conversion Name + Time) дважды.

**Альтернатива/дополнение:** Enhanced Conversions for Leads (матчинг по хэшу email/phone из лида) — включить в дополнение к OCI; они усиливают друг друга.

**Что это даёт:** честный CPL/cost-per-deal по реальным закрытиям, учёт declined-cookies аудитории, и базу для перехода на Target CPA / Maximize Conversions, когда накопится 15–30 конверсий.

---

## D. Минус-слова и чего НЕ принимать

**Добавить (campaign-level):** `price, prices, rupees, bhk, "1 bhk", "2 bhk", villa, villas, land, "burj khalifa", cheap, salary, jobs, rent, "for rent"` — поверх общего списка из `2026-06-08-google-search-starter-kit.md` §3.

**НЕ принимать рекомендации Google:** «Expand with Search Partners», «Display Network» — противоречат стратегии (Search-only). Dismiss.

**Бюджет ~52 AED/день** в дорогой нише — скромно, охват ограничен («допущены к показу ограниченной аудитории») — это ожидаемо; не повышать, пока не заработают конверсии и не появятся данные по CPL.

---

## Связанное
- `2026-06-08-google-search-starter-kit.md` — структура кампании, ключи, объявления, UTM-шаблон.
- `2026-06-08-lead-generation-strategy.md` — стратегия (Google Search — платный канал №1).
- Код атрибуции (`gclid`/`utm_*` → CRM/CSV): commit `eaec77f`, в проде.
