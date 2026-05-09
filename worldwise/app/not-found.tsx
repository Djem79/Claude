import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-navy flex flex-col items-center justify-center text-center px-6">
      <p className="font-serif text-8xl text-gold/30 mb-4">404</p>
      <h1 className="font-serif text-3xl text-white mb-3">Page Not Found</h1>
      <p className="text-white/50 mb-8">The property or page you&apos;re looking for doesn&apos;t exist.</p>
      <div className="flex gap-4">
        <Link href="/" className="btn-primary">Go Home</Link>
        <Link href="/properties" className="btn-outline">Browse Properties</Link>
      </div>
    </div>
  )
}
