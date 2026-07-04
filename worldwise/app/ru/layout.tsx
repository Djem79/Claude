import type { Metadata } from 'next'
import Link from 'next/link'

// Технический русский раздел — источник Дзен-RSS (см. lib/ru-content.ts).
// Сознательное отступление от общих правил страниц: noindex, без Header/
// Footer/FloatingCTA (они английские), нет в sitemap и навигации.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default function RuLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <span className="font-semibold text-navy">Смотрим Дубай</span>
          <a
            href="https://t.me/worldwisellc"
            className="text-sm text-gold-accessible underline"
            rel="noopener noreferrer"
          >
            Telegram-канал
          </a>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-4 py-8">{children}</main>
      <footer className="border-t border-gray-200 mt-12">
        <div className="max-w-3xl mx-auto px-4 py-6 text-sm text-gray-500">
          Материалы телеграм-канала «Смотрим Дубай» · Worldwise Real Estate ·{' '}
          <Link href="/" className="underline">
            worldwise.pro
          </Link>
        </div>
      </footer>
    </div>
  )
}
