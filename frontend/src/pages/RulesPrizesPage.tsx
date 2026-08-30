function TrophyIcon({ color }: { color: string }) {
  return (
    <svg width="40" height="40" viewBox="0 0 28 28" fill="none">
      <path d="M9 4 L19 4 L19 14 C19 18 16 20 14 20 C12 20 9 18 9 14 Z" stroke={color} strokeWidth="1.4" fill="none" />
      <path d="M9 7 L5 7 C5 7 5 13 9 13" stroke={color} strokeWidth="1.2" fill="none" />
      <path d="M19 7 L23 7 C23 7 23 13 19 13" stroke={color} strokeWidth="1.2" fill="none" />
      <line x1="14" y1="20" x2="14" y2="24" stroke={color} strokeWidth="1.4" />
      <line x1="10" y1="24" x2="18" y2="24" stroke={color} strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}
function FlagIcon({ color }: { color: string }) {
  return (
    <svg width="40" height="40" viewBox="0 0 28 28" fill="none">
      <line x1="6" y1="4" x2="6" y2="26" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <path d="M6 4 L22 8 L6 14 Z" fill={color} opacity="0.8" />
    </svg>
  );
}
function GavelIcon({ color }: { color: string }) {
  return (
    <svg width="40" height="40" viewBox="0 0 28 28" fill="none">
      <rect x="4" y="14" width="12" height="6" rx="1" transform="rotate(-35 4 14)" stroke={color} strokeWidth="1.4" fill="none" />
      <line x1="13" y1="15" x2="22" y2="24" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
      <line x1="4" y1="24" x2="18" y2="24" stroke={color} strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}
function ClockIcon({ color }: { color: string }) {
  return (
    <svg width="40" height="40" viewBox="0 0 28 28" fill="none">
      <circle cx="14" cy="14" r="11" stroke={color} strokeWidth="1.5" fill="none" />
      <line x1="14" y1="7" x2="14" y2="14" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <line x1="14" y1="14" x2="19" y2="17" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

const PRIZES = [
  { place: "1ST", label: "P1 — Race Winner", prize: "$5,000 + mentorship with a founding engineer", color: "#E10600" },
  { place: "2ND", label: "P2 — Podium", prize: "$2,500 + priority interview track", color: "#00D2D2" },
  { place: "3RD", label: "P3 — Podium", prize: "$1,000 + swag pack", color: "#f59e0b" },
  { place: "PPL", label: "Fan Favorite (People's Choice)", prize: "$500 + trophy", color: "#22c55e" },
];

const RULES = [
  { icon: GavelIcon, color: "#E10600", title: "Eligibility", items: ["Teams of 2–4 members, all registered before Lights Out", "One submission per team — resubmitting updates your entry, doesn't create a new one", "Original work only: no pre-built projects entered as new"] },
  { icon: ClockIcon, color: "#00D2D2", title: "Timing", items: ["Qualifying submission deadline is final — see the countdown on the Garage page", "Late submissions are not scored, no exceptions", "Final Race Demo slot is assigned, not first-come-first-served"] },
  { icon: FlagIcon, color: "#22c55e", title: "Submission", items: ["GitHub repository link is required", "Google Drive link (slides, video) is optional but recommended", "Include a short README explaining what your project does and how to run it"] },
];

export default function RulesPrizesPage() {
  return (
    <div className="flex-1 overflow-auto" style={{ background: "linear-gradient(160deg,#080810 0%,#0f0f1a 100%)" }}>
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
              <TrophyIcon color={p.color} />
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
                <section.icon color={section.color} />
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
