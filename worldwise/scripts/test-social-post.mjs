// Integration check for the VK/OK fan-out (lib/social-post.ts).
//
// Usage (from worldwise/, on the server or locally):
//   node --experimental-strip-types --env-file=.env.local scripts/test-social-post.mjs "Тестовый пост"
//   node --experimental-strip-types --env-file=.env.local scripts/test-social-post.mjs "Текст" --image=public/logo.png
//
// Without VK_*/OK_* env vars it reports "не настроено" and exits 0 — the
// graceful no-op state the webhook relies on. With tokens it actually posts,
// so use a throwaway text and delete the post afterwards.

import fs from 'node:fs'
import { fanOutPost, socialNetworksConfigured, formatFanOutSummary } from '../lib/social-post.ts'

const args = process.argv.slice(2)
const text = args.find(a => !a.startsWith('--')) ?? `Тестовый пост fan-out ${new Date().toISOString()}`
const imageArg = args.find(a => a.startsWith('--image='))
const image = imageArg ? fs.readFileSync(imageArg.slice('--image='.length)) : null

const nets = socialNetworksConfigured()
if (nets.length === 0) {
  console.log('Ни одна соцсеть не настроена (нужны VK_ACCESS_TOKEN+VK_GROUP_ID и/или OK_ACCESS_TOKEN+OK_APP_KEY+OK_APP_SECRET+OK_GROUP_ID).')
  console.log('Это штатный no-op: вебхук в таком состоянии постит только в Telegram.')
  process.exit(0)
}

console.log(`Настроены: ${nets.join(', ')}. Публикую${image ? ' с картинкой' : ''}: "${text.slice(0, 60)}..."`)
const results = await fanOutPost(text, image)
for (const r of results) {
  console.log(`${r.network}: ${r.ok ? 'OK' : `FAILED — ${r.error}`}`)
}
console.log('Summary:', formatFanOutSummary(results) || '(пусто)')
process.exit(results.every(r => r.ok) ? 0 : 1)
