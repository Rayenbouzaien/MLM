import { useState } from "react";

/* ── Schedule data ──────────────────────────────────────────── */
const SCHEDULE = [
  {
    id: "t1",
    label: "Turn 1",
    time: "09:00",
    color: "#E10600",
    cx: 90, cy: 365,
    title: "Kickoff — Lights Out",
    cardTitle: "KICKOFF",
    cardSub: "Problem Statement & Briefing",
    items: ["Lights Out ceremony", "Paddock introductions", "Team check-in"],
  },
  {
    id: "t2",
    label: "Turn 2",
    time: "12:00",
    color: "#00D2D2",
    cx: 940, cy: 258,
    title: "Paddock Fuel Up",
    cardTitle: "WORKSHOP",
    cardSub: "Fuel Up",
    items: ["Problem Statement & Briefing", "Paddock status update", "Mentor rotations"],
  },
  {
    id: "s1",
    label: "Sector 1",
    time: "14:00",
    color: "#00D2D2",
    cx: 712, cy: 321,
    title: "Workshops",
    cardTitle: "SECTOR 1",
    cardSub: "Workshops",
    items: ["Workshops begin", "Paddock Fuel Up", "Team connections"],
  },
  {
    id: "t3",
    label: "Turn 1",
    time: "19:00",
    color: "#E10600",
    cx: 485, cy: 367,
    title: "Lights Out",
    cardTitle: "CURRENT LAP",
    cardSub: "Kickoff",
    items: ["Problem Statement review", "Final standings", "Awards ceremony"],
  },
];

function FlagIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <line x1="4" y1="2" x2="4" y2="16" stroke="#E10600" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M4 2 L14 5 L4 8Z" fill="#E10600" />
    </svg>
  );
}
function SpeedoIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path d="M3 13 A7 7 0 0 1 15 13" stroke="#00D2D2" strokeWidth="1.5" fill="none" strokeLinecap="round" />
      <line x1="9" y1="13" x2="13" y2="7" stroke="#00D2D2" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="9" cy="13" r="1.5" fill="#00D2D2" />
    </svg>
  );
}
function WrenchIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path d="M11 3 C13 3 15 5 15 7 C15 9 13 11 11 11 L5 17 L3 15 L9 9 C7 7 7 5 9 3Z"
        stroke="#00D2D2" strokeWidth="1.3" fill="none" strokeLinejoin="round" />
    </svg>
  );
}
function ClockIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <circle cx="9" cy="9" r="7" stroke="#E10600" strokeWidth="1.5" fill="none" />
      <line x1="9" y1="5" x2="9" y2="9" stroke="#E10600" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="9" y1="9" x2="12" y2="11" stroke="#E10600" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
const ICONS = [<FlagIcon />, <SpeedoIcon />, <WrenchIcon />, <ClockIcon />];

/* ── SVG circuit paths ──────────────────────────────────────── */
// ViewBox: 0 0 1060 460
// RED OUTER — outer circuit boundary, clockwise (race direction)
const RED_OUTER = `
  M 90,378
  L 510,378
  C 565,378 600,356 613,321
  C 626,286 630,256 648,238
  C 666,220 694,212 724,212
  L 878,212
  C 922,212 960,232 968,272
  C 976,312 958,352 920,366
  C 882,380 838,366 822,336
  C 804,304 782,292 756,294
  C 730,296 716,318 714,350
  C 712,362 698,378 672,380
  L 488,380
  C 448,380 416,360 404,326
  C 392,292 402,260 424,248
  C 446,236 470,238 485,254
  C 500,270 500,300 484,324
  C 468,348 440,362 408,364
  L 170,370
  C 124,370 90,374 90,378
  Z
`;

// CYAN INNER — inner circuit boundary, counter-clockwise (reversed)
const CYAN_INNER = `
  M 90,360
  L 170,354
  L 408,348
  C 438,346 464,332 480,310
  C 496,288 494,260 480,246
  C 466,232 444,232 426,244
  C 408,256 400,286 412,316
  C 424,346 454,362 490,362
  L 672,362
  C 696,360 712,344 712,316
  C 712,288 726,272 750,270
  C 774,268 796,282 814,310
  C 832,338 872,350 910,338
  C 948,326 964,290 956,254
  C 948,218 912,200 870,200
  L 722,200
  C 692,200 666,210 648,228
  C 630,246 626,278 612,313
  C 598,348 564,366 508,366
  L 90,366
  Z
`;

/* ── small chevron marker ───────────────────────────────────── */
function Chevrons({
  path, color, count = 4,
}: {
  path: { cx: number; cy: number; angle: number }[];
  color: string;
  count?: number;
}) {
  return (
    <>
      {path.slice(0, count).map((p, i) => (
        <g key={i} transform={`translate(${p.cx},${p.cy}) rotate(${p.angle})`}>
          <path d="M-5,0 L0,-4 L5,0" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
        </g>
      ))}
    </>
  );
}

/* ── Red chevrons (CW race direction) ── roughly along top circuit */
const RED_CHEVRONS = [
  { cx: 300, cy: 375, angle: 0 },
  { cx: 598, cy: 288, angle: -42 },
  { cx: 800, cy: 210, angle: 0 },
  { cx: 960, cy: 250, angle: 90 },
  { cx: 870, cy: 360, angle: 155 },
  { cx: 600, cy: 360, angle: 180 },
];

/* ── Cyan chevrons (CCW reversed direction) */
const CYAN_CHEVRONS = [
  { cx: 300, cy: 350, angle: 180 },
  { cx: 584, cy: 274, angle: 142 },
  { cx: 800, cy: 200, angle: 180 },
  { cx: 948, cy: 238, angle: -90 },
  { cx: 866, cy: 344, angle: -25 },
  { cx: 600, cy: 348, angle: 0 },
];

export default function CircuitPage() {
  const [activeCard, setActiveCard] = useState<string | null>(null);

  return (
    <div
      className="flex-1 overflow-auto"
      style={{ background: "linear-gradient(160deg, #0c0c0c 0%, #181818 100%)" }}
    >
      {/* Header */}
      <div className="text-center pt-10 pb-4 px-6 relative">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage:
              "repeating-linear-gradient(45deg,transparent,transparent 2px,rgba(255,255,255,0.01) 2px,rgba(255,255,255,0.01) 4px),repeating-linear-gradient(-45deg,transparent,transparent 2px,rgba(255,255,255,0.01) 2px,rgba(255,255,255,0.01) 4px)",
          }}
        />
        <h1
          style={{
            fontFamily: "'Rajdhani',sans-serif",
            fontWeight: 700,
            fontSize: "clamp(1.6rem,4vw,2.8rem)",
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            color: "#fff",
          }}
        >
          GRIDLOCK HACKATHON:
          <br />
          <span style={{ color: "#00D2D2", textShadow: "0 0 20px rgba(0,210,210,0.4)" }}>
            CIRCUIT MAP &amp; SCHEDULE
          </span>
        </h1>
        <div className="flex items-center justify-center gap-6 mt-3">
          <span className="flex items-center gap-2 text-xs" style={{ fontFamily: "'Titillium Web',sans-serif", color: "#aaa" }}>
            <span className="inline-block w-6 h-0.5" style={{ background: "#E10600", boxShadow: "0 0 6px #E10600" }} />
            Race Direction (CW)
          </span>
          <span className="flex items-center gap-2 text-xs" style={{ fontFamily: "'Titillium Web',sans-serif", color: "#aaa" }}>
            <span className="inline-block w-6 h-0.5" style={{ background: "#00D2D2", boxShadow: "0 0 6px #00D2D2" }} />
            Inner Line (Reversed)
          </span>
        </div>
      </div>

      {/* SVG Circuit */}
      <div className="px-3 pb-2" style={{ maxWidth: 1060, margin: "0 auto" }}>
        <svg
          viewBox="0 0 1060 460"
          preserveAspectRatio="xMidYMid meet"
          className="w-full"
          style={{ overflow: "visible" }}
        >
          <defs>
            <filter id="redGlow">
              <feGaussianBlur stdDeviation="5" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
            <filter id="redGlowBig">
              <feGaussianBlur stdDeviation="10" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
            <filter id="cyanGlow">
              <feGaussianBlur stdDeviation="5" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
            <filter id="cyanGlowBig">
              <feGaussianBlur stdDeviation="10" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>

          {/* ── Track surface (tarmac) ── */}
          <path d={RED_OUTER} fill="rgba(30,30,30,0.7)" stroke="none" />

          {/* ── Red outer glow layer ── */}
          <path
            d={RED_OUTER}
            fill="none"
            stroke="#E10600"
            strokeWidth="18"
            opacity="0.12"
            filter="url(#redGlowBig)"
          />
          {/* ── Red outer main line ── */}
          <path
            d={RED_OUTER}
            fill="none"
            stroke="#E10600"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            filter="url(#redGlow)"
          />

          {/* ── Cyan inner glow layer ── */}
          <path
            d={CYAN_INNER}
            fill="none"
            stroke="#00D2D2"
            strokeWidth="14"
            opacity="0.12"
            filter="url(#cyanGlowBig)"
          />
          {/* ── Cyan inner main line ── */}
          <path
            d={CYAN_INNER}
            fill="none"
            stroke="#00D2D2"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            filter="url(#cyanGlow)"
          />

          {/* ── Direction chevrons ── */}
          <Chevrons path={RED_CHEVRONS} color="#E10600" count={6} />
          <Chevrons path={CYAN_CHEVRONS} color="#00D2D2" count={6} />

          {/* ── S/F start line ── */}
          <line x1="90" y1="358" x2="90" y2="390" stroke="#fff" strokeWidth="2.5" strokeDasharray="5,3" opacity="0.5" />
          <text x="76" y="408" fontFamily="'Rajdhani',sans-serif" fontWeight="700" fontSize="9" fill="#fff" opacity="0.5" textAnchor="middle">S/F</text>

          {/* ── Checkered flag marker at S/F ── */}
          {[0,1,2,3].map(i => [0,1].map(j => (
            <rect key={`${i}-${j}`} x={56 + j * 8} y={395 + i * 6} width="8" height="6"
              fill={(i + j) % 2 === 0 ? "#fff" : "#333"} opacity="0.6" />
          )))}

          {/* ── Sector dividers ── */}
          {/* Sector 1/2 boundary at T4 (top of back straight entry) */}
          <line x1="720" y1="196" x2="730" y2="220" stroke="#E10600" strokeWidth="1.5" opacity="0.5" strokeDasharray="4,3" />
          {/* Sector 2/3 boundary at T8 exit */}
          <line x1="706" y1="310" x2="718" y2="336" stroke="#E10600" strokeWidth="1.5" opacity="0.5" strokeDasharray="4,3" />

          {/* ── Sector labels ── */}
          <text x="580" y="230" fontFamily="'Rajdhani',sans-serif" fontWeight="700" fontSize="10" fill="#E10600" opacity="0.5">SECTOR 1</text>
          <text x="870" y="240" fontFamily="'Rajdhani',sans-serif" fontWeight="700" fontSize="10" fill="#00D2D2" opacity="0.5">SECTOR 2</text>
          <text x="580" y="348" fontFamily="'Rajdhani',sans-serif" fontWeight="700" fontSize="10" fill="#00D2D2" opacity="0.5">SECTOR 3</text>

          {/* ── Event nodes ── */}
          {SCHEDULE.map((ev) => (
            <g
              key={ev.id}
              style={{ cursor: "pointer" }}
              onClick={() => setActiveCard(activeCard === ev.id ? null : ev.id)}
            >
              {/* Outer glow pulse */}
              <circle cx={ev.cx} cy={ev.cy} r="18" fill={ev.color} opacity="0.1" />
              {/* Ring */}
              <circle cx={ev.cx} cy={ev.cy} r="11" fill="#111" stroke={ev.color} strokeWidth="2.5"
                filter={ev.color === "#E10600" ? "url(#redGlow)" : "url(#cyanGlow)"} />
              {/* Center dot */}
              <circle cx={ev.cx} cy={ev.cy} r="4" fill={ev.color} />

              {/* Leader line + label bubble */}
              {ev.id !== "t1" && (
                <>
                  <line
                    x1={ev.cx} y1={ev.cy - 12}
                    x2={ev.cx} y2={ev.cy - 52}
                    stroke={ev.color} strokeWidth="1" strokeDasharray="3,3" opacity="0.7"
                  />
                  <rect x={ev.cx - 70} y={ev.cy - 95} width="140" height="40" rx="3"
                    fill="rgba(12,12,12,0.92)" stroke={ev.color} strokeWidth="1" />
                  <text x={ev.cx} y={ev.cy - 78} textAnchor="middle"
                    fontFamily="'Rajdhani',sans-serif" fontWeight="700" fontSize="10.5" fill={ev.color}>
                    {ev.label}: {ev.time}
                  </text>
                  <text x={ev.cx} y={ev.cy - 62} textAnchor="middle"
                    fontFamily="'Titillium Web',sans-serif" fontSize="9.5" fill="#ccc">
                    {ev.title}
                  </text>
                </>
              )}
              {ev.id === "t1" && (
                <>
                  <line x1={ev.cx} y1={ev.cy - 12} x2={ev.cx} y2={ev.cy - 52}
                    stroke={ev.color} strokeWidth="1" strokeDasharray="3,3" opacity="0.7" />
                  <rect x={ev.cx - 10} y={ev.cy - 95} width="145" height="40" rx="3"
                    fill="rgba(12,12,12,0.92)" stroke={ev.color} strokeWidth="1" />
                  <text x={ev.cx + 62} y={ev.cy - 78} textAnchor="middle"
                    fontFamily="'Rajdhani',sans-serif" fontWeight="700" fontSize="10.5" fill={ev.color}>
                    Turn 1: 09:00
                  </text>
                  <text x={ev.cx + 62} y={ev.cy - 62} textAnchor="middle"
                    fontFamily="'Titillium Web',sans-serif" fontSize="9.5" fill="#ccc">
                    Kickoff — Lights Out
                  </text>
                </>
              )}

              {/* Time display below node (for bottom-section nodes) */}
              {(ev.id === "t1" || ev.id === "t3") && (
                <>
                  <rect x={ev.cx - 28} y={ev.cy + 16} width="56" height="20" rx="2"
                    fill="#111" stroke="#333" strokeWidth="1" />
                  <text x={ev.cx} y={ev.cy + 30} textAnchor="middle"
                    fontFamily="'Orbitron',monospace" fontSize="11" fill={ev.color}
                    style={{ textShadow: `0 0 8px ${ev.color}` }}>
                    {ev.time}
                  </text>
                </>
              )}
            </g>
          ))}
        </svg>
      </div>

      {/* ── Detail Cards ── */}
      <div
        className="grid grid-cols-2 lg:grid-cols-4 gap-3 px-5 pb-10"
        style={{ maxWidth: 1060, margin: "0 auto" }}
      >
        {SCHEDULE.map((ev, i) => (
          <div
            key={ev.id + "card"}
            className="rounded-md p-4 cursor-pointer transition-all"
            style={{
              background: activeCard === ev.id ? `rgba(${ev.color === "#E10600" ? "225,6,0" : "0,210,210"},0.08)` : "rgba(18,18,18,0.95)",
              border: `1px solid ${activeCard === ev.id ? ev.color : ev.color + "33"}`,
              boxShadow: activeCard === ev.id ? `0 0 18px ${ev.color}30` : "none",
            }}
            onClick={() => setActiveCard(activeCard === ev.id ? null : ev.id)}
          >
            <div
              className="text-xs font-bold uppercase tracking-widest mb-1"
              style={{ fontFamily: "'Rajdhani',sans-serif", color: ev.color }}
            >
              {ev.cardTitle}
            </div>
            <div
              className="font-bold mb-3 leading-tight"
              style={{ fontFamily: "'Rajdhani',sans-serif", fontWeight: 700, fontSize: "0.88rem", color: "#fff" }}
            >
              {ev.cardSub}
            </div>
            <ul className="space-y-1">
              {ev.items.map((item) => (
                <li
                  key={item}
                  className="flex items-start gap-1.5 text-gray-400"
                  style={{ fontFamily: "'Titillium Web',sans-serif", fontSize: "0.75rem" }}
                >
                  <span style={{ color: ev.color, marginTop: 1 }}>•</span>
                  {item}
                </li>
              ))}
            </ul>
            <div className="flex items-center gap-2 mt-3 pt-2" style={{ borderTop: `1px solid ${ev.color}22` }}>
              {ICONS[i]}
              <span
                style={{
                  fontFamily: "'Orbitron',monospace",
                  fontSize: "0.72rem",
                  color: ev.color,
                  textShadow: `0 0 8px ${ev.color}`,
                }}
              >
                {ev.time}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
