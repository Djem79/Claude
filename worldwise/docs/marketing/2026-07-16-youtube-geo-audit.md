# YouTube GEO-аудит @worldwiserealestate (П2 промо-плана AI-visibility)

**Дата:** 2026-07-16 · **Канал:** youtube.com/@worldwiserealestate · **42 видео** (7 длинных + 35 Shorts), 22 подписчика
**Метод:** yt-dlp, полные описания всех 42 видео + описание канала (данные сняты 16.07.2026)
**Контекст:** П2 из промо-плана v2 (16.07) — YouTube = сильнейший корреляционный сигнал упоминаний бренда в AI-ответах (0.737). Цель аудита: бренд + сайт + ссылки на цитируемые отчёты в каждом описании.

---

## Итог одной строкой

Июньская санация (заголовки + шаблон описаний) **применена на ~2/3 канала** — но ни одно из 42 видео не ссылается на цитируемые ассеты, ссылки на сайт **некликабельны** (без `https://`), 2 описания пустые, и канал молчит с 20.11.2025.

## Сводка по критериям П2

| Критерий | Сейчас | Цель |
| --- | --- | --- |
| Упоминание бренда в описании | 40/42 (но в 28 — только как домен, не как имя) | 42/42 словами «Worldwise Real Estate» |
| Ссылка на сайт | 40/42, **все некликабельные** (`worldwise.pro` без протокола) | 42/42 с `https://` |
| Ссылка на цитируемый отчёт / глубокую страницу | **0/42** | 42/42 по маппингу ниже |
| Шаблон F (хук / In this video / CTA / хештеги) | 28/42 | 42/42 |
| Пустые или мусорные описания | 4 (2 пустых, 1 из 77 знаков, 1 без бренда вовсе) | 0 |

**Почему `https://` — не косметика:** YouTube делает ссылку в описании кликабельной только при наличии протокола. Голый `worldwise.pro` — просто текст: ноль переходов и слабее как краулинговый сигнал (описания видео индексирует Google и подхватывают LLM-краулеры). Это же касается `wa.me/...`.

## Критические находки (чинить первыми)

1. **`Eo0HtFf4RDw`** «Worldwise real estate speaking about commercial units» (119 просм.) — **пустое описание**.
2. **`Sdet1dc8Jaw`** «Gemini Splendor. Show tour of two bedroom apartment…» (111 просм.) — **пустое описание**.
3. **`FTpyQADuInk`** «Brand new and ready to move 2-bedroom…» (131 просм.) — описание = копия заголовка, 77 знаков, ни одной ссылки.
4. **`s9HqQ64CbJE`** «Terra Garden by Emaar Properties in Expo City» (103 просм., **самое свежее видео канала, 20.11.2025**) — только ТТХ проекта: ни бренда, ни сайта, ни CTA, ни хештегов. Регресс к до-санационному стилю на самом видном месте канала.

Системное: **канал не публикует ничего с 20.11.2025** (8 месяцев). Для mention-сигнала важна и свежесть — это за рамками П2, но фиксирую.

## Стандартный CTA-блок v2 (заменить им последние строки каждого описания)

Отличия от шаблона F: бренд прописан словами (entity-сигнал), обе ссылки кликабельные, добавлена строка с глубокой ссылкой.

```text
Considering investing in Dubai? Free, no-obligation consultation with Worldwise Real Estate:
→ https://worldwise.pro · WhatsApp: https://wa.me/971506960435
<DEEP LINK LINE — из таблицы ниже>

#DubaiRealEstate #InvestInDubai #DubaiProperty #OffPlanDubai
```

## Маппинг: глубокая ссылка для каждого видео

Правило (из санации, раздел G): тур района → страница района; тур объекта → /properties; доходность/рынок → yields report / Q2-отчёт; визы → /golden-visa; ипотека → /mortgage-calculator.

Готовые строки `<DEEP LINK LINE>` (вставлять как есть):

- **Yields report:** `Dubai rental yields by area (updated quarterly): https://worldwise.pro/blog/dubai-rental-yields-report`
- **Q2-отчёт:** `Dubai property market Q2 2026 report: https://worldwise.pro/blog/dubai-property-market-q2-2026`
- **Район:** `Area guide: https://worldwise.pro/<slug>`
- **Каталог:** `Current listings: https://worldwise.pro/properties`
- **Golden Visa:** `Golden Visa guide: https://worldwise.pro/golden-visa`
- **Ипотека:** `Mortgage calculator: https://worldwise.pro/mortgage-calculator`
- **Покупка:** `How to buy an apartment in Dubai: https://worldwise.pro/invest/buy-apartment-in-dubai`
- **Off-plan:** `Off-plan investment guide: https://worldwise.pro/blog/off-plan-investment-guide`
- **Визы/переезд:** `UAE residence visa through property: https://worldwise.pro/blog/uae-property-residence-visa`
- **Правила сделки:** `DLD fees & buying costs guide: https://worldwise.pro/blog/dld-fees-dubai-international-investors-guide`

### Длинные видео (7)

| ID | Видео | Deep link |
| --- | --- | --- |
| 6SbO4xSoXbY | Top 5 areas by ROI | Yields report |
| JlBBZMRdz1w | Marina 3BR terrace tour | Район `/dubai-marina` |
| oj5G3qcKIVE | 571K USD apartment (Sobha Hartland) | Район `/mbr-city` |
| Wp7UfIaf51U | The Views rental 165k | Каталог |
| rbtur3CwGVU | Mulberry 6.5M Dubai Hills | Район `/dubai-hills` |
| EwaGFsvV5nQ | Off-plan vs secondary | Off-plan guide |
| XdlonGvYEDg | FR: 5 quartiers | Yields report |

### Shorts (35)

| ID | Видео | Deep link |
| --- | --- | --- |
| s9HqQ64CbJE | Terra Garden Expo City ⚠️ | Каталог |
| 8i9V6KUT4go | Marina Shores 3BR pre-launch | Район `/dubai-marina` |
| DKevs8sd4Ow | 3 projects before buying (1671 просм.) | Каталог |
| 2CI3tEVgf1A | Families / 200+ schools | Визы/переезд |
| 59mnPEUY7uU | First home in Dubai | Покупка |
| Eo0HtFf4RDw | Commercial units ⚠️ пустое | Каталог |
| 2N72G6Lkzk4 | Boutique developers / Prive | Район `/dubai-hills` |
| fFvizMCfr-c | Sobha Hartland | Район `/mbr-city` |
| fpvuNc7YGmI | Who we are | — (только сайт https://worldwise.pro) |
| Sdet1dc8Jaw | Gemini Splendor tour ⚠️ пустое | Каталог |
| uyS8gIml9aE | Gemini Splendor move in | Каталог |
| FTpyQADuInk | 571k pool view ⚠️ 77 знаков | Каталог |
| a5snjuYxOVA | Foreign investors — don't sign | Правила сделки |
| b119MV-BoLc | Gemini Splendor move in #2 | Каталог |
| KGRR4RyX0nU | Ready apartment — park (1219 просм.) | Каталог |
| T_hlzzoOSWY | 10 min from Downtown 2BR | Район `/downtown-dubai` |
| pLJLFc3yBF4 | Dubai Hills 3BR (Arina) | Район `/dubai-hills` |
| lvciowtQjJQ | Dubai Hills 3-bed 60 sec | Район `/dubai-hills` |
| FA1HrLq57D0 | High-floor 2BR rent | Каталог |
| sr6BBYwpo-k | Infrastructure / Metro Blue Line | Q2-отчёт |
| 74DRvP0Q2II | 2-bed rent — would you take it? (3491 просм., топ канала) | Каталог |
| pzKbFIOxMXM | Commercial investment | Каталог |
| BbMPGvx22MM | Renting with a view | Каталог |
| TSPCK_y_8O4 | **Rental yield in Dubai** | **Yields report** (идеальное совпадение темы) |
| J_bPovPa-2E | Mortgage buyers should know | Ипотека |
| ikbAi6C8-oY | Sunset Bay / Dubai Islands | Каталог |
| Ms2KW8aD5Jc | Why we picked this project (907 просм.) | Каталог |
| LUH5bsUvwJM | 1,000 people move daily (1442 просм.) | Визы/переезд |
| YSfhU_rai4U | Penthouse Address Zabeel | Район `/downtown-dubai` |
| cC3quSoZtio | Golden Visa REJECTED (1008 просм.) | Golden Visa |
| wEF-tFN8ZT8 | 4 areas we recommend | Yields report |
| qG1Uk-gKw9A | FR: Dubai Creek | Район `/creek-harbour` |
| oh6vELOtPB0 | FR: Dubai Hills | Район `/dubai-hills` |
| fqHUiTV29Wc | FR: Emaar Beachfront | Район `/emaar-beachfront` |
| 6gRDaATmaz4 | Off-plan or secondary — wins? | Off-plan guide |

Для франкоязычных видео CTA-блок оставить на французском, ссылки те же:
```text
Vous envisagez d'investir à Dubai ? Consultation gratuite et sans engagement avec Worldwise Real Estate :
→ https://worldwise.pro · WhatsApp : https://wa.me/971506960435
<DEEP LINK LINE>
```

## Готовые описания для 4 критических видео (вставить целиком)

### `Eo0HtFf4RDw` — Worldwise real estate speaking about commercial units

```text
Commercial units in Dubai — what investors should know about offices, retail and ROI in the city's business districts.

In this video:
- Why commercial property works differently from residential
- Where rental demand for offices and retail is strongest
- What returns commercial investors can realistically expect

Considering investing in Dubai? Free, no-obligation consultation with Worldwise Real Estate:
→ https://worldwise.pro · WhatsApp: https://wa.me/971506960435
Current listings: https://worldwise.pro/properties

#DubaiRealEstate #InvestInDubai #DubaiProperty #CommercialDubai
```

### `Sdet1dc8Jaw` — Gemini Splendor 2BR tour

```text
A 2-bedroom apartment in Gemini Splendor, Sobha Hartland — a quick tour of one of Dubai's most prestigious addresses.

In this video:
- The layout and finishes of this ready-to-move unit
- Pool view and premium appliances included
- Why Sobha Hartland is minutes from Downtown and Business Bay

Considering investing in Dubai? Free, no-obligation consultation with Worldwise Real Estate:
→ https://worldwise.pro · WhatsApp: https://wa.me/971506960435
Area guide: https://worldwise.pro/mbr-city

#DubaiRealEstate #InvestInDubai #DubaiProperty #OffPlanDubai
```

### `FTpyQADuInk` — 571k pool-view 2BR

```text
A brand-new, ready-to-move 2-bedroom apartment with a pool view — yours for around 571,000 USD.

In this video:
- A walk through the layout and finishes
- The pool view and what's included with the unit
- Why this location works for both living and investment

Considering investing in Dubai? Free, no-obligation consultation with Worldwise Real Estate:
→ https://worldwise.pro · WhatsApp: https://wa.me/971506960435
Current listings: https://worldwise.pro/properties

#DubaiRealEstate #InvestInDubai #DubaiProperty #OffPlanDubai
```

### `s9HqQ64CbJE` — Terra Garden by Emaar (сохранить ТТХ, добавить бренд-блок)

Существующий текст с ТТХ проекта (Project 4160 / Permit 0520727879 и highlights) **оставить как есть** — номера пермитов это доверительный сигнал. В конец дописать:

```text
Considering investing in Dubai? Free, no-obligation consultation with Worldwise Real Estate:
→ https://worldwise.pro · WhatsApp: https://wa.me/971506960435
Current listings: https://worldwise.pro/properties

#DubaiRealEstate #InvestInDubai #DubaiProperty #OffPlanDubai
```

## Порядок применения (YouTube Studio → Content)

1. **Волна 1 (15 мин):** 4 критических видео — вставить готовые описания выше.
2. **Волна 2 (20 мин):** топ по просмотрам — 74DRvP0Q2II, DKevs8sd4Ow, LUH5bsUvwJM, KGRR4RyX0nU, cC3quSoZtio, Ms2KW8aD5Jc + TSPCK_y_8O4 (yields!) — заменить CTA-строки блоком v2 с deep link из таблицы.
3. **Волна 3 (30–40 мин):** остальные — тот же однотипный сёрч-энд-реплейс: две строки `→ worldwise.pro · WhatsApp: wa.me/...` меняются на блок v2.

Массовой правки описаний YouTube API/Studio не даёт (bulk-редактор меняет только «добавить текст», не заменить) — только вручную или через claude-chrome с супервизией.

## Что НЕ делаем (за рамками П2)

- Не трогаем заголовки — санация июня уже применена, ре-заголовки без данных = риск потери CTR.
- Не добавляем эмодзи-стиль в новые описания; старые эмодзи-описания (10 шт.) чистим только в Волне 3, контент не переписываем.
- Возобновление публикаций (контент-движок «Inside Dubai») — отдельное решение юзера, не часть П2.

## KPI

Проверка эффекта — еженедельный ai-visibility крон (ср 05:30 UTC): цель промо-плана 2–3/11 упоминаний к середине августа. Плюс GSC: переходы с youtube.com в отчёте по источникам (сейчас ссылки некликабельны → ноль переходов физически).
