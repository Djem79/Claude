import { NextRequest, NextResponse } from 'next/server'
import { publishDraft, deleteDraft } from '@/lib/dynamic-articles'
import fs from 'fs'
import path from 'path'

async function sendMessage(chatId: number, text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN!
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text }),
  })
}

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-telegram-bot-api-secret-token')
  if (!secret || secret !== process.env.WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()

  // /add_keyword text command
  const message = body.message
  if (message?.text) {
    const expectedChatId = (process.env.TELEGRAM_CHAT_ID ?? '').split(',')[0].trim()
    if (String(message.chat.id) === expectedChatId) {
      const text: string = message.text
      if (text.toLowerCase().startsWith('/add_keyword')) {
        const query = text.replace(/^\/add_keyword\s*/i, '').trim()
        if (!query) {
          await sendMessage(message.chat.id, '❌ Usage: /add_keyword <search query>')
          return NextResponse.json({ ok: true })
        }
        const keywordsPath = path.join(process.cwd(), 'data', 'article-keywords.json')
        let data: { keywords: string[]; index: number } = { keywords: [], index: 0 }
        try {
          data = JSON.parse(fs.readFileSync(keywordsPath, 'utf-8'))
        } catch {}
        data.keywords.push(query)
        fs.writeFileSync(keywordsPath, JSON.stringify(data, null, 2), 'utf-8')
        await sendMessage(message.chat.id, `✅ Добавлено: "${query}"\nВсего в банке: ${data.keywords.length} запросов`)
        return NextResponse.json({ ok: true })
      }
    }
    return NextResponse.json({ ok: true })
  }

  // publish / skip callback buttons
  const callback = body.callback_query
  if (!callback) return NextResponse.json({ ok: true })

  const { id: callbackId, data, message: cbMessage } = callback
  const chatId = cbMessage.chat.id
  const messageId = cbMessage.message_id
  const token = process.env.TELEGRAM_BOT_TOKEN!

  let answerText: string
  if (data === 'publish_article') {
    const published = publishDraft()
    answerText = published ? '✅ Опубликовано' : '⚠️ Черновик не найден'
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
