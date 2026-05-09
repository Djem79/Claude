const developers = [
  'Emaar', 'Nakheel', 'DAMAC', 'Meraas',
  'Ellington', 'Danube', 'Sobha', 'Aldar',
]

export default function TrustBar() {
  return (
    <section className="bg-white border-y border-gray-100 py-6">
      <div className="max-w-7xl mx-auto px-6">
        <p className="text-center text-xs text-gray-400 uppercase tracking-widest mb-5 font-medium">
          Official Partner Developers
        </p>
        <div className="flex flex-wrap justify-center items-center gap-8 md:gap-12">
          {developers.map(name => (
            <span
              key={name}
              className="font-serif text-lg text-gray-400 font-medium hover:text-navy transition-colors"
            >
              {name}
            </span>
          ))}
        </div>
      </div>
    </section>
  )
}
