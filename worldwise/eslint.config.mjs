import nextCoreWebVitals from 'eslint-config-next/core-web-vitals'

// ESLint 9 flat config (Next 16 removed `next lint`; `npm run lint` = `eslint .`).
// eslint-config-next's flat preset already ignores .next/ and node_modules/.
export default [
  ...nextCoreWebVitals,
  {
    // Same file scope as the preset's base object — it doesn't cover *.cjs,
    // and an unscoped override would reference react-hooks where it's undefined.
    files: ['**/*.{js,jsx,mjs,ts,tsx,mts,cts}'],
    rules: {
      // react-hooks v6 (via eslint-config-next 16) flags long-established patterns
      // (init-from-localStorage, modal state reset on open, scroll sync). They work
      // and predate the rule — keep visible as warnings, don't fail the lint run.
      'react-hooks/set-state-in-effect': 'warn',
    },
  },
]
