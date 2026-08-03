/**
 * Pure lint for a monthly content plan (see post-from-plan.mjs).
 *
 * Why it exists: a poll bypasses the approval step and goes STRAIGHT to the
 * channel, so a malformed `poll_options` is discovered only when that week's
 * poll fails at 06:00 — and by then the slot is gone (todays() matches on
 * p.date === today, so a failed post is never retried). The August-2026 plan
 * shipped with the field dropped from all five polls; the rule was written
 * down twice and still depended on a human diffing the file.
 *
 * Separate module because importing post-from-plan.mjs would run main().
 *
 * Tests: node --test scripts/plan-lint-core.test.mjs
 */

// Telegram's sendPoll accepts 2-12 options, each up to 100 characters.
export const MIN_POLL_OPTIONS = 2
export const MAX_POLL_OPTIONS = 12
export const MAX_OPTION_CHARS = 100

/** Why this poll would fail to send, or null when it is fine. */
export function pollDefect(post) {
  const options = post?.poll_options
  if (!Array.isArray(options) || options.length === 0) return 'нет poll_options'
  if (options.length < MIN_POLL_OPTIONS) return `опций ${options.length}, Telegram требует минимум ${MIN_POLL_OPTIONS}`
  if (options.length > MAX_POLL_OPTIONS) return `опций ${options.length}, Telegram принимает не больше ${MAX_POLL_OPTIONS}`
  if (options.some(o => typeof o !== 'string' || !o.trim())) return 'есть пустая опция'
  const long = options.find(o => o.length > MAX_OPTION_CHARS)
  if (long) return `опция длиннее ${MAX_OPTION_CHARS} символов: "${long.slice(0, 30)}…"`
  return null
}

/**
 * Defects worth reporting today. Only polls that are still unsent AND still
 * ahead of us: a past poll cannot be rescued (its date never comes round
 * again), and nagging about it daily would train the user to ignore the alert.
 */
export function findPlanDefects(posts, today) {
  return (posts ?? [])
    .filter(p => p?.type === 'poll' && !p.sent && p.date >= today)
    .map(p => ({ date: p.date, title: p.title ?? '(без заголовка)', problem: pollDefect(p) }))
    .filter(d => d.problem)
}

export function formatDefectAlert(defects, planName) {
  const lines = [
    `⚠️ Автопост: в плане ${planName} ${defects.length} опрос(а/ов) с битыми poll_options — они упадут в день выхода:`,
    ...defects.map(d => `• ${d.date} «${d.title}» — ${d.problem}`),
    'Поправь файл в data/ на сервере, пока дата не наступила.',
  ]
  return lines.join('\n')
}
