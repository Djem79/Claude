import Image from 'next/image'

type Member = {
  slug: string
  ext: string
  name: string
  role: string
  bio: string
  contain?: boolean
}

const TEAM: Member[] = [
  {
    slug: 'dzhambulat',
    ext: 'png',
    name: 'Dzhambulat Tkhazaplizhev',
    role: 'Co-Founder',
    bio: 'Leads strategy, partnerships, and the firm\'s investor relationships across the Middle East and Asia.',
  },
  {
    slug: 'arina',
    ext: 'png',
    name: 'Arina Chekmazova',
    role: 'Co-Founder',
    bio: 'Specialises in mortgage-backed acquisitions and complex international transactions.',
  },
  {
    slug: 'max',
    ext: 'jpg',
    name: 'Max Rean',
    role: 'Business Director & Property Advisor',
    bio: 'Senior advisor focused on off-plan and ready inventory. Manages on-site viewings and bespoke shortlists for HNW clients.',
  },
  {
    slug: 'rizwan',
    ext: 'jpg',
    name: 'Rizwan Taj',
    role: 'Property Advisor · Off-Plan',
    bio: 'Specialist in off-plan acquisitions, helping international buyers navigate developer relationships and payment plans.',
  },
  {
    slug: 'swathi',
    ext: 'jpg',
    name: 'Swathi Vinod',
    role: 'Office & Admin Manager',
    bio: 'Runs operations, scheduling, and client coordination. Your first point of contact for documentation and logistics.',
  },
  {
    slug: 'ko-conveyancing',
    ext: 'jpg',
    name: 'Conveyancing Team',
    role: 'K.O Conveyancing',
    bio: 'Experienced conveyancing team handling every legal aspect — from contract to transfer — for a smooth, secure closing.',
    contain: true,
  },
]

const SUPPORT = [
  {
    title: 'Executive Operations',
    desc: 'Certified partners managing all operational and regulatory matters, keeping our business fully aligned with UAE requirements.',
  },
  {
    title: 'Anti-Money Laundering',
    desc: 'A licensed AML Officer monitors all transactions in accordance with UAE laws and international standards.',
  },
  {
    title: 'Golden Visa & Residency',
    desc: 'End-to-end support on property-linked residency — from eligibility to Emirates ID.',
  },
]

export default function TeamSection() {
  return (
    <section id="team" className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-6">
        <div className="mb-12">
          <p className="text-gold-accessible text-sm font-medium uppercase tracking-widest mb-2">
            Meet The Team · Worldwise Real Estate L.L.C.
          </p>
          <h2 className="section-title">
            People behind<br />every deal.
          </h2>
          <p className="section-subtitle max-w-xl">
            Co-founders, advisors, and a creative team with a decade of Dubai property experience. Every transaction is handled by a named person you can call.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8 mb-16">
          {TEAM.map((m, i) => (
            <div key={m.name} className="flex gap-4 items-start">
              <div className="relative flex-shrink-0">
                <div className="w-20 h-20 rounded-full overflow-hidden bg-navy/10">
                  <Image
                    src={`/images/team/${m.slug}.${m.ext}`}
                    alt={m.name}
                    width={80}
                    height={80}
                    className={`w-full h-full ${m.contain ? 'object-contain' : 'object-cover object-top'}`}
                  />
                </div>
                <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-gold flex items-center justify-center text-white text-[9px] font-semibold">
                  {String(i + 1).padStart(2, '0')}
                </span>
              </div>
              <div className="min-w-0">
                <p className="text-gold-accessible text-[11px] font-medium uppercase tracking-wider mb-0.5">{m.role}</p>
                <h3 className="font-serif text-navy text-lg leading-snug mb-1.5">{m.name}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{m.bio}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="border-t border-gray-100 pt-10">
          <p className="text-xs font-medium uppercase tracking-widest text-gray-400 mb-6">
            Behind the scenes
          </p>
          <div className="grid sm:grid-cols-3 gap-6">
            {SUPPORT.map(s => (
              <div key={s.title} className="bg-[#F8F8F6] rounded-sm p-5">
                <h4 className="font-serif text-navy text-base mb-2">{s.title}</h4>
                <p className="text-gray-500 text-sm leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
