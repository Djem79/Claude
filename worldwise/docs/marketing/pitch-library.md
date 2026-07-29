# Библиотека питчей для медиа-запросов

Готовые ответы на типовые запросы журналистов (Qwoted / HARO / Source of Sources).
Пишутся заранее, потому что дедлайны там 24–48 часов, а тексты повторяются.

**Как пользоваться:** взять раздел, подставить актуальные цифры и личные детали,
отправить. Тексты уже прогнаны через `humanizer` — не «улучшать» их обратно в
маркетинговый тон, редакции такое режут первыми.

**Куда отправлять:** Qwoted только с KZ-VPN и только вручную из Safari
(с российского IP аккаунт блокировали в июле 2026). HARO и SOS — обычной почтой
с `info@worldwise.pro`.

---

## Жизнь в Дубае глазами резидента

Под запросы формата «ищем жителей ОАЭ», «что такое качество жизни у вас»,
«почему вы переехали», «что посоветуете приезжему». Такие запросы приходят
регулярно в travel- и lifestyle-изданиях.

Написан для запроса BBC от 27.07.2026 (Qwoted, source request 256040 —
«Looking for residents in Panama, Mexico, UAE, Thailand, and Brazil»).
Отправлен не был: письмо нашли за полтора часа до дедлайна. Этот случай и
породил фит-детекцию в `scripts/mail-watch.py`.

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

**Почему он так написан.** Минусы названы прямо (жара, цена школ и медицины,
рост аренды) — без них текст читается как реклама и не берётся. Совет приезжему
даёт конкретику, которую нельзя нагуглить за минуту. Ни одного восклицательного
знака и ни одного «vibrant».

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
