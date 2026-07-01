import Link from 'next/link'
import Image from 'next/image'

export default function Footer() {
  return (
    <footer className="bg-navy-dark border-t border-white/10 py-14">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid md:grid-cols-5 gap-10 mb-10">
          <div className="md:col-span-2">
            <Link href="/" className="flex items-center gap-3">
              <Image src="/images/logo.png" alt="Worldwise" width={48} height={48} className="h-12 w-12" />
              <span className="font-serif text-2xl text-white tracking-wide">WORLDWISE</span>
            </Link>
            <p className="text-white/50 text-sm mt-3 leading-relaxed max-w-xs">
              Dubai-based real estate investment agency. Expert guidance for international
              investors buying, renting and growing capital in the UAE.
            </p>
            <div className="flex flex-wrap gap-4 mt-5">
              {[
                { href: 'https://www.instagram.com/worldwiseofficial?igsh=bzlvNXZya2Vjbm9x', label: 'Instagram' },
                { href: 'https://www.linkedin.com/company/worldwise-real-estate-llc/', label: 'LinkedIn' },
                { href: 'https://www.youtube.com/@worldwiserealestate', label: 'YouTube' },
                { href: 'https://www.facebook.com/people/Worldwise-Real-Estate/61572461707148/', label: 'Facebook' },
                { href: 'https://www.tiktok.com/@worldwiseestate', label: 'TikTok' },
              ].map(s => (
                <a
                  key={s.label}
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-white/40 hover:text-gold transition-colors text-sm"
                >
                  {s.label}
                </a>
              ))}
            </div>
          </div>

          <div>
            <p className="text-white/70 text-xs uppercase tracking-widest font-medium mb-4">
              Properties
            </p>
            <ul className="space-y-2.5 text-sm text-white/50">
              <li><Link href="/properties?status=off-plan" className="hover:text-gold transition-colors">Off-Plan</Link></li>
              <li><Link href="/properties?status=secondary" className="hover:text-gold transition-colors">Secondary Market</Link></li>
              <li><Link href="/properties?status=rent" className="hover:text-gold transition-colors">For Rent</Link></li>
              <li><Link href="/properties?type=villa" className="hover:text-gold transition-colors">Villas & Townhouses</Link></li>
              <li><Link href="/developers" className="hover:text-gold transition-colors">Developers</Link></li>
            </ul>
          </div>

          <div>
            <p className="text-white/70 text-xs uppercase tracking-widest font-medium mb-4">
              Buying Guides
            </p>
            <ul className="space-y-2.5 text-sm text-white/50">
              <li><Link href="/invest/buy-apartment-in-dubai" className="hover:text-gold transition-colors">Buy an Apartment</Link></li>
              <li><Link href="/invest/buy-villa-in-dubai" className="hover:text-gold transition-colors">Buy a Villa</Link></li>
              <li><Link href="/invest/dubai-off-plan-payment-plans" className="hover:text-gold transition-colors">Off-Plan Payment Plans</Link></li>
              <li><Link href="/invest/dubai-mortgage-for-non-residents" className="hover:text-gold transition-colors">Mortgage for Non-Residents</Link></li>
            </ul>
          </div>

          <div>
            <p className="text-white/70 text-xs uppercase tracking-widest font-medium mb-4">
              Contact
            </p>
            <ul className="space-y-2.5 text-sm text-white/50">
              <li>+971 50 696 0435</li>
              <li>info@worldwise.pro</li>
              <li className="leading-relaxed">
                Rasis Business Centre - 5,<br />
                5th Floor, Office 502 (EBC03),<br />
                Al Barsha 1, Dubai, UAE
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-white/10 pt-6 flex flex-col md:flex-row justify-between items-center gap-3 text-xs text-white/30">
          <span>© 2026 Worldwise Real Estate L.L.C. All rights reserved.</span>
          <div className="flex gap-5">
            <Link href="/privacy" className="hover:text-white/60">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-white/60">Terms of Use</Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
