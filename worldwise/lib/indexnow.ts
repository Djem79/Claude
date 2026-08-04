// IndexNow ping — tells Bing (and every other IndexNow-participating engine)
// that a URL changed, the moment it changed. This is the cheap half of the
// Bing story: ChatGPT retrieves the web through Bing, and our pages were
// reaching its index only as fast as organic crawling found them.
//
// The key is deliberately a committed constant, not an env secret: the
// protocol REQUIRES the key to be publicly served at /<key>.txt (see
// public/d528057a3a74c3ed1df8b20a74813663.txt) — its only purpose is to prove
// the submitter controls the host, so treating it as a secret adds nothing.
const INDEXNOW_KEY = 'd528057a3a74c3ed1df8b20a74813663'
const HOST = 'worldwise.pro'

/**
 * Fire-and-forget notification that URLs changed. Never throws: indexing is
 * a nice-to-have and must not affect the caller (a Telegram callback answer
 * or an admin save). Callers pass ABSOLUTE paths ("/blog/foo"), not full URLs.
 */
export async function pingIndexNow(paths: string[]): Promise<void> {
  try {
    const res = await fetch('https://api.indexnow.org/indexnow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({
        host: HOST,
        key: INDEXNOW_KEY,
        keyLocation: `https://${HOST}/${INDEXNOW_KEY}.txt`,
        urlList: paths.map(p => `https://${HOST}${p}`),
      }),
    })
    // 200/202 = accepted. Anything else is logged and swallowed.
    if (res.status !== 200 && res.status !== 202) {
      console.error(`indexnow: unexpected status ${res.status}`)
    }
  } catch (e) {
    console.error(`indexnow: ping failed: ${e instanceof Error ? e.message : e}`)
  }
}
