// Developer logos (trimmed to uniform height, transparent bg, local-only).
// Rendered in white chips so the dark wordmarks read on both light and dark
// section backgrounds. Nakheel/Danube omitted pending clean source files.
const DEVELOPERS = [
  { name: 'Emaar', src: '/images/developers/emaar.png' },
  { name: 'DAMAC', src: '/images/developers/damac.png' },
  { name: 'Sobha', src: '/images/developers/sobha.svg' },
  { name: 'Meraas', src: '/images/developers/meraas.png' },
  { name: 'Ellington', src: '/images/developers/ellington.png' },
  { name: 'Aldar', src: '/images/developers/aldar.png' },
]

export default function SocialProofStrip({ dark = false }: { dark?: boolean }) {
  const sub = dark ? 'text-white/60' : 'text-gray-500'
  const val = dark ? 'text-white' : 'text-navy'
  return (
    <div className="w-full">
      <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-center">
        <Stat value="5.0 ★" label="Google rating" val={val} sub={sub} />
        <Stat value="$30M+" label="Transacted" val={val} sub={sub} />
        <Stat value="50+" label="Investors served" val={val} sub={sub} />
        <Stat value="RERA" label="Certified" val={val} sub={sub} />
      </div>
      <p className={`mt-6 text-center text-[11px] uppercase tracking-widest ${sub}`}>
        We work with Dubai&apos;s leading developers
      </p>
      <div className="mt-3 flex flex-wrap items-center justify-center gap-2.5">
        {DEVELOPERS.map(d => (
          <span
            key={d.name}
            className="inline-flex items-center justify-center bg-white rounded-sm border border-gray-200 px-3.5 h-10"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={d.src} alt={d.name} className="h-5 w-auto object-contain" loading="lazy" />
          </span>
        ))}
      </div>
    </div>
  )
}

function Stat({ value, label, val, sub }: { value: string; label: string; val: string; sub: string }) {
  return (
    <div>
      <div className={`font-serif text-xl ${val}`}>{value}</div>
      <div className={`text-xs uppercase tracking-wider ${sub}`}>{label}</div>
    </div>
  )
}
