import { NextRequest, NextResponse } from 'next/server'
import { publishDraft, deleteDraft, DynamicArticle } from '@/lib/dynamic-articles'
import { writeFileAtomic } from '@/lib/atomic-write'
import fs from 'fs'
import path from 'path'
import { saveLead, findLeadByPhone, updateLead, deleteLead } from '@/lib/leads'
import { parseLeadText, parseLeadCommand } from '@/lib/lead-parse'

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

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-telegram-bot-api-secret-token')
  if (!secret || secret !== process.env.WEBHOOK_SECRET) {
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
    const allowed = (process.env.TELEGRAM_CHAT_ID ?? '').split(',').map(s => s.trim()).filter(Boolean)
    if (!allowed.includes(chatId)) return NextResponse.json({ ok: true })

    const text: string = message.text

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
