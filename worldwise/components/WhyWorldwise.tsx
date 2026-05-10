const points = [
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7">
        <path d="M3 12L12 3l9 9" />
        <path d="M5 10v9a1 1 0 001 1h4v-5h4v5h4a1 1 0 001-1v-9" />
      </svg>
    ),
    title: 'End-to-End Support',
    text: 'From property search and negotiation to DLD registration, utilities and visa — we handle everything.',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7">
        <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
        <polyline points="16 7 22 7 22 13" />
      </svg>
    ),
    title: 'Data-Driven Advice',
    text: 'We analyse market trends, rental yields and growth potential to find the best deals — not just any listing.',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7">
        <circle cx="12" cy="12" r="10" />
        <line x1="2" y1="12" x2="22" y2="12" />
        <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
      </svg>
    ),
    title: '30+ Countries Served',
    text: 'Our team speaks multiple languages and has guided investors from India, UK, Europe, the US and beyond.',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        <polyline points="9 12 11 14 15 10" />
      </svg>
    ),
    title: 'RERA Certified',
    text: "Fully licensed by Dubai's Real Estate Regulatory Authority. Your investment is protected at every step.",
  },
]

export default function WhyWorldwise() {
  return (
    <section id="about" className="py-20 bg-[#F8F8F6]">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <div>
            <p className="text-gold text-sm font-medium uppercase tracking-widest mb-2">
              Why Worldwise
            </p>
            <h2 className="section-title">
              Trusted by Investors<br />Around the World
            </h2>
            <p className="text-gray-500 text-lg mt-4 leading-relaxed">
              Worldwise Real Estate L.L.C. is a Dubai-based agency specialising in international
              investment property. Our team of experts makes buying, selling and investing
              in UAE real estate seamless — from your first enquiry to handover and beyond.
            </p>

            <div className="grid grid-cols-2 gap-6 mt-8">
              {[
                { v: '500+', l: 'Investors Helped' },
                { v: 'AED 2B+', l: 'In Transactions' },
                { v: '8+', l: 'Developer Partners' },
                { v: '30+', l: 'Countries Represented' },
              ].map(s => (
                <div key={s.l} className="border-l-2 border-gold pl-4">
                  <div className="font-serif text-3xl text-navy">{s.v}</div>
                  <div className="text-gray-500 text-sm mt-0.5">{s.l}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {points.map(p => (
              <div key={p.title} className="bg-white rounded-sm p-6 shadow-sm">
                <div className="w-12 h-12 rounded-full bg-gold/10 flex items-center justify-center mb-4 text-gold">
                  {p.icon}
                </div>
                <h3 className="font-serif text-lg text-navy mb-2">{p.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{p.text}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
