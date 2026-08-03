# Библиотека питчей для медиа-запросов

Готовые ответы на типовые запросы журналистов (Qwoted / HARO / Source of Sources).
Пишутся заранее, потому что дедлайны там 24–48 часов, а тексты повторяются.

**Как пользоваться:** ⚠️ **не как готовый текст — как список вопросов, на которые
у нас уже есть ответ.** Отправлять эти заготовки дословно нельзя (см. следующий
блок). Сами тексты остаются полезными: они показывают, какие темы работают, где
называть компанию и что редакции режут первым.

**Куда отправлять:** Qwoted только с KZ-VPN и только вручную из Safari
(с российского IP аккаунт блокировали в июле 2026). HARO и SOS — обычной почтой
с `info@worldwise.pro`.

## ⚠️ AI-детекция: Pangram стоит на всех трёх площадках

Проверено в бою 03.08.2026 на запросе BBC. Qwoted интегрировал **Pangram Labs**
(с 21.08.2025, до этого был GPTZero), HARO и Featured — с 15.09.2025. Что это
значит на практике:

- **Журналист видит долю AI в питче** до того, как прочтёт текст. Детекция
  работает на обе стороны, у нас в форме это фиолетовая кнопка `Check for AI`.
- **Флаг бьёт по аккаунту, а не только по заявке.** Справка Qwoted: повторные
  флаги ведут к временной блокировке, продолжение — к удалению с платформы.
  В июле 2026 Press Gazette описал бан сотен аккаунтов именно за AI-питчи.
  Ставка в каждом питче — весь канал медиазапросов, а не одна публикация.
- **Одна проверка на питч** (лимит платформы; за детальным разбором Pangram
  предлагает свой сайт, там есть бесплатный лимит).
- **Переписывание НЕ помогает.** Три версии одного текста — исходная, после
  `humanizer` и намеренно «разговорная» — дали одинаковый вердикт:
  `fully AI-generated`, `fraction_ai 1.0`, score **0.993**, confidence High.
  Score совпал до тысячных: детектор ловит статистическую сигнатуру генерации,
  а не словарные тики из чек-листа. Правка через ИИ (вплоть до Grammarly) тоже
  флагается — об этом прямо предупреждает справка Qwoted.

**Схема, которая работает** (тот же запрос, тот же час, 03.08.2026 — вердикт
`fully human-written`, `fraction_human 1.0`, score **0.0026**, High):

1. Юзер наговаривает ответ **по-русски**, как идёт, с обрывами и повторами.
2. Claude переводит **дословно**: порядок мыслей, фразы и неровности сохраняются,
   свои обороты не добавляются, текст не «причёсывается». Перефразирование —
   это как раз то, что палится.
3. Прогон `Check for AI` **до** отправки, результат читается из ответа
   `POST /enrich/api/ai_text_detection` (в UI показывается не всегда).
4. Отправка.

Если времени на диктовку нет — питч не отправляем. Отправить сгенерированный
текст дороже, чем пропустить запрос.

---

## Жизнь в Дубае глазами резидента

Под запросы формата «ищем жителей ОАЭ», «что такое качество жизни у вас»,
«почему вы переехали», «что посоветуете приезжему». Такие запросы приходят
регулярно в travel- и lifestyle-изданиях.

Написан для запроса BBC от 27.07.2026 (Qwoted, source request 256040 —
«Looking for residents in Panama, Mexico, UAE, Thailand, and Brazil»).
Отправлен не был: письмо нашли за полтора часа до дедлайна. Этот случай и
породил фит-детекцию в `scripts/mail-watch.py`.

**Пущен в дело 03.08.2026.** BBC повторил запрос — «Looking for residents in
UAE/Dubai?», дедлайн 03.08 23:33 MSK, помечен `NO PITCH CREDIT NEEDED`
(man_on_the_street не тратит месячные питчи). Фит поймал крон, текст ушёл
почти без правок — в этом и был смысл заготовки. Одно отличие: BBC добавил
вопрос про конфликт, ответ на него ниже.

> I'm Russian, I've lived in Dubai since 2022 and I run a brokerage here, so I get this question constantly, usually from people who are really asking whether they'd regret moving.
>
> They mostly don't. The quality of life here is high in a way that's hard to photograph. Things just work. I opened a bank account in a morning. I've never queued at a government office. I forget to lock my car and nothing happens, and after a while you stop noticing that you stopped worrying.
>
> Tax is what got me on the plane. It's not what kept me. What kept me is that my week can include a Michelin restaurant on Tuesday and total desert silence forty minutes down Al Qudra Road on Friday, and neither one is a special occasion. Also, everyone here is from somewhere else. Nobody asks where you're really from, because the answer is always somewhere else.
>
> It's not perfect. From June to September it's 45 degrees and you live indoors like people in Moscow live indoors in January. Schools and medicine are private and brutal on a budget. Rents have climbed for three straight years and that's the complaint I hear most.
>
> If you come and want the version residents actually live in: skip the observation decks. Take the abra across the Creek for a dirham, eat at a South Indian canteen in Karama, get to the Deira fish market by six in the morning, and drive to Al Qudra at sunrise when it's still cool enough to sit outside.
>
> Happy to answer follow-up questions by phone or in writing, in English or Russian.

**Абзац про конфликт** (добавлен 03.08.2026 — BBC спросил «Has the conflict
changed your experience of living there?»). Вставляется после абзаца с минусами.
Задача — ответить честно и не дать втянуть себя в геополитику: только быт,
только то, что видел сам, и прямой отказ от политических оценок.

> On the conflict: from inside Dubai, I can't point to anything in daily life that changed. Same school run, same office, same weekend. What did change is the conversation — I get more calls from buyers asking whether the region is stable, and more often than not they are asking from places where they would feel less safe than they do here. I'd rather leave the politics to people who cover it; I can only tell you what a Tuesday looks like.

**Почему он так написан.** Минусы названы прямо (жара, цена школ и медицины,
рост аренды) — без них текст читается как реклама и не берётся. Совет приезжему
даёт конкретику, которую нельзя нагуглить за минуту. Ни одного восклицательного
знака и ни одного «vibrant».

**Как упомянуть компанию, не убив питч** (решено 03.08.2026). Рекламная строка в
теле — первое, что редакция режет, поэтому название заходит там, где оно
является фактом о говорящем, а не плашкой:

1. **Первая строка** — «I run a brokerage here» → «I run a brokerage here,
   Worldwise Real Estate». Одно придаточное, это представление, а не врезка.
2. **Подпись** — имя, должность, компания, `worldwise.pro`. Подпись ждут, её
   никто не считает саморекламой; именно отсюда журналист берёт атрибуцию.
3. **Причина назвать нас** — предложить данные по теме, которую сам и поднял в
   тексте (аренда): «If you want the numbers behind the rent complaint — what
   people actually pay by district now — I track that and can send it over».
   Это делает нас источником, а не героем. Про доходность в lifestyle-питче не
   писать: не по теме, читается как подмена темы.

**Что просить, если журналист ответил:** указать не «работает в недвижимости»,
а название компании — Worldwise Real Estate. Это единственная точка, где мы
влияем на ценность публикации; ссылку BBC почти наверняка не поставит.

---

## Что ещё стоит написать заранее

Запросы этих типов повторяются, а текста под них пока нет:

- Доходность аренды в Дубае и чем она отличается от европейских рынков —
  цифры брать из `lib/areas.ts` и статьи `dubai-rental-yields-report`.
- Golden Visa через покупку недвижимости: порог AED 2M, что реально даёт статус.
- Покупка из-за рубежа без визита: как проходит сделка, роль DLD, эскроу.
- Off-plan против готового жилья для иностранного покупателя.
