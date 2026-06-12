# Google Ads — фиксы запуска + отслеживание конверсий

**Статус (2026-06-10): §A ВЫПОЛНЕН** (браузерный Claude): GA4-импорт `lead_form_submit` = Primary/Recording (старая цель → Secondary, не удалена); Enhanced conversions for leads включены; три OCI-действия `CRM Lead`/`CRM Qualified`/`CRM Deal` созданы (Secondary, 90 дней, Deal с Value AED); минус-слова добавлены (81→94, campaign-level); Search Partners отклонён, Networks = Search only. **Расхождение с брифом: стратегия ставок в кампании = Maximize Clicks, НЕ Manual CPC** — осознанно оставлена до накопления 15–30 Qualified-конверсий, затем переход на Target CPA (вместе с переключением CRM Qualified в Primary). Scheduled import НАСТРОЕН (2026-06-10): расписание HTTPS → /api/google-ads-oci, Weekly пн 07:00 GMT+4, Preview успешен (авторизация и формат подтверждены Google; строк 0 — gclid-лиды ещё не накопились). OCI-действия активируются первой загрузкой реальных строк. Контур закрыт; контроль — ежемесячное событие в календаре (1-й пн).

**Дата:** 2026-06-09 · **Контекст:** Search-кампания запущена (первые часы: 18 показов, 1 клик). Анализ живой страницы (claude.ai-chrome) выявил: (1) **критично** — конверсия «Отправка формы…» = «Неверная конфигурация»; (2) мусорный трафик (нужны минус-слова); (3) весь трафик в группу A; (4) Google навязывает Display/Search Partners.

**Ключевой технический факт (из кода сайта):** GA4 грузится только **после согласия на cookies** (`Analytics.tsx` ждёт `ww_consent_accepted`) → событие `lead_form_submit` срабатывает не у всех → **GA4-конверсии недосчитывают**. НО захват `gclid`/`utm_*` (`components/UtmCapture.tsx`) **не привязан к согласию** — он пишется в каждый лид и в CSV всегда. Поэтому надёжный учёт = **Offline Conversion Import по gclid** (раздел C).

---

## A. Промт для claude.ai-chrome (вставить в браузерный Claude с доступом к Google Ads + GA4)

*(v2, 2026-06-10: добавлена ЗАДАЧА 2 — создание трёх OCI-действий под кнопку CRM «Export Google Ads». После выполнения Задачи 1 в CRM появится тестовый лид «Test Claude» — удалить руками.)*

> **КОНТЕКСТ.** Ты работаешь в браузере с доступом к Google Ads и GA4 для worldwise.pro (недвижимость Дубай). Запущена Google Search кампания (группы A — Buyer-intent, B — Investor/ROI/Golden Visa, C — Brand). Цель — лиды с форм сайта. Факты о сайте (из кода, не перепроверяй): GA4 грузится ТОЛЬКО после согласия на cookies; событие конверсии = `lead_form_submit`. `gclid`/`utm_*` пишутся в каждый лид НЕЗАВИСИМО от согласия; CRM в один клик выгружает файл офлайн-конверсий (строки с именами действий «CRM Lead», «CRM Qualified», «CRM Deal», таймзона +0400, валюта AED) — владелец будет грузить его еженедельно через Goals → Conversions → Uploads.
>
> **ЖЁСТКИЕ ПРАВИЛА:** ничего не удаляй; НЕ повышай бюджет; НЕ меняй стратегию ставок (остаётся Manual CPC); НЕ включай Display Network и Search Partners; перед каждым сохранением показывай, что меняешь. Если шаг блокирован правами — не ломай, запиши в отчёт, что нужно от владельца, и иди дальше.
>
> **ЗАДАЧА 1 — починить GA4-конверсию** (сейчас «Misconfigured»):
> 1. GA4 → Admin → Events: приходит ли `lead_form_submit`? Если нет — открой `https://worldwise.pro/guide`, **прими cookies**, отправь тестовую заявку (имя: Test Claude, телефон: +971500000001), проверь событие в GA4 Realtime. Без согласия событие не сработает — так устроен сайт.
> 2. GA4 → Admin → Key events: пометь `lead_form_submit` как Key event.
> 3. GA4 → Admin → Product links → Google Ads: связать аккаунт, если не связан.
> 4. Google Ads → Goals → Conversions → New conversion action → Import → Google Analytics 4 properties (Web): импортируй `lead_form_submit`, поставь **Primary**. Сломанную старую цель «Отправка формы…» → Secondary (не удалять).
> 5. Включи Enhanced Conversions for Leads, если доступно.
> 6. Убедись: статус сменился с «Misconfigured» на «Recording»/«No recent conversions».
>
> **ЗАДАЧА 2 — создать 3 действия для офлайн-конверсий** (КРИТИЧНО: имена символ в символ — файл из CRM ссылается на них по имени, расхождение = ошибка загрузки). Goals → Conversions → New conversion action → **Import → CRMs, files, or other data sources → Track conversions from clicks**. Три действия:
> - `CRM Lead` — категория Submit lead form · Count: One · Click-through window: 90 days · Value: Don't use a value · **Secondary**
> - `CRM Qualified` — категория Qualified lead · Count: One · 90 days · Don't use a value · **Secondary**
> - `CRM Deal` — категория Converted lead · Count: One · 90 days · Value: Use different values, default 0, AED · **Secondary**
>
> Все три пока Secondary: Primary остаётся GA4 `lead_form_submit`, иначе столбец Conversions задваивает. (Когда накопится 15–30 Qualified — владелец переключит `CRM Qualified` в Primary.)
>
> **ЗАДАЧА 3 — минус-слова на уровне кампании:** `price, prices, rupees, bhk, "1 bhk", "2 bhk", villa, villas, land, "burj khalifa", cheap, salary, jobs, rent, "for rent"`. Проверь привязку к кампании.
>
> **ЗАДАЧА 4 — отклонить авто-рекомендации:** Dismiss «Expand to Search Partners» и «Display Network». Подтверди Networks → Search only.
>
> **ЗАДАЧА 5 — типы соответствия:** мусор тянет phrase `"dubai property for sale"`. Пока не паузь; если после минус-слов продолжится — сузь грязные phrase до exact. Отметь владельцу.
>
> **ЗАДАЧА 6 — финальные проверки:** (а) Conversions Summary: GA4-импорт Recording, три CRM-действия существуют со статусом Secondary; (б) Goals → Conversions → **Uploads** — страница доступна (сюда грузится еженедельный файл). Если тестовая загрузка скажет «conversion action not found» — действия активируются до 6 часов после создания, это не ошибка.
>
> **ОТЧЁТ:** (1) статус GA4-конверсии до/после; (2) три созданных действия — имя/категория/окно/Primary-Secondary; (3) добавленные минус-слова; (4) что отклонил; (5) что не удалось и что нужно от владельца.

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
2. Создай три действия с именами **ровно** как в экспорте (`lib/oci-export.ts` `OCI_ACTIONS`): `CRM Lead` (Count: One, окно 90 дней), `CRM Qualified` (Count: One), `CRM Deal` (Count: One, Value enabled, валюта AED). Для оптимизации ставок опирайся на качественные стадии (Qualified/Deal), а не на сырой лид.

**Загрузка — ПОЛНОСТЬЮ автоматическая (scheduled import, 2026-06-10):**
Google Ads сам забирает фид раз в неделю — настроить один раз:
1. Goals → Conversions → Uploads → **Schedules** → «+» → источник **HTTPS**.
2. URL: `https://worldwise.pro/api/google-ads-oci` · Username/Password = `OCI_FEED_USER`/`OCI_FEED_PASS` из серверного `.env.local`.
3. Frequency: **Weekly** (день/время любые). Сохранить → Google покажет тестовый Preview.
Фид отдаёт те же строки, что и кнопка (все gclid-лиды за 90 дней, `CRM Lead`/`CRM Qualified`/`CRM Deal`, +0400, Value 0, без PII). Дубликаты Google отбрасывает сам; при ошибке загрузки шлёт e-mail владельцу аккаунта. Диагностика — на странице Uploads (поглядывать раз в месяц, событие в календаре стоит).

**Ручной запасной путь:** CRM `/admin/leads` → кнопка **Export Google Ads** → Uploads → Upload файл → Preview → Apply (тот же файл; полезно для разовой догрузки с вписанной ценностью сделки).

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

---

**Статус (2026-06-12, ребаланс кампании по search-terms-отчёту):** Индия удалена из гео
(осталось ОАЭ+UK+GCC, 7 стран, Presence) — Max Clicks наливал дешёвый индийский трафик
(запросы crore/rupees/2bhk ниже входного чека); вернуть Индию только отдельной кампанией
со своим бюджетом. Минус-слова: −1 битое (`"visa cost"rent`), +12 (слитные Nbhk, crore/lakh/rupee,
"in indian rupees", "from india", "bur dubai", "notun thikana", "visa cost"), villa/villas СНЯТЫ
(виллы — ассортимент; аренду режут rent/rentals). Группа B +5 инвесторских ключей. Группа A:
районные ключи получили keyword-level Final URL на /dubai-marina, /downtown-dubai, /business-bay.
Новая группа D — Developers (8 ключей по застройщикам, RSA 15/4 → /developers, активна).
Brand RSA добит до 15/4 (Ad strength Average — приемлемо). Стратегия ставок НЕ менялась
(триггер прежний: 15–30 Qualified → tCPA). Контроль через неделю: расход по странам,
search terms группы D, первые конверсии (GA4-импорт + OCI живы, проверены 2026-06-12).
