import { useState, useEffect } from "react";

/* ── Countdown (reused from home) ─────────────────────────── */
const TARGET = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000 + 14 * 60 * 60 * 1000 + 55 * 60 * 1000 + 21 * 1000);

function useCountdown(target: Date) {
  const calc = () => {
    const d = Math.max(0, target.getTime() - Date.now());
    return { days: Math.floor(d / 86400000), hrs: Math.floor((d % 86400000) / 3600000), min: Math.floor((d % 3600000) / 60000), sec: Math.floor((d % 60000) / 1000) };
  };
  const [t, setT] = useState(calc);
  useEffect(() => { const id = setInterval(() => setT(calc()), 1000); return () => clearInterval(id); });
  return t;
}
const pad = (n: number) => String(n).padStart(2, "0");

/* ── Icons ────────────────────────────────────────────────── */
function SpeedoIcon({ color }: { color: string }) {
  return (
    <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
      <circle cx="18" cy="20" r="13" stroke={color} strokeWidth="1.5" fill="none" />
      <path d="M7 27 A13 13 0 0 1 29 27" stroke={color} strokeWidth="1.5" fill="none" />
      <line x1="18" y1="20" x2="25" y2="12" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <circle cx="18" cy="20" r="2.5" fill={color} />
      <line x1="7" y1="20" x2="9.5" y2="20" stroke={color} strokeWidth="1.2" />
      <line x1="29" y1="20" x2="26.5" y2="20" stroke={color} strokeWidth="1.2" />
      <line x1="18" y1="9" x2="18" y2="11.5" stroke={color} strokeWidth="1.2" />
    </svg>
  );
}
function FanIcon({ color }: { color: string }) {
  return (
    <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
      <circle cx="18" cy="12" r="5" stroke={color} strokeWidth="1.5" fill="none" />
      <path d="M8 32 C8 22 28 22 28 32" stroke={color} strokeWidth="1.5" fill="none" />
      <circle cx="28" cy="10" r="3.5" stroke={color} strokeWidth="1.2" fill="none" />
      <path d="M30.5 8 L34 5" stroke={color} strokeWidth="1.2" strokeLinecap="round" />
      <path d="M31.5 11 L35 11" stroke={color} strokeWidth="1.2" strokeLinecap="round" />
      <path d="M29.5 14 L32 17" stroke={color} strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}
function LeafIcon({ color }: { color: string }) {
  return (
    <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
      <path d="M8 28 C8 28 10 18 18 14 C22 12 28 12 30 8 C30 8 32 16 26 22 C22 26 14 26 8 28Z" stroke={color} strokeWidth="1.5" fill="none" strokeLinejoin="round" />
      <path d="M8 28 L16 20" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="27" cy="11" r="2" fill={color} opacity="0.6" />
    </svg>
  );
}
function StopwatchIcon({ color }: { color: string }) {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
      <circle cx="14" cy="16" r="10" stroke={color} strokeWidth="1.5" fill="none" />
      <line x1="14" y1="16" x2="14" y2="10" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <line x1="14" y1="16" x2="18" y2="14" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <line x1="11" y1="4" x2="17" y2="4" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <line x1="14" y1="4" x2="14" y2="6" stroke={color} strokeWidth="1.5" />
      <line x1="23" y1="8" x2="25" y2="6" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
function TrophyIcon({ color }: { color: string }) {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
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
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
      <line x1="6" y1="4" x2="6" y2="26" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <path d="M6 4 L22 8 L6 14 Z" fill={color} opacity="0.8" />
    </svg>
  );
}
function HelmetIcon({ color }: { color: string }) {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
      <path d="M6 16 C6 10 9 5 14 5 C19 5 23 9 23 14 L23 18 C23 20 21 22 19 22 L9 22 C7 22 6 20.5 6 19 Z" stroke={color} strokeWidth="1.4" fill="none" />
      <path d="M6 16 L4 16 C4 19 6 22 9 22" stroke={color} strokeWidth="1.2" fill="none" />
      <path d="M8 22 L8 24 C8 25 9 26 10 26 L18 26 C19 26 20 25 20 24 L20 22" stroke={color} strokeWidth="1.2" fill="none" />
      <line x1="6" y1="18" x2="22" y2="18" stroke={color} strokeWidth="1" opacity="0.5" />
    </svg>
  );
}
function WheelIcon({ color }: { color: string }) {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
      <circle cx="14" cy="14" r="11" stroke={color} strokeWidth="1.5" fill="none" />
      <circle cx="14" cy="14" r="3.5" stroke={color} strokeWidth="1.3" fill="none" />
      <line x1="14" y1="3" x2="14" y2="10.5" stroke={color} strokeWidth="1.2" />
      <line x1="14" y1="17.5" x2="14" y2="25" stroke={color} strokeWidth="1.2" />
      <line x1="3" y1="14" x2="10.5" y2="14" stroke={color} strokeWidth="1.2" />
      <line x1="17.5" y1="14" x2="25" y2="14" stroke={color} strokeWidth="1.2" />
    </svg>
  );
}

/* ── Challenge data ────────────────────────────────────────── */
const CHALLENGES = [
  {
    num: "01",
    title: "PREDICTIVE ANALYTICS & DRIVER OPTIMIZATION",
    color: "#E10600",
    icon: (c: string) => <SpeedoIcon color={c} />,
    desc: "Develop ML models to analyze complex multi-channel telemetry streams (engine metrics, tire temperatures, G-forces) in real-time. Predict component failures and recommend optimal racing lines for different circuit sectors.",
    deliverables: "A validated ML model, data insight dashboard, and presentation of predictive accuracy.",
    tags: ["AI Analytics", "ML", "Real-time Data"],
  },
  {
    num: "02",
    title: "IMMERSIVE FAN EXPERIENCE PLATFORM",
    color: "#00D2D2",
    icon: (c: string) => <FanIcon color={c} />,
    desc: "Reimagine the fan experience with a next-gen, data-driven platform. Features could include AR race overlays, gamified fan pit strategy decisions, and personalized AI-curated highlight reels based on individual fan interest and sentiment.",
    deliverables: "A functioning prototype UI, data integration layer, and demo of interactive features.",
    tags: ["VR Fan Exp", "AR", "UX Design"],
  },
  {
    num: "03",
    title: "DATA-DRIVEN SUPPLY CHAIN SUSTAINABILITY",
    color: "#00E676",
    icon: (c: string) => <LeafIcon color={c} />,
    desc: "Analyze and optimize the global supply chain footprint for an F1 team. Model innovative, data-driven logistical solutions for global transportation of cars, personnel, and equipment, reducing carbon impact while maintaining speed and efficiency.",
    deliverables: "A detailed logistics model with analysis, proposed implementation roadmap, and data-driven route optimization demo.",
    tags: ["Sustainable Logistics", "Optimization", "Green Tech"],
  },
];

/* ── Info panels data ─────────────────────────────────────── */
const NOTICES = [
  { type: "bulletin", text: "Bulletin #1C: Submission link platform updated." },
  { type: "warning", text: "Notice A12: Time penalty warning for missing Time 2 check-in." },
  { type: "warning", text: "Notice 416: Time penalty warning for missing Time 2 check-in." },
  { type: "warning", text: "Notice 614: Time penalty warning for missing Time 2 check-in." },
];

/* ── Challenge Card ────────────────────────────────────────── */
function ChallengeCard({ ch }: { ch: typeof CHALLENGES[0] }) {
  const [expanded, setExpanded] = useState(false);
  const c = ch.color;
  return (
    <div
      className="rounded-lg flex flex-col overflow-hidden transition-transform hover:-translate-y-1"
      style={{
        background: `linear-gradient(160deg, ${c}0d 0%, rgba(8,8,16,0.97) 55%)`,
        border: `1.5px solid ${c}`,
        boxShadow: `0 0 24px ${c}22`,
      }}
    >
      {/* Card header */}
      <div className="p-4 flex items-start gap-3" style={{ borderBottom: `1px solid ${c}22` }}>
        <div className="shrink-0 mt-0.5">{ch.icon(c)}</div>
        <div>
          <div className="text-xs font-bold tracking-widest mb-1" style={{ fontFamily: "'Rajdhani',sans-serif", color: c }}>
            TRACK CHALLENGE {ch.num}:
          </div>
          <h3 className="font-black text-white uppercase leading-tight"
            style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: "clamp(0.95rem,2vw,1.1rem)", letterSpacing: "0.03em", textShadow: `0 0 12px ${c}55` }}>
            {ch.title}
          </h3>
        </div>
        {/* Dash pattern corner */}
        <div className="ml-auto shrink-0 opacity-40">
          {[0,1,2].map(i => (
            <div key={i} className="flex gap-0.5 mb-0.5">
              {[0,1,2].map(j => (
                <div key={j} className="w-1.5 h-1.5" style={{ background: (i+j)%2===0 ? "#fff" : "transparent" }} />
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Body */}
      <div className="p-4 flex-1 flex flex-col gap-3">
        <p className="text-gray-300 text-sm leading-relaxed" style={{ fontFamily: "'Titillium Web',sans-serif" }}>
          {ch.desc}
        </p>
        <p className="text-sm" style={{ fontFamily: "'Titillium Web',sans-serif" }}>
          <span className="font-bold text-white">Deliverables: </span>
          <span className="text-gray-400">{ch.deliverables}</span>
        </p>

        {/* Tags */}
        <div className="flex flex-wrap gap-1.5 mt-auto">
          {ch.tags.map(tag => (
            <span key={tag} className="text-xs px-2 py-0.5 rounded"
              style={{ fontFamily: "'Titillium Web',sans-serif", fontSize: "0.65rem", background: `${c}18`, border: `1px solid ${c}44`, color: c }}>
              {tag}
            </span>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 p-4" style={{ borderTop: `1px solid ${c}22` }}>
        <button
          className="flex-1 py-2.5 rounded font-bold uppercase tracking-widest text-xs transition-all hover:opacity-90 active:scale-95"
          style={{ fontFamily: "'Rajdhani',sans-serif", background: c, color: c === "#00E676" ? "#000" : "#fff", border: "none", cursor: "pointer", letterSpacing: "0.12em", boxShadow: `0 0 12px ${c}44` }}>
          REGISTER DRIVER
        </button>
        <button
          onClick={() => setExpanded(!expanded)}
          className="px-4 py-2.5 rounded font-bold uppercase tracking-widest text-xs transition-all hover:opacity-90 active:scale-95"
          style={{ fontFamily: "'Rajdhani',sans-serif", background: "transparent", color: c, border: `1.5px solid ${c}`, cursor: "pointer", letterSpacing: "0.12em" }}>
          {expanded ? "HIDE" : "VIEW SPECS"}
        </button>
      </div>

      {/* Expanded specs */}
      {expanded && (
        <div className="px-4 pb-4 text-xs text-gray-400 space-y-1.5 border-t" style={{ borderColor: `${c}22`, fontFamily: "'Titillium Web',sans-serif" }}>
          <div className="pt-3 font-bold text-white text-sm" style={{ fontFamily: "'Rajdhani',sans-serif" }}>TECHNICAL SPECS</div>
          <div className="flex justify-between"><span>Team size</span><span style={{ color: c }}>2–4 members</span></div>
          <div className="flex justify-between"><span>Duration</span><span style={{ color: c }}>24 hrs</span></div>
          <div className="flex justify-between"><span>Submission format</span><span style={{ color: c }}>GitHub + Demo</span></div>
          <div className="flex justify-between"><span>Judging weight</span><span style={{ color: c }}>Innovation 50% · Presentation 20% · Technical 30%</span></div>
        </div>
      )}
    </div>
  );
}

/* ── Info panel ────────────────────────────────────────────── */
function InfoPanel({ icon, title, color, children }: { icon: React.ReactNode; title: string; color: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg overflow-hidden"
      style={{ border: `1.5px solid ${color}55`, background: `linear-gradient(135deg,${color}08 0%,rgba(8,8,16,0.97) 60%)` }}>
      <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: `1px solid ${color}22` }}>
        {icon}
        <h4 className="font-bold uppercase tracking-wider text-white text-sm" style={{ fontFamily: "'Rajdhani',sans-serif" }}>{title}</h4>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

/* ── Page ─────────────────────────────────────────────────── */
export default function ChallengesPage() {
  const { days, hrs, min, sec } = useCountdown(TARGET);

  return (
    <div className="flex-1 overflow-auto" style={{ background: "linear-gradient(160deg,#080810 0%,#0f0f1a 100%)" }}>
      {/* Carbon texture */}
      <div className="pointer-events-none fixed inset-0 z-0"
        style={{ backgroundImage: "repeating-linear-gradient(45deg,transparent,transparent 2px,rgba(255,255,255,0.01) 2px,rgba(255,255,255,0.01) 4px),repeating-linear-gradient(-45deg,transparent,transparent 2px,rgba(255,255,255,0.01) 2px,rgba(255,255,255,0.01) 4px)" }} />

      <div className="relative z-10">
        {/* ── Hero ── */}
        <div className="relative text-center py-12 px-6 overflow-hidden"
          style={{ background: "linear-gradient(to bottom,rgba(225,6,0,0.06) 0%,transparent 100%)", borderBottom: "1px solid rgba(225,6,0,0.15)" }}>
          {/* Neon corner brackets */}
          <div className="absolute top-0 left-0 w-20 h-20 pointer-events-none">
            <svg viewBox="0 0 80 80" fill="none" className="w-full h-full">
              <path d="M2,50 L2,10 C2,5 5,2 10,2 L50,2" stroke="#E10600" strokeWidth="2" opacity="0.6" />
            </svg>
          </div>
          <div className="absolute top-0 right-0 w-20 h-20 pointer-events-none">
            <svg viewBox="0 0 80 80" fill="none" className="w-full h-full">
              <path d="M30,2 L70,2 C75,2 78,5 78,10 L78,50" stroke="#00D2D2" strokeWidth="2" opacity="0.6" />
            </svg>
          </div>
          {/* F1 flag watermark top-right */}
          <div className="absolute top-4 right-20 opacity-10 pointer-events-none">
            <svg width="60" height="60" viewBox="0 0 60 60" fill="none">
              {[0,1,2,3,4].map(i=>[0,1,2,3,4].map(j=>(
                <rect key={`${i}-${j}`} x={i*12} y={j*12} width="12" height="12" fill={(i+j)%2===0?"#fff":"#333"} />
              )))}
            </svg>
          </div>

          <h1 className="font-black text-white uppercase leading-tight"
            style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: "clamp(1.5rem,4vw,2.6rem)", letterSpacing: "0.04em", textShadow: "0 2px 20px rgba(0,0,0,0.8)", maxWidth: 900, margin: "0 auto" }}>
            THE GRID: OFFICIAL HACKS.{" "}
            <span style={{ color: "#E10600" }}>EXPLORE YOUR LIMITS.</span>
            <br />BUILD THE FUTURE OF MOTORSPORT.
          </h1>
          <p className="mt-3 text-gray-400 text-sm max-w-xl mx-auto" style={{ fontFamily: "'Titillium Web',sans-serif" }}>
            Choose your constructor track. 24 hours to build something the paddock has never seen.
          </p>
        </div>

        <div className="px-5 pb-12" style={{ maxWidth: 1200, margin: "0 auto" }}>

          {/* ── 3 Challenge Cards ── */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-8">
            {CHALLENGES.map(ch => <ChallengeCard key={ch.num} ch={ch} />)}
          </div>

          {/* ── Info panels row ── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-8">

            {/* Team Eligibility */}
            <InfoPanel icon={<WheelIcon color="#E10600" />} title="Team Eligibility" color="#E10600">
              <ul className="space-y-1.5 text-gray-400 text-xs" style={{ fontFamily: "'Titillium Web',sans-serif" }}>
                <li className="flex gap-2"><span style={{ color: "#E10600" }}>▸</span>Max 4 drivers per constructor</li>
                <li className="flex gap-2"><span style={{ color: "#E10600" }}>▸</span>Constructor number must be registered</li>
                <li className="flex gap-2"><span style={{ color: "#E10600" }}>▸</span>All team members need a Driver Super Licence</li>
                <li className="flex gap-2"><span style={{ color: "#E10600" }}>▸</span>One project submission per team</li>
              </ul>
            </InfoPanel>

            {/* Judging Criteria */}
            <InfoPanel icon={<TrophyIcon color="#00D2D2" />} title="Judging Criteria" color="#00D2D2">
              <div className="space-y-2" style={{ fontFamily: "'Titillium Web',sans-serif" }}>
                {[
                  { label: "Innovation", pts: 50, color: "#E10600" },
                  { label: "Presentation", pts: 20, color: "#00D2D2" },
                  { label: "Technical (Impact & Sustainable Logistics)", pts: 30, color: "#00E676" },
                ].map(item => (
                  <div key={item.label} className="flex items-center gap-2">
                    <div className="flex-1">
                      <div className="flex justify-between text-xs mb-0.5">
                        <span className="text-gray-300">{item.label}</span>
                        <span style={{ color: item.color }} className="font-bold">{item.pts} pts</span>
                      </div>
                      <div className="h-1 rounded-full" style={{ background: "#1a1a2a" }}>
                        <div className="h-1 rounded-full transition-all" style={{ width: `${item.pts}%`, background: item.color, boxShadow: `0 0 6px ${item.color}` }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </InfoPanel>

            {/* Timeline & Check-ins */}
            <InfoPanel icon={<StopwatchIcon color="#00E676" />} title="Timeline & Check-ins" color="#00E676">
              <div className="space-y-2" style={{ fontFamily: "'Titillium Web',sans-serif" }}>
                {[
                  { time: "09:00", label: "Lights Out — Kickoff", done: true },
                  { time: "12:00", label: "Paddock Fuel Up (Check-in 1)", done: true },
                  { time: "14:00", label: "Workshop Sessions", done: true },
                  { time: "19:00", label: "Qualifying Submission", done: false },
                  { time: "22:00", label: "Final Race Demo", done: false },
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-2.5">
                    <span className="w-12 shrink-0 font-bold text-xs" style={{ color: item.done ? "#00E676" : "#555", fontFamily: "'Orbitron',monospace", fontSize: "0.65rem" }}>{item.time}</span>
                    <div className="w-2 h-2 rounded-full shrink-0" style={{ background: item.done ? "#00E676" : "#333", boxShadow: item.done ? "0 0 6px #00E676" : "none" }} />
                    <span className="text-xs" style={{ color: item.done ? "#ccc" : "#555" }}>{item.label}</span>
                  </div>
                ))}
              </div>
            </InfoPanel>

            {/* Track Guidelines */}
            <InfoPanel icon={<FlagIcon color="#00D2D2" />} title="Track Guidelines" color="#00D2D2">
              <ul className="space-y-1.5 text-gray-400 text-xs" style={{ fontFamily: "'Titillium Web',sans-serif" }}>
                <li className="flex gap-2"><span style={{ color: "#00D2D2" }}>▸</span>Align projects with AI Analytics, VR Fan Experience, Real-time Data or Sustainable Logistics</li>
                <li className="flex gap-2"><span style={{ color: "#00D2D2" }}>▸</span>No off-track collisions — original work only</li>
                <li className="flex gap-2"><span style={{ color: "#00D2D2" }}>▸</span>Grid position earned by submission quality</li>
              </ul>
            </InfoPanel>

            {/* Submission */}
            <InfoPanel icon={<HelmetIcon color="#FF2D55" />} title="Submission & Scrutineering" color="#FF2D55">
              <ul className="space-y-1.5 text-gray-400 text-xs" style={{ fontFamily: "'Titillium Web',sans-serif" }}>
                <li className="flex gap-2"><span style={{ color: "#FF2D55" }}>▸</span>GitHub repository link required</li>
                <li className="flex gap-2"><span style={{ color: "#FF2D55" }}>▸</span>3-minute video demo mandatory</li>
                <li className="flex gap-2"><span style={{ color: "#FF2D55" }}>▸</span>Deck (max 10 slides) for final race demo</li>
                <li className="flex gap-2"><span style={{ color: "#FF2D55" }}>▸</span>All submissions via platform before 19:00</li>
              </ul>
            </InfoPanel>

            {/* Stewards' Notice Board */}
            <InfoPanel icon={<FlagIcon color="#f59e0b" />} title="Stewards' Notice Board" color="#f59e0b">
              <div className="space-y-2">
                {NOTICES.map((n, i) => (
                  <div key={i} className="flex gap-2 items-start">
                    <div className="w-1 shrink-0 rounded mt-0.5 h-3" style={{ background: n.type === "bulletin" ? "#00D2D2" : "#f59e0b" }} />
                    <p className="text-gray-400 text-xs leading-snug" style={{ fontFamily: "'Titillium Web',sans-serif" }}>{n.text}</p>
                  </div>
                ))}
              </div>
            </InfoPanel>

          </div>

          {/* ── Lights Out Countdown ── */}
          <div className="mt-12 flex flex-col items-center gap-6">
            <div className="flex items-center gap-4 w-full max-w-sm">
              <div className="h-px flex-1" style={{ background: "linear-gradient(to right,transparent,#333)" }} />
              <span className="font-headline text-xs tracking-[0.4em] text-gray-500 uppercase">LIGHTS OUT</span>
              <div className="h-px flex-1" style={{ background: "linear-gradient(to left,transparent,#333)" }} />
            </div>

            <div className="flex items-end gap-4">
              {[
                { value: pad(days), label: "DAYS" },
                { value: pad(hrs), label: "HRS" },
                { value: pad(min), label: "MIN" },
                { value: pad(sec), label: "SEC" },
              ].map((item, i) => (
                <div key={item.label} className="flex items-end gap-1">
                  {i > 0 && (
                    <span className="font-headline font-bold mb-5 text-2xl" style={{ color: "#E10600" }}>:</span>
                  )}
                  <div className="flex flex-col items-center gap-1">
                    <div className="countdown-digit"
                      style={{ width: "clamp(60px,10vw,88px)", height: "clamp(60px,10vw,88px)", fontSize: "clamp(1.6rem,4vw,2.5rem)" }}>
                      {item.value}
                    </div>
                    <span className="font-headline text-gray-500 uppercase" style={{ fontSize: "0.55rem", letterSpacing: "0.15em" }}>
                      {item.label}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
