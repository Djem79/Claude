import { NextRequest, NextResponse } from 'next/server'
import { publishDraft, deleteDraft, DynamicArticle } from '@/lib/dynamic-articles'
import { writeFileAtomic } from '@/lib/atomic-write'
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { saveLead, findLeadByPhone, updateLead, deleteLead } from '@/lib/leads'
import { parseLeadText, parseLeadCommand } from '@/lib/lead-parse'

/** Constant-time string comparison; false (not throw) on length mismatch or missing value. */
function safeEqual(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ab.length !== bb.length) return false
  return crypto.timingSafeEqual(ab, bb)
}

/** Chat IDs allowed to drive admin actions (text commands and callback buttons). */
function allowedChatIds(): string[] {
  return (process.env.TELEGRAM_CHAT_ID ?? '').split(',').map(s => s.trim()).filter(Boolean)
}

async function sendMessage(chatId: number | string, text: string, inlineKeyboard?: unknown[][]) {
  const token = process.env.TELEGRAM_BOT_TOKEN!
  const body: Record<string, unknown> = { chat_id: chatId, text }
  if (inlineKeyboard) body.reply_markup = { inline_keyboard: inlineKeyboard }
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) console.error('[telegram-webhook] sendMessage failed', await res.text())
  } catch (e) {
    console.error('[telegram-webhook] sendMessage network error', e)
  }
}

// CTA trigger words from channel posts — reply to any subscriber who sends them
const CTA_REPLIES: Record<string, string> = {
  СПИСОК: '🏠 Отправляем подборку!\n\nНапишите нам в WhatsApp — пришлём 5 актуальных объектов под ваш бюджет и цели.\n\n📞 +971 50 696 0435\n🌐 worldwise.pro',
  ГАЙД: '📋 Высылаем гайд!\n\nНапишите в WhatsApp — пришлём PDF-чек-лист покупателя в ОАЭ (7 вопросов застройщику, 4 шага сделки, список документов).\n\n📞 +971 50 696 0435\n🌐 worldwise.pro',
  ВИЗА: '🛂 Investor Visa в ОАЭ\n\nОт AED 750 000 — резидентская виза (2 года)\nОт AED 2 000 000 — Golden Visa (10 лет)\n\nОформление параллельно со сделкой: 18–21 день. Без бюрократии — ведём от А до Я.\n\nНапишите:\n📞 +971 50 696 0435',
  РАССРОЧКА: '💳 Рассрочка 0% vs ипотека\n\nОт застройщика: 0%, без банка, без проверки кредитной истории\nИпотека (нерезидент): от 4.5%, первый взнос 50%\n\nПришлём сравнение конкретных схем под ваш бюджет:\n📞 +971 50 696 0435',
  MARINA: '🌊 Dubai Marina — актуальные объекты\n\nROI аренды: 6.8–7.2% (долгосрочная) · 9–11% (посуточная)\nСредняя цена: AED 2 100/sqft\nВакантность: 4.2%\n\nПришлём подборку в WhatsApp:\n📞 +971 50 696 0435',
  HILLS: '🌿 Dubai Hills — актуальные объекты\n\nROI: 6.2–7.0% · Семейный район · Рядом с Golf Club\nСтабильный рост цен: +10% г/г\n\nПришлём подборку:\n📞 +971 50 696 0435',
  DOWNTOWN: '🏙 Downtown Dubai — актуальные объекты\n\nROI: 5.5–6.5% · Самый престижный адрес\nЦена вторичного: AED 2 800/sqft\n\nПришлём объекты в WhatsApp:\n📞 +971 50 696 0435',
  JLT: '🏢 JLT (Jumeirah Lake Towers) — актуальные объекты\n\nROI: 7.0–8.2% — один из лучших в Дубае\nЦена от AED 900 000 за 1BR\n\nПришлём подборку:\n📞 +971 50 696 0435',
}

// Rate-limit CTA replies per chat_id (5/hour). In-memory map, fine for single PM2 instance.
// Silent drop on exceed — don't tip off spammers that there's a limit. See tasks/lessons.md.
const CTA_RATE_LIMIT = 5
const CTA_WINDOW_MS = 60 * 60 * 1000
const ctaRateMap = new Map<string, { count: number; resetAt: number }>()

function isCtaRateLimited(chatId: number | string): boolean {
  const key = String(chatId)
  const now = Date.now()
  const rec = ctaRateMap.get(key)
  if (!rec || rec.resetAt < now) {
    ctaRateMap.set(key, { count: 1, resetAt: now + CTA_WINDOW_MS })
    return false
  }
  if (rec.count >= CTA_RATE_LIMIT) return true
  rec.count++
  return false
}

async function handleCtaKeyword(chatId: number | string, keyword: string, from: Record<string, unknown>) {
  if (isCtaRateLimited(chatId)) {
    console.warn(`[telegram-webhook] CTA rate-limit hit for chat ${chatId} (keyword "${keyword}")`)
    return
  }
  const reply = CTA_REPLIES[keyword] ?? '✅ Спасибо! Свяжемся с вами в ближайшее время.\n\n📞 +971 50 696 0435\n🌐 worldwise.pro'
  await sendMessage(chatId, reply)

  // Save as a lead — phone key is tg_{chatId} so we can dedup repeat sends
  const tgPhone = `tg_${chatId}`.slice(0, 40)
  const dup = findLeadByPhone(tgPhone)
  if (!dup) {
    const firstName = String(from?.first_name ?? '')
    const lastName = String(from?.last_name ?? '')
    const name = [firstName, lastName].filter(Boolean).join(' ') || 'Telegram'
    const username = from?.username ? `@${String(from.username)}` : undefined
    saveLead({
      name: name.slice(0, 120),
      phone: tgPhone,
      email: username,
      message: `CTA-триггер: ${keyword}`,
      source: 'telegram',
    })
  }
  // Notify first admin chat regardless of dedup — useful even for repeats
  const adminId = (process.env.TELEGRAM_CHAT_ID ?? '').split(',')[0].trim()
  if (adminId) {
    const firstName = String(from?.first_name ?? '')
    const lastName = String(from?.last_name ?? '')
    const displayName = [firstName, lastName].filter(Boolean).join(' ') || 'Аноним'
    const handle = from?.username ? ` · @${from.username}` : ''
    await sendMessage(adminId, `🔔 CTA: «${keyword}»\n👤 ${displayName}${handle}\n🆔 tg:${chatId}${dup ? '\n⚠️ Уже в CRM' : ' · ✅ Новый лид'}`)
  }
}

const TAG_EMOJI: Record<string, string> = {
  'Market Update': '📊',
  'Investment Guide': '📌',
  'Area Spotlight': '📍',
  'Legal Guide': '⚖️',
  'Visa & Residency': '🛂',
}

const LEAD_SOURCE_LABEL: Record<string, string> = {
  property_finder: 'Property Finder',
  bayut: 'Bayut',
  instagram_dm: 'Instagram',
  whatsapp: 'WhatsApp',
  other: 'Other',
}

function leadSourceKeyboard(id: string) {
  return [
    [
      { text: 'Property Finder', callback_data: `leadsrc:${id}:property_finder` },
      { text: 'Bayut', callback_data: `leadsrc:${id}:bayut` },
    ],
    [
      { text: 'Instagram', callback_data: `leadsrc:${id}:instagram_dm` },
      { text: 'WhatsApp', callback_data: `leadsrc:${id}:whatsapp` },
      { text: 'Other', callback_data: `leadsrc:${id}:other` },
    ],
    [{ text: '🗑 Удалить', callback_data: `leaddel:${id}` }],
  ]
}

async function handleLeadIntake(chatId: number | string, text: string) {
  const parsed = parseLeadText(text)
  if (!parsed.phone) {
    await sendMessage(chatId, '❌ Не нашёл телефон. Вставьте текст лида с номером (7–15 цифр).')
    return
  }
  const dup = findLeadByPhone(parsed.phone)
  const lead = saveLead({
    name: (parsed.name ?? 'Без имени').slice(0, 120),
    phone: parsed.phone.slice(0, 40),
    email: parsed.email?.slice(0, 160),
    message: parsed.note.slice(0, 2000),
    source: 'telegram',
  })
  const reply = [
    dup ? `⚠️ Возможный дубль: ${dup.name} (${new Date(dup.createdAt).toLocaleDateString('ru-RU')})` : null,
    '🆕 Лид сохранён в CRM',
    `👤 ${lead.name}`,
    `📞 ${lead.phone}`,
    lead.email ? `✉️ ${lead.email}` : null,
    '',
    'Источник?',
  ].filter(Boolean).join('\n')
  await sendMessage(chatId, reply, leadSourceKeyboard(lead.id))
}

function escapeMarkdownV2(text: string): string {
  return text.replace(/[\\*_[\]()~`>#+\-=|{}.!]/g, '\\$&')
}

async function postToChannel(article: DynamicArticle) {
  const channelId = process.env.TELEGRAM_CHANNEL_ID
  if (!channelId) return
  const token = process.env.TELEGRAM_BOT_TOKEN!
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://worldwise.pro').replace(/\/$/, '')
  const emoji = TAG_EMOJI[article.tag] ?? '📄'
  const tagHashtag = '\\#' + article.tag.replace(/[^a-zA-Z]/g, '')
  const url = `${siteUrl}/blog/${article.slug}`
  const text = [
    `${emoji} ${escapeMarkdownV2(article.tag)}`,
    '',
    `*${escapeMarkdownV2(article.title)}*`,
    '',
    escapeMarkdownV2(article.excerpt),
    '',
    `\\#DubaiRealEstate ${tagHashtag}`,
    '',
    `👉 [Читать статью](${url})`,
  ].join('\n')
  try {
    // The card is served by /api/blog-image (Next doesn't serve public/ files added
    // after start). Telegram's sendPhoto-by-URL rejects the query URL, so fetch the
    // bytes locally and upload them as multipart instead.
    if (article.image) {
      const imgRes = await fetch(`http://localhost:3000${article.image}`, { signal: AbortSignal.timeout(15000) })
      if (imgRes.ok) {
        const buf = Buffer.from(await imgRes.arrayBuffer())
        const fd = new FormData()
        fd.append('chat_id', channelId)
        fd.append('caption', text.slice(0, 1024))
        fd.append('parse_mode', 'MarkdownV2')
        fd.append('photo', new Blob([buf]), `${article.slug}.png`)
        const res = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, { method: 'POST', body: fd, signal: AbortSignal.timeout(15000) })
        if (!res.ok) console.error('[telegram-webhook] postToChannel sendPhoto failed', await res.text())
        return
      }
      console.error('[telegram-webhook] postToChannel card fetch failed', imgRes.status)
    }
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: channelId, text, parse_mode: 'MarkdownV2' }),
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) console.error('[telegram-webhook] postToChannel failed', await res.text())
  } catch (e) {
    console.error('[telegram-webhook] postToChannel error', e)
  }
}

async function postPlanToChannel(post: Record<string, unknown>) {
  const channelId = process.env.TELEGRAM_CHANNEL_ID
  if (!channelId) return
  const token = process.env.TELEGRAM_BOT_TOKEN!
  const text = String(post.text ?? '')

  if (post.image) {
    try {
      const imgRes = await fetch(`http://localhost:3000${post.image}`, { signal: AbortSignal.timeout(15000) })
      if (imgRes.ok) {
        const buf = Buffer.from(await imgRes.arrayBuffer())
        const fd = new FormData()
        fd.append('chat_id', channelId)
        fd.append('caption', text.slice(0, 1024))
        fd.append('photo', new Blob([buf]), `${post.slug ?? 'post'}.png`)
        const res = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
          method: 'POST', body: fd, signal: AbortSignal.timeout(15000),
        })
        if (!res.ok) console.error('[telegram-webhook] postPlanToChannel sendPhoto failed', await res.text())
        return
      }
      console.error('[telegram-webhook] postPlanToChannel card fetch failed', imgRes.status)
    } catch (e) {
      console.error('[telegram-webhook] postPlanToChannel image error', e)
    }
  }

  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: channelId, text }),
    signal: AbortSignal.timeout(10000),
  })
  if (!res.ok) console.error('[telegram-webhook] postPlanToChannel text failed', await res.text())
}

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-telegram-bot-api-secret-token')
  if (!safeEqual(secret, process.env.WEBHOOK_SECRET)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: true })
  }

  const message = body.message as any
  if (message?.text) {
    const chatId = String(message.chat?.id ?? '')
    const allowed = allowedChatIds()
    const text: string = message.text

    // CTA keyword handler — open to any subscriber, not just admin
    const keyword = text.trim().toUpperCase()
    if (Object.prototype.hasOwnProperty.call(CTA_REPLIES, keyword)) {
      try {
        await handleCtaKeyword(message.chat.id, keyword, message.from ?? {})
      } catch (e) {
        console.error('[telegram-webhook] handleCtaKeyword error', e)
      }
      return NextResponse.json({ ok: true })
    }

    // Everything below is admin-only
    if (!allowed.includes(chatId)) return NextResponse.json({ ok: true })

    // /add_keyword — first chat id only (unchanged)
    if (text.toLowerCase().startsWith('/add_keyword')) {
      if (chatId !== allowed[0]) return NextResponse.json({ ok: true })
      const query = text.replace(/^\/add_keyword\s*/i, '').trim()
      if (!query) {
        await sendMessage(message.chat.id, '❌ Usage: /add_keyword <search query>')
        return NextResponse.json({ ok: true })
      }
      const keywordsPath = path.join(process.cwd(), 'data', 'article-keywords.json')
      let data: { keywords: string[]; index: number } = { keywords: [], index: 0 }
      try {
        data = JSON.parse(fs.readFileSync(keywordsPath, 'utf-8'))
      } catch (e) {
        console.error('[telegram-webhook] Failed to read keywords file, starting fresh', e)
      }
      data.keywords.push(query)
      writeFileAtomic(keywordsPath, JSON.stringify(data, null, 2))
      await sendMessage(message.chat.id, `✅ Добавлено: "${query}"\nВсего в банке: ${data.keywords.length} запросов`)
      return NextResponse.json({ ok: true })
    }

    // /lead command — works in group chats even with bot privacy mode ON
    // (commands reach the bot; plain text doesn't). Also valid in DMs.
    const leadCommand = parseLeadCommand(text)
    if (leadCommand !== null) {
      if (!leadCommand) {
        await sendMessage(message.chat.id, 'Использование: /lead <имя, телефон, email> (можно с новой строки)')
        return NextResponse.json({ ok: true })
      }
      try {
        await handleLeadIntake(message.chat.id, leadCommand)
      } catch (e) {
        console.error('[telegram-webhook] handleLeadIntake error', e)
        await sendMessage(message.chat.id, '⚠️ Ошибка при сохранении лида, попробуйте позже.')
      }
      return NextResponse.json({ ok: true })
    }

    // Ignore other slash commands; in a DM, plain text is treated as a lead paste
    if (text.startsWith('/')) return NextResponse.json({ ok: true })
    try {
      await handleLeadIntake(message.chat.id, text)
    } catch (e) {
      console.error('[telegram-webhook] handleLeadIntake error', e)
      await sendMessage(message.chat.id, '⚠️ Ошибка при сохранении лида, попробуйте позже.')
    }
    return NextResponse.json({ ok: true })
  }

  // publish / skip callback buttons
  const callback = body.callback_query as any
  if (!callback) return NextResponse.json({ ok: true })

  const { id: callbackId, data, message: cbMessage } = callback
  if (!cbMessage) return NextResponse.json({ ok: true })
  const chatId = cbMessage.chat.id
  const messageId = cbMessage.message_id
  const token = process.env.TELEGRAM_BOT_TOKEN!

  // Defence-in-depth: callback buttons (delete lead, publish article/plan) are
  // admin-only. The WEBHOOK_SECRET header alone is not enough — require the chat
  // to be in the allowlist, mirroring the text-command branch above. Without this,
  // anyone who can press an inline button in a non-admin chat (or anyone who learns
  // the secret) could delete leads or publish drafts.
  if (!allowedChatIds().includes(String(chatId))) {
    return NextResponse.json({ ok: true })
  }

  let answerText: string

  if (typeof data === 'string' && data.startsWith('leadsrc:')) {
    const [, id, src] = data.split(':')
    const updated = updateLead(id, { source: src }, { uid: 'telegram', username: 'telegram-bot', name: 'Telegram' })
    answerText = updated ? `✅ ${LEAD_SOURCE_LABEL[src] ?? src}` : '⚠️ Лид не найден'
    const newText = updated
      ? `✅ Добавлено в CRM — источник: ${LEAD_SOURCE_LABEL[src] ?? src}\n👤 ${updated.name} · 📞 ${updated.phone}`
      : '⚠️ Лид не найден'
    await Promise.all([
      fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callback_query_id: callbackId, text: answerText }),
        signal: AbortSignal.timeout(8000),
      }),
      fetch(`https://api.telegram.org/bot${token}/editMessageText`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, message_id: messageId, text: newText, reply_markup: { inline_keyboard: [] } }),
        signal: AbortSignal.timeout(8000),
      }),
    ])
    return NextResponse.json({ ok: true })
  }

  if (typeof data === 'string' && data.startsWith('leaddel:')) {
    const [, id] = data.split(':')
    const removed = deleteLead(id)
    answerText = removed ? '🗑 Удалён' : '⚠️ Не найден'
    await Promise.all([
      fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callback_query_id: callbackId, text: answerText }),
        signal: AbortSignal.timeout(8000),
      }),
      fetch(`https://api.telegram.org/bot${token}/editMessageText`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, message_id: messageId, text: removed ? '🗑 Лид удалён' : '⚠️ Лид не найден', reply_markup: { inline_keyboard: [] } }),
        signal: AbortSignal.timeout(8000),
      }),
    ])
    return NextResponse.json({ ok: true })
  }

  if (data === 'publish_article') {
    const published = publishDraft()
    answerText = published ? '✅ Опубликовано' : '⚠️ Черновик не найден'
    if (published) postToChannel(published)
  } else if (data === 'skip_article') {
    deleteDraft()
    answerText = '❌ Пропущено'
  } else if (data === 'publish_plan') {
    const planDraftPath = path.join(process.cwd(), 'data', 'plan-draft.json')
    let planPost: Record<string, unknown> | null = null
    try {
      planPost = JSON.parse(fs.readFileSync(planDraftPath, 'utf-8'))
    } catch {
      // draft missing or unreadable
    }
    if (planPost) {
      postPlanToChannel(planPost)
      answerText = '✅ Опубликовано'
    } else {
      answerText = '⚠️ Черновик не найден'
    }
  } else if (data === 'skip_plan') {
    try { fs.unlinkSync(path.join(process.cwd(), 'data', 'plan-draft.json')) } catch { /* already gone */ }
    answerText = '❌ Пропущено'
  } else {
    return NextResponse.json({ ok: true })
  }

  await Promise.all([
    fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ callback_query_id: callbackId, text: answerText }),
    }),
    fetch(`https://api.telegram.org/bot${token}/editMessageReplyMarkup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: messageId,
        reply_markup: { inline_keyboard: [] },
      }),
    }),
  ])

  return NextResponse.json({ ok: true })
}
