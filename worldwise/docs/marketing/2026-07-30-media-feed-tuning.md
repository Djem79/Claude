# Настройка фидов площадок: теги Qwoted, категории HARO, дедупликация ящиков

**Дата:** 2026-07-30 · **Статус:** ✅ ПРИМЕНЕНО 30.07.2026 (юзер вошёл в аккаунты, правки внесены
из сессии — фактическое состояние в разделе «Что применено» ниже)
· Дополняет [`2026-07-09-journalist-platforms-playbook.md`](2026-07-09-journalist-platforms-playbook.md)
(регистрация, bio, шаблон питча) — здесь только настройка входящего потока.

## Зачем

За 27–30 июля разобрано 14 дайджестов (Qwoted, HARO, SOS) — **один фит**, и тот сгорел
(BBC искал жителей ОАЭ, дедлайн 29.07 16:14 MSK). Остальное — рынок США: FHA, ипотека Огайо,
estate tax Баффета, конфликт интересов агент↔лендер, пенсионное планирование.

Причина не в фильтре `mail-watch.py` (проверено на живых письмах: `find_fits` даёт 0 на
американских дайджестах и ловит `«BBC … residents in Panama, Mexico, UAE …»` с дедлайном).
Причина в подписках: **Qwoted в шапке каждого письма пишет, почему его прислал** —

> Because you follow **#TaxPlanning** · Because you follow **#MortgageLending** ·
> Because you follow **#RealEstateTransactions**

Это три американских финансовых тега. Площадка честно шлёт ровно то, на что мы подписаны.
Фильтровать на выходе бесполезно, если на входе заказана не та тема.

## 1. Qwoted — теги профиля (главный рычаг)

**Где:** `app.qwoted.com/my_interests` → кнопка «Add tags» вверху профиля.

**Правила площадки** (Qwoted Help Center, [топикальные теги](https://intercom.help/qwoted/en/articles/5620119-what-are-topical-tags-and-how-can-i-add-them-to-my-pr-or-expert-profile)):

- Вводить **без символа `#`** — с решёткой тег не сохранится.
- Теги предопределённые: набираешь текст → выпадает список → выбираешь из него. Своего тега
  не создать, поэтому ниже — **поисковые запросы**, а не гарантированно существующие названия.
  Нет термина в выпадашке → бери ближайший по смыслу и скажи мне, чего не хватило.
- До 50 тегов на профиль. Брать все 50 не надо: каждый широкий тег тянет свой поток мусора.
  Цель — 15–20 узких.

### Снять (источник текущего шума)

| Тег | Что приносит |
| --- | --- |
| `TaxPlanning` | Fortune про estate tax Баффета, MoneyWise про пенсию супруга — налоговое право США |
| `MortgageLending` | U.S. News про credit score и DTI, FHA/DPA-программы |
| `RealEstateTransactions` | Bankrate про affiliated lender referrals и steering — регуляторика США (RESPA), у нас такой конструкции рынка нет |

### Поставить

**A. География — максимальный приоритет** (без неё всё остальное снова притянет США):

`Dubai` · `UAE` · `United Arab Emirates` · `Abu Dhabi` · `Middle East` · `GCC` · `Gulf` ·
`Emerging Markets`

**B. Наш предмет:**

`International Real Estate` · `Global Real Estate` · `Overseas Property` ·
`Real Estate Investing` · `Property Investment` · `Luxury Real Estate` ·
`Off-Plan Property` · `Rental Yields` · `Real Estate Market Trends` · `Foreign Investment`

**C. Наш покупатель:**

`Expat` · `Expatriate` · `Relocation` · `Golden Visa` · `Residency by Investment` ·
`Citizenship by Investment` · `Investment Migration` · `Second Home` · `Retire Abroad` ·
`Digital Nomad` · `HNWI` · `Family Office`

### Сознательно НЕ брать

`Mortgage`, `HomeBuying`, `HousingMarket`, `FirstTimeHomeBuyer`, `PersonalFinance`,
`RealEstateAgent`, `Realtor` — это ровно те широкие теги, из-за которых поток и стал
американским. Ипотека нерезидента в ОАЭ ловится через связку «география + International Real
Estate», а не через `Mortgage`.

> Free-тариф Qwoted = **2 питча в месяц** и 2 часа задержки (см. плейбук). Смысл настройки в
> том, чтобы эти два питча уходили на дубайские запросы, а не тратились на «хоть что-то».

## 2. HARO — категории дайджеста

HARO шлёт 3 выпуска в день и по умолчанию подписывает на **master list** — все категории
сразу. В наших выпусках 29–30 июля видны секции: `BUSINESS AND FINANCE`, `TRAVEL`,
`LIFESTYLE AND ENTERTAINMENT`, `Health and Pharma`. Из 60 запросов за сутки к нам не
относился ни один — половину занимали БАДы и клинические исследования.

**Сделать:** в настройках подписки снять master list и оставить **Business and Finance**
(там живут real estate, инвестиции, предпринимательство) и, опционально, **Travel** (туда
попадают expat/relocation-сюжеты). Health and Pharma, Lifestyle, High Tech — снять.

Гео-фильтра у HARO нет: даже в Business and Finance ~90% останется рынком США. Это потолок
площадки, дальше работает наш `FIT_RE`.

## 3. SOS (Source of Sources) — настроек нет

Подписка — только имя, email и галочка «Send me daily media queries»; выбора категорий на
сайте нет ([sourceofsources.com](https://www.sourceofsources.com/)). Единственный рычаг —
наш фильтр. Помним правило площадки: **один оффтоп-питч = пожизненный бан**, так что
дисциплина релевантности здесь важнее объёма.

## 4. Featured — ручной обход

Воркфлоу платные, чат бесплатный. Раз в неделю: New chat → «What are the current open
questions matching Dubai real estate or property investment?» → результат мне в сессию.
Прогон 30.07 дал 0 opportunities; Featured предложил вместо этого найти журналистов,
пишущих на тему, — стоит согласиться и один раз забрать список для прямого питча.
Решение от 10.07 (не платить за Lite, пока SOS/HARO не дадут первые ссылки) в силе.

## 5. Дедупликация ящиков

Один и тот же дайджест сейчас приходит трижды: HARO — на `info@`, на `dzhambulat@` **и** в
личный Gmail; SOS — на `dzhambulat@` и в Gmail. Каждый разбирается отдельно, толку ноль.

**Сделать:** оставить по одной подписке на площадку, все на `info@worldwise.pro` — там уже
живёт Qwoted и туда смотрит `mail-watch.py`. Личный Gmail от HARO/SOS отписать.

## 6. Как поймём, что помогло

В логе `/var/log/worldwise-mail-watch.log` считаем строки `🔥 ФИТ` за неделю (после
2026-07-30 пуш в Telegram уходит только на них — см. `scripts/mail-watch.py`).

- База до настройки: **1 фит за 4 дня** (27–30 июля), и тот пропущен по дедлайну.
- Цель после: ≥2 фитов в неделю при том же объёме писем.
- Пересмотр через 3–4 недели: если Qwoted после смены тегов всё равно даёт американский
  поток — площадка нам не подходит, время уходит в Featured/прямой питч журналистам.

## 7. Что применено 30.07.2026 (факт)

### Qwoted — теги оказались НЕ на `/my_interests`

`app.qwoted.com/my_interests` редиректит на PR-профиль; отдельной страницы «интересов»
у площадки нет. Теги живут в модалке **Expertise** (кнопка-карандаш под строкой тегов) на
ДВУХ поверхностях, и обе правятся отдельно:

1. **Source-профиль** (`/sources/dzhambulat-tkhazaplizhev`) — там и лежал источник шума.
2. **PR-профиль** (`/pr_users/dzhambulat-tkhazaplizhev`) — был **пуст**, теперь заполнен.

Механика подтверждена в бою: поле — Select2 с ajax-подсказками, ввод **без `#`**, выбор из
выпадашки, лимит 50. Опция `New tag: '…'` в списке есть (свой тег технически создать МОЖНО,
вопреки хелп-центру), но брать её незачем — матчинг идёт по тегам, которыми пользуются
журналисты.

**Снято** с source-профиля (7): `RealEstateFinance`, `HousingMarket`, `MortgageLoan`,
`HomeBuying`, `Homeownership`, `PropertyManagement`, `HomeRenovations`.
**Оставлено** (2): `RealEstateInvestment`, `RealEstateInvesting`.

**Добавлено** (одинаково на обеих поверхностях; source = 23 тега, PR-профиль = 20):

| Группа | Теги |
| --- | --- |
| Гео | `Dubai` `UAE` `UnitedArabEmirates` `AbuDhabi` `MiddleEast` `GCC` |
| Предмет | `InternationalRealEstate` `GlobalRealEstate` `OverseasProperty` `LuxuryRealEstate` `OffPlanDubai` `RentalYields` `PropertyInvestment` `ForeignInvestment` |
| Покупатель | `Goldenvisa` `GoldenVisaDubai` `Expat` `Relocation` `ResidencyByInvestment` `Citizenshipbyinvestment` `HNWI` |

`EmergingMarkets` сознательно НЕ взят (широкий финансовый тег — потянет макро-аналитику США).
Оба набора проверены перезагрузкой страницы после сохранения.

**Открытый вопрос:** письма ссылались и на теги, которых на профиле не было
(`TaxPlanning`, `MortgageLending`, `MortgageLoans`, `RealEstateTransactions`,
`RealEstateDevelopment`, `ResidentialRealEstate`) — либо Qwoted подмешивает смежные теги
запроса, либо есть legacy-подписка без UI. Проверяется тем же счётчиком ФИТ: если
американский поток сохранится при чистых тегах — писать в поддержку площадки.

### HARO — категорий оказалось максимум 2, и главный поток шёл мимо рабочего ящика

Страница `helpareporter.com/manage-subscription` пускает по magic-link на почту (пароль не
нужен). Дайджесты, падавшие в `dzhambulat@`, адресованы **`tdm.979@gmail.com`** — подписка
оформлена на личный Gmail и пересылается на рабочий ящик.

- `info@worldwise.pro` — было «все категории», стало **Business and Finance + Travel**
  (жёсткий лимит площадки — 2). Три выпуска в день оставлены: они несут разные запросы,
  а шум теперь режется категориями и `FIT_RE`.
- `tdm.979@gmail.com` — **отписан полностью** (был дубль в максимальной комплектации:
  все категории × 3 выпуска).
- `dzhambulat@worldwise.pro` — прямой подписки нет; форма при вводе адреса заводит новую
  неподтверждённую — откачена через `/api/unsubscribe`.

SOS не трогали: приходит один раз (через тот же Gmail-форвард), дубля нет, настроек у
площадки не существует.
