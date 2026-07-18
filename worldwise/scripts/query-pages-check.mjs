// One-off diagnostic: which PAGE ranks for the question-cluster queries.
// Uses the same OAuth env vars as scripts/gsc.mjs. Run:
//   node --env-file=.env.local scripts/query-pages-check.mjs
import { google } from 'googleapis'

const auth = new google.auth.OAuth2(process.env.GSC_OAUTH_CLIENT_ID, process.env.GSC_OAUTH_CLIENT_SECRET)
auth.setCredentials({ refresh_token: process.env.GSC_REFRESH_TOKEN })
const wm = google.searchconsole({ version: 'v1', auth })

const end = new Date().toISOString().slice(0, 10)
const start = new Date(Date.now() - 90 * 864e5).toISOString().slice(0, 10)

const res = await wm.searchanalytics.query({
  siteUrl: process.env.GSC_SITE_URL || 'https://worldwise.pro/',
  requestBody: {
    startDate: start,
    endDate: end,
    dimensions: ['query', 'page'],
    dimensionFilterGroups: [{
      filters: [{ dimension: 'query', operator: 'includingRegex', expression: '^(can|do|does|is|how|what)\\b' }],
    }],
    rowLimit: 100,
  },
})

for (const r of res.data.rows ?? []) {
  const [query, page] = r.keys
  console.log(
    `${r.impressions}`.padStart(4),
    `pos ${r.position.toFixed(1)}`.padStart(9),
    '|', query, '→', page.replace('https://worldwise.pro', ''),
  )
}
