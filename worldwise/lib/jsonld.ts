/**
 * Serialize a JSON-LD object for safe injection into a <script type="application/ld+json">
 * via dangerouslySetInnerHTML.
 *
 * JSON.stringify does NOT escape `<`, `>`, `&`, so untrusted values (AI article
 * titles, CRM property text) containing `</script>` could break out of the
 * script block and execute. Escaping these to their \uXXXX forms keeps the JSON
 * valid while making `</script>` impossible to form.
 */
export function jsonLd(obj: unknown): string {
  return JSON.stringify(obj)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
}
