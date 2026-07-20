# Черновики месячных контент-планов (TG-канал «Смотрим Дубай»)

Здесь лежат **черновики** месячных планов автопостинга до их заливки на сервер.
Боевой файл живёт только на сервере: `data/content-plan-<month>-<year>.json`
(server-only, читается `scripts/post-from-plan.mjs` по Dubai wall clock).

## Как активировать черновик на сервере

```bash
# скопировать черновик в боевой путь (переименовать draft → рабочее имя)
scp -i ~/.ssh/id_ed25519 \
  worldwise/docs/marketing/content-plans/2026-08-content-plan-draft.json \
  root@62.238.35.20:/var/www/worldwise/data/content-plan-august-2026.json
```

Билд/рестарт не нужен — `post-from-plan.mjs` читает `data/` в рантайме.
Проверить, что скрипт видит план на 1-е число месяца: он сам возьмёт первый
`sent: false` пост по дате и в 06:00 UTC пришлёт превью на ✅ в Telegram.

## 2026-08 (август)

`2026-08-content-plan-draft.json` — 31 пост, недельный ритм
(Сб=viral, Вс=poll, Пн=market_update, Вт=area_spotlight, Ср=guide, Чт=qa, Пт=case_study).
market_update построены на **проверенных** DLD-цифрах H1 2026 и июня 2026
(286,43 млрд / 86 005 сделок; июнь 13 766/32,66 млрд; ипотека +49% MoM;
off-plan 72,3%; топ-районы Dubai South/JVC/Business Bay). area_spotlight yields
из `lib/areas.ts` (Marina 5,5–6,5%, Palm 5–6%, Damac Hills 2 7–9%, Dubai Hills 5,5–6,5%).
Перед заливкой стоит сверить свежими июльскими цифрами DLD, если вышли.
