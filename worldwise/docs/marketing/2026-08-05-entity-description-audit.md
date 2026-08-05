# Сверка описания компании во всех точках, которые читают поисковики и ИИ

**Дата:** 2026-08-05 · **Статус:** аудит, правки НЕ внесены — ждут решения юзера по формулировке
· Повод: вопрос «может, вписать везде, что мы лучшее агентство» (ответ — нет, см. раздел 5)

## 1. Что нашли: три разных числа про доходность живут одновременно

| Где | Что заявлено | Чем подтверждается |
| --- | --- | --- |
| `components/Hero.tsx` (видимый H1) | **8–10% ROI** | ничем — это сумма «доходность + рост цен» без источника и без периода |
| `app/opengraph-image.tsx` (соцкартинка) | **8–10% ROI** | то же |
| `app/layout.tsx` — title, description, OG, Twitter | **8–10% total ROI** | то же |
| `app/layout.tsx` — `orgJsonLd.description` | **8–10% total ROI**, «gross rental yields **up to 8%** by district» | «up to 8%» противоречит нашему же отчёту |
| `app/properties/page.tsx` | **8–10% ROI** | то же |
| `public/llms.txt` | **~4–7%** gross yields | совпадает с отчётом ✅ |
| `blog/dubai-rental-yields-report` (наш цитируемый актив) | **4–7%** по 12 районам, максимум ~7% (JLT, Business Bay) | сверено с DLD, дата проверки стоит ✅ |
| `blog/dubai-property-market-q2-2026` | citywide gross yield **6.58%** | Engel & Völkers, июль 2026 ✅ |

**Вывод:** страница, которую цитирует ChatGPT, говорит 4–7%. Структурированные данные на
КАЖДОЙ странице сайта говорят «до 8%». Заголовок сайта говорит 8–10%. Для модели, которая
сверяет утверждение с источником, это ровно тот сигнал, который снижает доверие к странице.

## 2. Как это получилось (важно, чтобы не повторить)

- **PR #142** (01.08) правил JSON-LD организации: «5–9% by district» → «4.5–7.5%», и снял
  необоснованное «8–10% total ROI». Правильное направление.
- **PR #144** (в тот же день) вернул «8–10% total ROI» и поставил «up to 8% by district» — с
  обоснованием «видимый H1 всё ещё это заявляет, приводим разметку в соответствие со страницей».

Направление оказалось перевёрнутым: разметку подогнали под маркетинговый заголовок вместо
того, чтобы заголовок привести к проверенным данным. Правило на будущее: **источник истины —
цитируемый актив с датой проверки, а не H1.**

## 3. Внешние точки: там мы вообще другая компания

| Точка | Что написано сейчас | Проблема |
| --- | --- | --- |
| Property Finder, профиль брокера (ORN 39125) | «your trusted partner in making dream homes a reality… turning complex transactions into seamless experiences» | ноль про инвесторов и данные; это generic-текст. **Модель его читает**: в прогоне 29.07 бренд-проба процитировала именно страницу PF |
| LinkedIn (company/worldwise-real-estate-llc) | не проверено — отдаёт HTTP 999 роботам | нужен браузер (мак или юзер) |
| Google Business, Instagram, YouTube, TikTok, Facebook, expat.com | не проверено отсюда | те же, нужен браузер |

Два расхождения по фактам между сайтом и PF:
- **ORN 39125** — верифицируемый номер лицензии, который есть на PF и которого НЕТ у нас на
  сайте. Это ровно тот тип проверяемого утверждения, который работает на цитируемость.
- **148+ объектов** в `llms.txt` против **13 активных** на PF. Разные вещи (наш каталог против
  опубликованного на портале), но со стороны выглядит как несостыковка — стоит формулировать
  точнее.

## 4. Отдельный риск: `aggregateRating` в разметке

`orgJsonLd` несёт `aggregateRating` 5.0 из 4 отзывов. **Уточнение юзера (05.08): отзывы
настоящие и собраны в Google Business, а не на нашем сайте.** Это меняет суть проблемы, но не
снимает её: политика структурированных данных Google запрещает переносить в свою разметку
рейтинги, собранные на стороннем ресурсе, — оценки должны приходить непосредственно от
пользователей нашего сайта. То есть оба варианта нерабочие: свои отзывы о себе — self-serving
и неприемлемы для LocalBusiness, чужой агрегат — нельзя копировать.

Практический вывод: звёздочек в выдаче эта разметка не даёт в любом случае, а рейтинг в Google
и так показывается — в карточке Google Business, ссылка на которую уже стоит в `llms.txt`.
Чище всего убрать `aggregateRating` из `orgJsonLd` и оставить отзывы там, где они живут
и проверяемы. Проверить текущий статус можно в Rich Results Test и в отчёте
Search Console — это и есть способ убедиться, а не спорить о трактовке.

## 5. Почему не «лучшее агентство в Дубае»

Коротко (полный ответ — в переписке 05.08): непроверяемое утверждение не даёт цитирования, а
вписывание его в файлы, которые видит только робот, — это скрытый текст и переспам по правилам
Google, со штрафом на весь сайт. Плюс превосходные степени в рекламе недвижимости в ОАЭ
требуют подтверждения. Работающая форма превосходной степени у нас уже есть: «лучшая
доходность среди 12 районов, которые мы отслеживаем, — JLT и Business Bay, 6–7%» — с цифрой,
источником и датой.

## 6. Предлагаемая единая формулировка

Одна фактическая база, три длины. Каждое утверждение проверяемо.

**Длинная** (llms.txt, `/about`, `orgJsonLd.description`, LinkedIn About, PF):

> Worldwise Real Estate is a RERA-licensed Dubai brokerage (ORN 39125) advising international
> investors on off-plan and secondary-market property. We publish a district-by-district gross
> rental yield index covering 12 Dubai districts, reviewed monthly against Dubai Land Department
> transaction data, and a quarterly Dubai market report — both free to cite with attribution.
> Gross yields across the districts we track run 4–7%; the UAE levies no income tax on rental
> income and no capital gains tax.

**Короткая** (meta description, OG, Twitter — ≤160 знаков):

> RERA-licensed Dubai brokerage for international investors. District rental yields of 4–7%,
> verified monthly against DLD data. Off-plan and ready property.

**Однострочная** (соцбио, подписи):

> Dubai property for international investors — RERA-licensed, data-first. District yields
> updated monthly.

**Что делать с «8–10% ROI» на видимой странице.** Не обязательно убирать цифру — обязательно
сделать её проверяемой и разложенной:

> Gross rental yield of 4–7% by district plus 5–7% annual price growth in 2026
> (Property Monitor index; Engel & Völkers mid-year review).

Это то же самое по смыслу, но подтверждаемо. В разметку (`orgJsonLd`) числовые обещания
доходности не возвращать: там описание сущности, а не оффер.

## 7. Раскладка работ

**Репозиторий (может сервер, одним PR):** `Hero.tsx`, `opengraph-image.tsx`, `layout.tsx`
(title/description/OG/Twitter/`orgJsonLd`), `properties/page.tsx`, `llms.txt`, `/about` —
привести к единой формулировке; решить судьбу `aggregateRating`; добавить ORN 39125 на сайт.

**Только юзер или мак (браузер):** Property Finder, LinkedIn, Google Business, Instagram,
YouTube, TikTok, Facebook, карточка expat.com.

**Порядок:** сначала юзер утверждает формулировку из раздела 6, потом один PR по репозиторию,
потом внешние профили. Проверка результата — прогон ai-visibility в среду: бренд-проба
показывает, каким текстом модель нас описывает.
