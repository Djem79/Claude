# Добавление лидов через Telegram-бота / Adding leads via the Telegram bot

Бот / Bot: **@WorldwiseLeads_bot**

---

## 🇷🇺 Русский

### В рабочей группе
Напишите команду `/lead`, затем данные клиента (можно с новой строки):

```
/lead
Иван Петров
+971 50 123 4567
ivan@mail.ru
Интересует 2BR в Dubai Marina
```

### В личке боту
Можно просто вставить текст лида — **без** `/lead`.

### Что дальше
1. Бот сохранит лид в CRM и пришлёт подтверждение.
2. Покажет кнопки — выберите источник: **Property Finder / Bayut / Instagram / WhatsApp / Other**.
3. Если такой телефон уже есть — предупредит «⚠️ Возможный дубль» (лид всё равно сохранится).
4. Кнопка **🗑 Удалить** — убрать ошибочный лид.

### Важно
- Обязателен **телефон** (7–15 цифр). Без него бот попросит добавить номер.
- Имя, email и комментарий — по возможности (помогают в работе).
- Можно просто скопировать блок лида из кабинета Property Finder и вставить после `/lead`.
- Все лиды видны в CRM: **worldwise.pro/admin/leads**.

---

## 🇬🇧 English

### In the team group
Send the command `/lead`, then the client details (a new line is fine):

```
/lead
John Smith
+971 50 123 4567
john@example.com
Interested in a 2BR in Dubai Marina
```

### In a direct message to the bot
Just paste the lead text — **no** `/lead` needed.

### What happens next
1. The bot saves the lead to the CRM and confirms.
2. It shows buttons — pick the source: **Property Finder / Bayut / Instagram / WhatsApp / Other**.
3. If the phone already exists, it warns "⚠️ Possible duplicate" (the lead is still saved).
4. The **🗑 Delete** button removes a lead added by mistake.

### Notes
- A **phone number** is required (7–15 digits). Without it the bot asks you to add one.
- Name, email and a note are optional but helpful.
- You can simply copy a lead block from the Property Finder dashboard and paste it after `/lead`.
- All leads appear in the CRM: **worldwise.pro/admin/leads**.
