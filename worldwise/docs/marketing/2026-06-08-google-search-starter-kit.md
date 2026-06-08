# Google Search — стартовый набор (worldwise.pro)

**Дата:** 2026-06-08
**Бюджет:** $350–500/мес (~$12–16/день) · **Тип:** Search-only · **Цель:** англоязычные инвесторы
**Привязка к коду:** атрибуция уже на проде (UTM/gclid → CRM `source`/CSV, ветка `feat/utm-attribution` смержена в `main`). Этот набор активирует её.

> Что должен сделать оператор в Google Ads (я не имею доступа к рекламному кабинету): создать кампанию по этой структуре, связать GA4 ↔ Google Ads и импортировать конверсию `lead_form_submit`, выставить **Final URL suffix** (раздел 6) и геотаргет (раздел 7). Тексты/ключи — ниже, бери и вставляй.

---

## 1. Структура кампании

Одна Search-кампания, **3 ad-группы** (раздельные, чтобы объявления соответствовали запросу):

| Ad-группа | Интент | Доля бюджета | Лендинг |
| --------- | ------ | ------------ | ------- |
| **A. Buyer-intent** | «купить квартиру/недвижимость в Дубае» | ~55% | area-страницы / `/properties` |
| **B. Investor / ROI / Golden Visa** | доходность, инвестиции, виза | ~35% | `/golden-visa`, `/guide`, `/properties` |
| **C. Brand** | «worldwise…» (защита бренда, дёшево) | ~10% | `/` |

Match types на старте: **phrase + exact** (без broad — broad сливает бюджет без жёсткого smart-bidding и минус-слов). Broad подключать позже, на Maximize Conversions + накопленных минус-словах.

---

## 2. Ключевые слова

### A. Buyer-intent
```
"buy apartment in dubai"
"apartments for sale in dubai"
"dubai property for sale"
"buy property in dubai"
"buy flat in dubai"
"off plan dubai"
"off plan properties dubai"
"ready property in dubai"
"dubai marina apartments for sale"
"downtown dubai apartments for sale"
"business bay apartments for sale"
[buy apartment in dubai]
[off plan dubai]
[dubai property for sale]
```
→ Запрос с районом ведём на соответствующую area-страницу; общий «buy/off-plan» — на `/properties`.

### B. Investor / ROI / Golden Visa
```
"dubai property investment"
"invest in dubai real estate"
"dubai real estate roi"
"rental yield dubai"
"best area to invest in dubai"
"buy to let dubai"
"property investment dubai for foreigners"
"golden visa dubai property"
"dubai property for golden visa"
"dubai investment guide"
[dubai property investment]
[golden visa dubai property]
[rental yield dubai]
```
→ «golden visa…» → `/golden-visa`; «guide/how to invest» → `/guide`; «investment/roi/yield/best area» → `/properties` (в листингах показан `grossYield`).

### C. Brand
```
"worldwise real estate"
"worldwise dubai"
"worldwise properties"
[worldwise real estate]
[worldwise pro]
```
→ `/`.

---

## 3. Минус-слова (общий список кампании)

```
rent, "for rent", rental, rentals, "to rent", tenant, tenants, "short term", airbnb,
"holiday homes", hotel, hostel, room, roommate,
jobs, job, career, careers, salary, vacancy, hiring, "agent jobs", commission,
"how to become", "real estate course", "rera exam", "rera course", "broker license",
free, cheap, cheapest, "1 aed", "1 dirham",
crash, scam, fraud, complaints, lawsuit,
wikipedia, news, "for sale by owner",
dubizzle, bayut, "property finder", propertyfinder,
map, distance, weather, population,
"tourist visa", "visit visa", "work visa", "visa status", "visa cost"
```
> Не вносить «calculator», «mortgage», «visa» (без уточнения) — они режут целевой трафик. Минусуем только нерелевантные намерения (аренда, работа, бесплатное, конкуренты-порталы, туристические визы).

**Дисциплина недели 1:** ежедневно открывать Search terms report и добавлять мусорные запросы в минус-слова (особенно «rent», работа, конкретные арендные районы).

---

## 4. Объявления (RSA — Responsive Search Ads)

> Лимиты Google: заголовок ≤30 символов, описание ≤90. Бренд: English, без эмодзи, фактологично (по `voice.md`: цифры вместо эпитетов). Перед сохранением сверить счётчик в редакторе.

### A. Buyer-intent
**Headlines (15):**
```
Dubai Property for Sale
Buy Apartments in Dubai
Off-Plan & Ready Homes
8–10% Annual Rental Yield
0% Income Tax in Dubai
RERA-Certified Agency
Hand-Picked Dubai Listings
Marina, Downtown & More
Flexible Payment Plans
Buy From Top Developers
Emaar, Damac, Sobha
500+ Investors Served
Free, No-Obligation Consult
We Reply Within 2 Hours
View Verified Listings
```
**Descriptions (4):**
```
Invest in Dubai off-plan and ready homes with 8–10% yield and 0% income tax.
RERA-certified team. 500+ investors from 30+ countries. Free, no-obligation consult.
Hand-picked listings in Marina, Downtown, Business Bay and more. Flexible plans.
Tell us your budget — we reply within 2 hours on WhatsApp. Start today.
```

### B. Investor / ROI / Golden Visa
**Headlines (15):**
```
Dubai Property Investment
8–10% Rental Yield Dubai
ROI-Focused Listings
Golden Visa Properties
10-Yr Visa From AED 2M
0% Income & Capital Tax
Invest From AED 1M
RERA-Certified Advisors
Data-Driven Selection
Residency Via Property
Free 2026 Investment Guide
Free ROI Calculator
500+ Investors, 30+ Lands
Off-Plan Payment Plans
Book a Free Consultation
```
**Descriptions (4):**
```
Build passive income in Dubai — 8–10% gross yield, 0% income tax, capital growth.
Qualify for the 10-year Golden Visa with AED 2M+ property. We handle the process.
Free ROI calculator and 2026 investment guide. RERA-certified, data-driven advice.
Tell us your goals — we reply within 2 hours. 500+ investors from 30+ countries.
```

### C. Brand
**Headlines (8):**
```
Worldwise Real Estate
Official Worldwise Site
Dubai Property Experts
RERA-Certified Agency
8–10% ROI, 0% Tax
Off-Plan & Ready Homes
Free Consultation
Talk to Worldwise
```
**Descriptions (2):**
```
Worldwise Real Estate — RERA-certified Dubai investment agency. Free consultation.
500+ investors from 30+ countries. Off-plan and ready homes, 8–10% yield.
```

---

## 5. Ассеты (extensions) — добавить все

- **Sitelinks:** Properties (`/properties`) · Mortgage Calculator (`/mortgage-calculator`) · Golden Visa (`/golden-visa`) · Free Guide (`/guide`)
- **Callouts:** RERA-Certified · 8–10% ROI · 0% Income Tax · 500+ Investors · Free Consultation · Reply in 2 Hours
- **Structured snippet** (Neighborhoods): Dubai Marina, Downtown Dubai, Business Bay, Palm Jumeirah, Dubai Hills, JLT, Creek Harbour, Emaar Beachfront
- **Call asset:** +971 50 696 0435
- **Lead form asset** (опционально) — но приоритет на лендинг-формы (там работает атрибуция + квалификация).

---

## 6. UTM-шаблон (это включает задеплоенную атрибуцию)

Включи **auto-tagging** (gclid добавляется автоматически — код его ловит). Дополнительно задай **Final URL suffix** на уровне кампании (Settings → Campaign URL options → Final URL suffix):

```
utm_source=google&utm_medium=cpc&utm_campaign=search_{campaignid}&utm_term={keyword}&utm_content={creative}
```
Либо человекочитаемо — отдельный suffix на каждую ad-группу с явным именем кампании:
```
utm_source=google&utm_medium=cpc&utm_campaign=search_buyer_intent&utm_term={keyword}
utm_source=google&utm_medium=cpc&utm_campaign=search_investor&utm_term={keyword}
utm_source=google&utm_medium=cpc&utm_campaign=search_brand&utm_term={keyword}
```
Результат: в CRM (карточка лида → строка **Attribution**) и в CSV появятся `utm_source=google`, `utm_campaign`, `utm_term`, `gclid` — видно, какой запрос/кампания принесли лид. First-touch: фиксируется первый рекламный заход, последующие визиты не перезатирают.

**Проверка:** уже подтверждено на проде — заход на `worldwise.pro/?utm_source=google&...&gclid=...` пишет `ww_attribution` в localStorage, форма отправляет это в `/api/leads`.

---

## 7. Настройки кампании (чек-лист)

- **Тип:** Search. **Networks:** снять галочки *Search Partners* и *Display Network* (обе OFF — иначе мусорный трафик).
- **Locations:** таргет по аудитории-инвесторам. Старт: UAE, United Kingdom, India, Saudi Arabia, Qatar, Kuwait, Bahrain, Oman. Location options → **«Presence: people in or regularly in your targeted locations»** (НЕ «interest»).
- **Language:** English.
- **Budget:** $12–16/день.
- **Bidding:** старт — **Manual CPC** с разумным cap (или Maximize Clicks с лимитом CPC), потому что конверсий ещё нет. После накопления **15–30 конверсий** → переключить на **Maximize Conversions** (или Target CPA на основе фактического CPL). НЕ Maximize Conversions с нуля.
- **Conversions:** связать GA4 ↔ Google Ads, импортировать `lead_form_submit` как **Primary** конверсию. (Опц. `whatsapp_click` — Secondary.)
- **Ad rotation:** Optimize. **Devices:** все (скорректировать по данным позже).
- **Schedule:** круглосуточно на старте; уточнить по часам конверсий через 2–3 недели.

---

## 8. Ожидания и оптимизация

- При CPL AED 150–600 (≈$40–165) и бюджете $350–500 — **ориентир ~10–25 лидов/мес** на старте (Search обычно даёт более высокий CPL, но лучший close-rate, т.к. лиды самоквалифицируются).
- Меряем **cost per qualified lead** и **lead→viewing** по `source`/UTM в CRM, не raw-клики.
- **Неделя 1–2:** ежедневно чистить search terms → минус-слова; следить, что объявления одобрены; держать <5 мин ответ на каждый лид.
- **Через 30 дней:** убрать худшую ad-группу/ключи, перелить бюджет в лучшие; при стабильных конверсиях — перейти на Maximize Conversions и расширить районы.

---

## 9. Связанное

- Полная стратегия: `docs/marketing/2026-06-08-lead-generation-strategy.md` (Google Search — канал №1 платный, раздел 4).
- Код атрибуции: ветка/коммит `feat/utm-attribution` (`eaec77f`), задеплоено на прод 2026-06-08.
- Следующий платный слой после результатов Google Search: Meta **ретаргетинг** (не холодные формы) — см. стратегию, раздел 4.
