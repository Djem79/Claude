import { NextRequest, NextResponse } from 'next/server'
import { publishDraft, deleteDraft } from '@/lib/dynamic-articles'

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-telegram-bot-api-secret-token')
  if (!secret || secret !== process.env.WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const callback = body.callback_query
  if (!callback) return NextResponse.json({ ok: true })

  const { id: callbackId, data, message } = callback
  const chatId = message.chat.id
  const messageId = message.message_id
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
