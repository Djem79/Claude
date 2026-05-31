import { jsonLd } from '@/lib/jsonld'

/**
 * Renders a JSON-LD <script> with the payload safely escaped for the <script>
 * context (see lib/jsonld.ts). Use this everywhere instead of hand-writing
 * `<script type="application/ld+json" dangerouslySetInnerHTML=...>` — it makes
 * the XSS-safe escaping the only path, so a new page can't reintroduce the raw
 * `JSON.stringify` `</script>` breakout (audit C1).
 */
export default function JsonLd({ data }: { data: unknown }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(data) }} />
}
