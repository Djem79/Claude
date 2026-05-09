const points = [
  {
    icon: '🔑',
    title: 'End-to-End Support',
    text: 'From property search and negotiation to DLD registration, utilities and visa — we handle everything.',
  },
  {
    icon: '📊',
    title: 'Data-Driven Advice',
    text: 'We analyse market trends, rental yields and growth potential to find the best deals — not just any listing.',
  },
  {
    icon: '🌍',
    title: '30+ Countries Served',
    text: 'Our team speaks multiple languages and has guided investors from India, UK, Europe, the US and beyond.',
  },
  {
    icon: '✅',
    title: 'RERA Certified',
    text: 'Fully licensed by Dubai\'s Real Estate Regulatory Authority. Your investment is protected at every step.',
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
                <div className="text-3xl mb-3">{p.icon}</div>
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
