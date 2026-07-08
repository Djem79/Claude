import { NextRequest, NextResponse } from 'next/server'
import { publishDraft, deleteDraft, DynamicArticle } from '@/lib/dynamic-articles'
import { writeFileAtomic } from '@/lib/atomic-write'
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { saveLead, findLeadByPhone, updateLead, deleteLead } from '@/lib/leads'
import { parseLeadText, parseLeadCommand } from '@/lib/lead-parse'
import { fanOutPost, formatFanOutSummary } from '@/lib/social-post'

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

async function handleCtaKeyword(chatId: number | string, keyword: string, from: TgUser) {
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
  vk: 'VK',
  ok: 'OK',
  dzen: 'Дзен',
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
    [
      { text: 'VK', callback_data: `leadsrc:${id}:vk` },
      { text: 'OK', callback_data: `leadsrc:${id}:ok` },
      { text: 'Дзен', callback_data: `leadsrc:${id}:dzen` },
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

// Returns false when the channel post did not go out — the callback answer must
// reflect it (the admin's only other trace is a PM2 log line nobody tails).
async function postToChannel(article: DynamicArticle): Promise<boolean> {
  const channelId = process.env.TELEGRAM_CHANNEL_ID
  if (!channelId) return true // channel posting not configured — nothing to fail
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
    `👉 [Read the full article](${url})`,
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
        return res.ok
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
    return res.ok
  } catch (e) {
    console.error('[telegram-webhook] postToChannel error', e)
    return false
  }
}

// Fetch a locally-rendered card image (e.g. /api/blog-image?...) as a Buffer
// for the VK/OK fan-out. Null on any failure — the fan-out degrades to a
// text-only post rather than blocking publication.
async function fetchLocalImage(imagePath: unknown): Promise<Buffer | null> {
  if (typeof imagePath !== 'string' || !imagePath) return null
  try {
    const res = await fetch(`http://localhost:3000${imagePath}`, { signal: AbortSignal.timeout(15000) })
    if (!res.ok) return null
    return Buffer.from(await res.arrayBuffer())
  } catch {
    return null
  }
}

// Returns false when the channel post did not go out (never throws) — the
// callback answer must reflect the real outcome, not assume success.
async function postPlanToChannel(post: Record<string, unknown>): Promise<boolean> {
  const channelId = process.env.TELEGRAM_CHANNEL_ID
  if (!channelId) return true // channel posting not configured — nothing to fail
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
        return res.ok
      }
      console.error('[telegram-webhook] postPlanToChannel card fetch failed', imgRes.status)
    } catch (e) {
      console.error('[telegram-webhook] postPlanToChannel image error', e)
    }
  }

  // Errors stay caught here (an unobserved rejection would crash the single PM2
  // process) — the boolean carries the outcome to the caller instead.
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: channelId, text }),
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) console.error('[telegram-webhook] postPlanToChannel text failed', await res.text())
    return res.ok
  } catch (e) {
    console.error('[telegram-webhook] postPlanToChannel text error', e)
    return false
  }
}

// Minimal shapes of the Telegram update payloads we actually read — keeps the
// handlers typed without pulling in a bot SDK.
interface TgUser {
  first_name?: string
  last_name?: string
  username?: string
}
interface TgMessage {
  text?: string
  chat?: { id: number | string }
  from?: TgUser
}
interface TgCallback {
  id: string
  data?: string
  message?: { chat: { id: number | string }; message_id: number }
}

/**
 * Acknowledge a callback button and strip/replace the message's keyboard —
 * the answer/edit pair every callback branch needs (was copy-pasted 3x).
 * With `newText` the message text is replaced; without it only the keyboard
 * is removed.
 */
async function answerAndEdit(
  callbackId: string,
  chatId: number | string,
  messageId: number,
  answerText: string,
  newText?: string
) {
  const token = process.env.TELEGRAM_BOT_TOKEN!
  const editMethod = newText !== undefined ? 'editMessageText' : 'editMessageReplyMarkup'
  const editBody: Record<string, unknown> = {
    chat_id: chatId,
    message_id: messageId,
    reply_markup: { inline_keyboard: [] },
  }
  if (newText !== undefined) editBody.text = newText
  await Promise.all([
    fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ callback_query_id: callbackId, text: answerText }),
      signal: AbortSignal.timeout(8000),
    }),
    fetch(`https://api.telegram.org/bot${token}/${editMethod}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editBody),
      signal: AbortSignal.timeout(8000),
    }),
  ])
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

  const message = body.message as TgMessage | undefined
  if (message?.text && message.chat) {
    await handleTextMessage(message as TgMessage & { text: string; chat: { id: number | string } })
    return NextResponse.json({ ok: true })
  }

  const callback = body.callback_query as TgCallback | undefined
  if (callback) {
    await handleCallback(callback)
  }
  return NextResponse.json({ ok: true })
}

// Text messages: public CTA keywords, then admin-only commands and lead pastes.
async function handleTextMessage(message: TgMessage & { text: string; chat: { id: number | string } }) {
  const chatId = String(message.chat.id)
  const allowed = allowedChatIds()
  const text = message.text

  // CTA keyword handler — open to any subscriber, not just admin
  const keyword = text.trim().toUpperCase()
  if (Object.prototype.hasOwnProperty.call(CTA_REPLIES, keyword)) {
    try {
      await handleCtaKeyword(message.chat.id, keyword, message.from ?? {})
    } catch (e) {
      console.error('[telegram-webhook] handleCtaKeyword error', e)
    }
    return
  }

  // Everything below is admin-only
  if (!allowed.includes(chatId)) return

  // /add_keyword — first chat id only (unchanged)
  if (text.toLowerCase().startsWith('/add_keyword')) {
    if (chatId !== allowed[0]) return
    const query = text.replace(/^\/add_keyword\s*/i, '').trim()
    if (!query) {
      await sendMessage(message.chat.id, '❌ Usage: /add_keyword <search query>')
      return
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
    return
  }

  // /lead command — works in group chats even with bot privacy mode ON
  // (commands reach the bot; plain text doesn't). Also valid in DMs.
  const leadCommand = parseLeadCommand(text)
  if (leadCommand !== null) {
    if (!leadCommand) {
      await sendMessage(message.chat.id, 'Использование: /lead <имя, телефон, email> (можно с новой строки)')
      return
    }
    try {
      await handleLeadIntake(message.chat.id, leadCommand)
    } catch (e) {
      console.error('[telegram-webhook] handleLeadIntake error', e)
      await sendMessage(message.chat.id, '⚠️ Ошибка при сохранении лида, попробуйте позже.')
    }
    return
  }

  // Ignore other slash commands; in a DM, plain text is treated as a lead paste
  if (text.startsWith('/')) return
  try {
    await handleLeadIntake(message.chat.id, text)
  } catch (e) {
    console.error('[telegram-webhook] handleLeadIntake error', e)
    await sendMessage(message.chat.id, '⚠️ Ошибка при сохранении лида, попробуйте позже.')
  }
}

// Callback buttons: lead source/delete, publish/skip article and plan posts.
async function handleCallback(callback: TgCallback) {
  const { id: callbackId, data, message: cbMessage } = callback
  if (!cbMessage) return
  const chatId = cbMessage.chat.id
  const messageId = cbMessage.message_id

  // Defence-in-depth: callback buttons (delete lead, publish article/plan) are
  // admin-only. The WEBHOOK_SECRET header alone is not enough — require the chat
  // to be in the allowlist, mirroring the text-command branch. Without this,
  // anyone who can press an inline button in a non-admin chat (or anyone who learns
  // the secret) could delete leads or publish drafts.
  if (!allowedChatIds().includes(String(chatId))) return

  if (typeof data === 'string' && data.startsWith('leadsrc:')) {
    const [, id, src] = data.split(':')
    const updated = updateLead(id, { source: src }, { uid: 'telegram', username: 'telegram-bot', name: 'Telegram' })
    const newText = updated
      ? `✅ Добавлено в CRM — источник: ${LEAD_SOURCE_LABEL[src] ?? src}\n👤 ${updated.name} · 📞 ${updated.phone}`
      : '⚠️ Лид не найден'
    await answerAndEdit(callbackId, chatId, messageId, updated ? `✅ ${LEAD_SOURCE_LABEL[src] ?? src}` : '⚠️ Лид не найден', newText)
    return
  }

  if (typeof data === 'string' && data.startsWith('leaddel:')) {
    const [, id] = data.split(':')
    const removed = deleteLead(id)
    await answerAndEdit(callbackId, chatId, messageId, removed ? '🗑 Удалён' : '⚠️ Не найден', removed ? '🗑 Лид удалён' : '⚠️ Лид не найден')
    return
  }

  let answerText: string
  if (data === 'publish_article') {
    const published = publishDraft()
    if (published) {
      // Await the channel post so the button answer reflects reality — the old
      // fire-and-forget always answered "Опубликовано" even when the channel
      // post failed (revoked admin rights, bad TELEGRAM_CHANNEL_ID, image error).
      const channelOk = await postToChannel(published)
      answerText = channelOk ? '✅ Опубликовано' : '✅ На сайте, но ⚠️ пост в канал не ушёл (см. логи)'
    } else {
      answerText = '⚠️ Черновик не найден'
    }
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
      // Await so the button answer reflects the real outcome (same fix as
      // publish_article above; postPlanToChannel never throws).
      const ok = await postPlanToChannel(planPost)
      // The preview is a photo message, so we can't edit destination statuses
      // into its text — send a separate persistent message instead: the
      // callback-answer toast vanishes in seconds and left no trace of where
      // the post actually landed (a VK outage went unnoticed for days).
      const title = String(planPost.text ?? '').split('\n')[0].slice(0, 60)
      if (ok) {
        // Fan out the approved post to VK/OK (Russian-audience mirrors of the
        // channel). Non-fatal by design: fanOutPost never throws, unconfigured
        // networks are skipped, and the summary shows per-network outcomes so
        // the button answer keeps reflecting reality (" · VK ✓ · OK ⚠️").
        const image = await fetchLocalImage(planPost.image)
        const social = formatFanOutSummary(await fanOutPost(String(planPost.text ?? ''), image))
        answerText = `✅ Опубликовано${social}`
        await sendMessage(chatId, `📮 «${title}» → Канал ✓${social}`)
      } else {
        answerText = '⚠️ Пост в канал не ушёл (см. логи)'
        await sendMessage(chatId, `📮 «${title}» → Канал ⚠️ не ушёл (см. логи)`)
      }
    } else {
      answerText = '⚠️ Черновик не найден'
    }
  } else if (data === 'skip_plan') {
    try { fs.unlinkSync(path.join(process.cwd(), 'data', 'plan-draft.json')) } catch { /* already gone */ }
    answerText = '❌ Пропущено'
  } else {
    return
  }

  // Keyboard-only edit: the approval message text stays, buttons disappear.
  await answerAndEdit(callbackId, chatId, messageId, answerText)
}
