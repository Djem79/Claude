const DEVELOPERS = ['Emaar', 'Nakheel', 'DAMAC', 'Meraas', 'Ellington', 'Danube', 'Sobha', 'Aldar']

export default function SocialProofStrip({ dark = false }: { dark?: boolean }) {
  const sub = dark ? 'text-white/60' : 'text-gray-500'
  const val = dark ? 'text-white' : 'text-navy'
  const logo = dark ? 'text-white/70' : 'text-gray-500'
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
      <div className={`mt-3 flex flex-wrap items-center justify-center gap-x-7 gap-y-2 font-serif text-base tracking-wide ${logo}`}>
        {DEVELOPERS.map(d => (
          <span key={d}>{d}</span>
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
