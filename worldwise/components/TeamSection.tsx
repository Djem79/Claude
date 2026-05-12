const TEAM = [
  {
    initials: 'DT',
    name: 'Dzhambulat Tkhazaplizhev',
    role: 'Co-Founder',
    bio: 'Leads strategy, partnerships, and the firm\'s investor relationships across the Middle East and Asia.',
  },
  {
    initials: 'AC',
    name: 'Arina Chekmazova',
    role: 'Co-Founder',
    bio: 'Specialises in mortgage-backed acquisitions and complex international transactions.',
  },
  {
    initials: 'MR',
    name: 'Max Rean',
    role: 'Property Advisor',
    bio: 'Senior advisor focused on off-plan and ready inventory. Manages on-site viewings and bespoke shortlists for HNW clients.',
  },
  {
    initials: 'SV',
    name: 'Swathi Vinod',
    role: 'Office & Admin Manager',
    bio: 'Runs operations, scheduling, and client coordination. Your first point of contact for documentation and logistics.',
  },
  {
    initials: 'ZR',
    name: 'Zhanna Rean',
    role: 'Creative Director · London',
    bio: 'External creative director based in London. Oversees brand, editorial output, and the Worldwise Journal.',
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
    title: 'Conveyancing',
    desc: 'Experienced conveyancing team handles all legal aspects — from contract to transfer — ensuring a smooth closing.',
  },
]

export default function TeamSection() {
  return (
    <section id="team" className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-6">
        <div className="mb-12">
          <p className="text-gold text-sm font-medium uppercase tracking-widest mb-2">
            Meet The Team · Worldwise Real Estate L.L.C.
          </p>
          <h2 className="section-title">
            People behind<br />every deal.
          </h2>
          <p className="section-subtitle max-w-xl">
            Co-founders, advisors, and a creative team with a decade of Dubai property experience. Every transaction is handled by a named person you can call.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6 mb-16">
          {TEAM.map((m, i) => (
            <div key={m.name} className="group">
              <div className="relative mb-4">
                <div className="w-16 h-16 rounded-full bg-navy flex items-center justify-center">
                  <span className="font-serif text-xl text-gold">{m.initials}</span>
                </div>
                <span className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-gold/10 border border-gold/30 flex items-center justify-center text-gold text-[10px] font-medium">
                  {String(i + 1).padStart(2, '0')}
                </span>
              </div>
              <p className="text-gold text-xs font-medium uppercase tracking-wider mb-1">{m.role}</p>
              <h3 className="font-serif text-navy text-lg leading-snug mb-2">{m.name}</h3>
              <p className="text-gray-500 text-sm leading-relaxed">{m.bio}</p>
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
