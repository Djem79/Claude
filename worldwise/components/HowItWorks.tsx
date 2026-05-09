const steps = [
  {
    num: '01',
    title: 'Free Consultation',
    text: 'Tell us your goals, budget and timeline. We listen before we advise.',
  },
  {
    num: '02',
    title: 'Curated Selection',
    text: 'We shortlist 3–5 properties that best match your criteria and investment goals.',
  },
  {
    num: '03',
    title: 'Viewings & Analysis',
    text: 'Virtual or in-person tours with a full ROI breakdown and market comparison.',
  },
  {
    num: '04',
    title: 'Transaction Support',
    text: 'Legal review, mortgage arrangement, DLD registration — handled by our team.',
  },
  {
    num: '05',
    title: 'Post-Sale Services',
    text: 'Utility activation, property management, rental listing and resident visa support.',
  },
]

export default function HowItWorks() {
  return (
    <section className="py-20 bg-navy">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-14">
          <p className="text-gold text-sm font-medium uppercase tracking-widest mb-2">
            Our Process
          </p>
          <h2 className="font-serif text-4xl md:text-5xl text-white">
            From First Call to Keys
          </h2>
        </div>

        <div className="grid md:grid-cols-5 gap-6 relative">
          {/* Connector line — desktop only */}
          <div className="hidden md:block absolute top-9 left-0 right-0 h-px bg-gold/20" />

          {steps.map((step, i) => (
            <div key={step.num} className="relative text-center">
              <div className="relative inline-flex items-center justify-center w-16 h-16 rounded-full border-2 border-gold bg-navy text-gold font-serif text-xl mb-5 mx-auto">
                {step.num}
                {i < steps.length - 1 && (
                  <div className="hidden md:block absolute left-full top-1/2 -translate-y-px w-full h-px bg-gold/20" />
                )}
              </div>
              <h3 className="text-white font-serif text-lg mb-2">{step.title}</h3>
              <p className="text-white/55 text-sm leading-relaxed">{step.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
