// Pure FAQ extractor for blog articles. Parses the "Frequently Asked Questions"
// section of a markdown article body into {question, answer} pairs so the blog
// page can emit FAQPage JSON-LD (rich-result eligible) from the FAQ text that is
// already written in the article.
//
// No fs / next / @-imports — kept pure so `node --test --experimental-strip-types`
// can run lib/blog-faq.test.ts (same convention as lib/rss.ts, lib/property-seo.ts).
// The output is consumed by <JsonLd>, which escapes it — so AI-authored FAQ text
// is safe to pass through unmodified.

export interface FaqItem {
  question: string
  answer: string
}

const headingLevel = (line: string): number => line.match(/^(#{2,6})\s/)?.[1].length ?? 0
const isHeading = (line: string): boolean => headingLevel(line) > 0
const headingText = (line: string): string => line.replace(/^#{2,6}\s+/, '').trim()

// Strip the markdown we render inline (links → label, bold, italic) so the
// JSON-LD carries clean plain text, not `**`/`[x](/y)` markup.
function clean(s: string): string {
  return s
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Extract Q&A pairs from an article's FAQ section.
 * Returns [] when there is no FAQ section or no complete Q&A pair.
 */
export function extractFaqItems(content: string): FaqItem[] {
  const lines = String(content || '').split('\n')

  const faqStart = lines.findIndex(
    l => isHeading(l) && /^(frequently asked questions|faq)\b/i.test(headingText(l)),
  )
  if (faqStart === -1) return []

  const faqLevel = headingLevel(lines[faqStart])

  // The section runs until the next heading of the same-or-shallower level.
  let end = lines.length
  for (let j = faqStart + 1; j < lines.length; j++) {
    if (isHeading(lines[j]) && headingLevel(lines[j]) <= faqLevel) {
      end = j
      break
    }
  }

  // A question line is either a heading deeper than the FAQ heading (AI articles
  // use "### Q1: …") or a wholly-bold line (static editorial uses "**Question?**").
  const isQuestionLine = (l: string): boolean =>
    (isHeading(l) && headingLevel(l) > faqLevel) || /^\*\*.+\*\*$/.test(l.trim())
  const questionText = (l: string): string =>
    isHeading(l) ? headingText(l) : l.trim().replace(/^\*\*(.+)\*\*$/, '$1')

  const items: FaqItem[] = []
  let j = faqStart + 1
  while (j < end) {
    if (isQuestionLine(lines[j])) {
      const question = clean(questionText(lines[j]).replace(/^Q\s*\d*\s*[:.)]\s*/i, ''))
      j++
      const answerLines: string[] = []
      while (j < end && !isQuestionLine(lines[j])) {
        const t = lines[j].trim()
        if (t) answerLines.push(t)
        j++
      }
      const answer = clean(answerLines.join(' ').replace(/^A\s*\d*\s*[:.)]\s*/i, ''))
      if (question && answer) items.push({ question, answer })
    } else {
      j++
    }
  }
  return items
}

/**
 * FAQPage JSON-LD object, or null when there aren't at least 2 Q&A pairs
 * (Google wants a genuine FAQ, not a single question).
 */
export function faqPageJsonLd(content: string): object | null {
  const items = extractFaqItems(content)
  if (items.length < 2) return null
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map(i => ({
      '@type': 'Question',
      name: i.question,
      acceptedAnswer: { '@type': 'Answer', text: i.answer },
    })),
  }
}
