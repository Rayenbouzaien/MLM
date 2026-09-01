const ICONS = {
  trophy: "/assets/gridlock/icons/trophy-gold.jpg",
  gavel: "/assets/gridlock/icons/innovation.jpg",
  clock: "/assets/gridlock/icons/stopwatch.jpg",
  flag: "/assets/gridlock/icons/flag.jpg",
} as const;

function RasterIcon({ src, alt = "" }: { src: string; alt?: string }) {
  return <img src={src} alt={alt} className="h-10 w-10 rounded object-cover border border-white/10" />;
}

const PRIZES = [
  { icon: "trophy", place: "1ST", label: "P1 — Race Winner", prize: "$5,000 + mentorship with a founding engineer", color: "#E10600" },
  { icon: "trophy", place: "2ND", label: "P2 — Podium", prize: "$2,500 + priority interview track", color: "#00D2D2" },
  { icon: "trophy", place: "3RD", label: "P3 — Podium", prize: "$1,000 + swag pack", color: "#f59e0b" },
  { icon: "trophy", place: "PPL", label: "Fan Favorite (People's Choice)", prize: "$500 + trophy", color: "#22c55e" },
];

const RULES = [
  { icon: "gavel", color: "#E10600", title: "Eligibility", items: ["Teams of 2–4 members, all registered before Lights Out", "One submission per team — resubmitting updates your entry, doesn't create a new one", "Original work only: no pre-built projects entered as new"] },
  { icon: "clock", color: "#00D2D2", title: "Timing", items: ["Qualifying submission deadline is final — see the countdown on the Garage page", "Late submissions are not scored, no exceptions", "Final Race Demo slot is assigned, not first-come-first-served"] },
  { icon: "flag", color: "#22c55e", title: "Submission", items: ["GitHub repository link is required", "Google Drive link (slides, video) is optional but recommended", "Include a short README explaining what your project does and how to run it"] },
];

export default function RulesPrizesPage() {
  return (
    <div className="flex-1 overflow-auto page-shell page-rules" style={{ background: "linear-gradient(160deg,#080810 0%,#0f0f1a 100%)" }}>
      <div className="text-center py-12 px-6" style={{ background: "linear-gradient(to bottom,rgba(225,6,0,0.06) 0%,transparent 100%)", borderBottom: "1px solid rgba(225,6,0,0.15)" }}>
        <h1 className="font-black text-white uppercase" style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: "clamp(1.8rem,4vw,2.8rem)", letterSpacing: "0.04em" }}>
          RULES &amp; <span style={{ color: "#E10600" }}>PRIZES</span>
        </h1>
        <p className="mt-2 text-gray-400 text-sm">What it takes to stand on the podium.</p>
      </div>

      <div className="px-5 py-10" style={{ maxWidth: 1100, margin: "0 auto" }}>
        <h2 className="font-bold text-white uppercase mb-5" style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: "1.3rem", letterSpacing: "0.05em" }}>
          Prize Purse
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
          {PRIZES.map((p) => (
            <div key={p.place} className="rounded-lg p-5 flex flex-col items-center text-center gap-2"
              style={{ border: `1.5px solid ${p.color}`, background: `${p.color}0d`, boxShadow: `0 0 20px ${p.color}22` }}>
              <RasterIcon src={ICONS.trophy} alt="" />
              <span className="font-black" style={{ fontFamily: "'Orbitron',monospace", color: p.color, fontSize: "1.1rem" }}>{p.place}</span>
              <h3 className="font-bold text-white text-sm" style={{ fontFamily: "'Rajdhani',sans-serif" }}>{p.label}</h3>
              <p className="text-gray-400 text-xs">{p.prize}</p>
            </div>
          ))}
        </div>

        <h2 className="font-bold text-white uppercase mb-5" style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: "1.3rem", letterSpacing: "0.05em" }}>
          Race Regulations
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {RULES.map((section) => (
            <div key={section.title} className="rounded-lg p-5" style={{ border: `1.5px solid ${section.color}55`, background: `${section.color}08` }}>
              <div className="flex items-center gap-3 mb-3">
                <RasterIcon src={ICONS[section.icon as keyof typeof ICONS]} alt="" />
                <h3 className="font-bold text-white uppercase" style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: "1rem" }}>{section.title}</h3>
              </div>
              <ul className="space-y-2">
                {section.items.map((item) => (
                  <li key={item} className="flex gap-2 text-gray-400 text-xs leading-relaxed">
                    <span style={{ color: section.color }}>▸</span>{item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
