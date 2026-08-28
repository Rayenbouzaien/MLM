import { useState, useMemo } from "react";

/* ── Data ─────────────────────────────────────────────────── */
type Status = "green" | "amber" | "red";

interface Team {
  id: string;
  name: string;
  color: "cyan" | "red";
  project: string;
  status: Status;
  statusLabel: string;
  leader: string;
  track: string;
}

const TEAMS: Team[] = [
  { id: "1", name: "TEAM DATA DRIFTERS", color: "cyan", project: "Predictive Tire Degradation Model", status: "green", statusLabel: "Out on track", leader: "Sarah C.", track: "AI Analytics" },
  { id: "2", name: "NEURAL RACERS", color: "red", project: "Real-time Cockpit AR", status: "amber", statusLabel: "In garage", leader: "David L.", track: "VR Fan Exp" },
  { id: "3", name: "TELEMETRY TITANS", color: "cyan", project: "Driver Biometrics Dashboard", status: "green", statusLabel: "Out on track", leader: "Maria P.", track: "AI Analytics" },
  { id: "4", name: "CIRCUIT BREAKERS", color: "red", project: "AI Race Strategy Optimizer", status: "red", statusLabel: "Pit stop", leader: "James R.", track: "Real-time Logistics" },
  { id: "5", name: "APEX ENGINEERS", color: "cyan", project: "Fan Engagement Platform 3.0", status: "green", statusLabel: "Out on track", leader: "Priya M.", track: "VR Fan Exp" },
  { id: "6", name: "GRID LORDS", color: "red", project: "Sustainable Race Logistics AI", status: "amber", statusLabel: "In garage", leader: "Carlos T.", track: "Real-time Logistics" },
];

const FEED_ITEMS = [
  { color: "cyan", team: "DATA DRIFTERS", msg: "just submitted their data set!" },
  { color: "red", team: "NEURAL RACERS", msg: "telemetry stream is live." },
  { color: "#facc15", team: "MENTOR ALEX", msg: "just checked into garage bay 3." },
  { color: "cyan", team: "TELEMETRY TITANS", msg: "requesting a pit stop with Mentor Sarah." },
  { color: "red", team: "CIRCUIT BREAKERS", msg: "deployed first model iteration." },
  { color: "cyan", team: "APEX ENGINEERS", msg: "fan engagement score: 9,420 pts." },
];

const TRACKS = ["All Tracks", "AI Analytics", "VR Fan Exp", "Real-time Logistics"];

const STATUS_COLOR: Record<Status, string> = {
  green: "#22c55e",
  amber: "#f59e0b",
  red: "#ef4444",
};

/* ── Small SVG assets ────────────────────────────────────── */
function F1CarSilhouette({ color }: { color: "cyan" | "red" }) {
  const c = color === "cyan" ? "#00D2D2" : "#E10600";
  return (
    <svg viewBox="0 0 120 48" fill="none" className="w-full h-full">
      <g opacity="0.7">
        {/* body */}
        <path d="M18,30 L10,28 L8,24 L14,20 L30,18 L50,16 L72,16 L90,18 L104,20 L112,24 L110,28 L100,30 Z"
          stroke={c} strokeWidth="1.2" fill="none" />
        {/* cockpit */}
        <path d="M52,16 L58,10 L68,10 L74,16" stroke={c} strokeWidth="1.2" fill="none" />
        {/* front wing */}
        <path d="M100,28 L114,32 L112,36 L96,34" stroke={c} strokeWidth="1" fill="none" />
        {/* rear wing */}
        <path d="M14,22 L4,18 L4,26 L14,26" stroke={c} strokeWidth="1" fill="none" />
        {/* rear tyre */}
        <ellipse cx="28" cy="32" rx="7" ry="5" stroke={c} strokeWidth="1.2" fill="none" />
        {/* front tyre */}
        <ellipse cx="90" cy="32" rx="6" ry="5" stroke={c} strokeWidth="1.2" fill="none" />
        {/* exhaust glow */}
        <line x1="8" y1="24" x2="2" y2="24" stroke={c} strokeWidth="1.5" opacity="0.5" />
      </g>
    </svg>
  );
}

function MiniChart({ color }: { color: "cyan" | "red" }) {
  const c = color === "cyan" ? "#00D2D2" : "#E10600";
  const bars = [3, 6, 4, 8, 5, 9, 6, 10, 7, 8];
  return (
    <svg viewBox="0 0 40 20" fill="none" className="w-10 h-5">
      {bars.map((h, i) => (
        <rect key={i} x={i * 4} y={20 - h * 1.8} width="3" height={h * 1.8}
          fill={c} opacity="0.6" rx="0.5" />
      ))}
    </svg>
  );
}

function CheckeredCorner() {
  return (
    <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none">
      {[0,1,2].map(i => [0,1,2].map(j => (
        <rect key={`${i}-${j}`} x={i * 8} y={j * 8} width="8" height="8"
          fill={(i + j) % 2 === 0 ? "#fff" : "#555"} opacity="0.6" />
      )))}
    </svg>
  );
}

/* ── Team Card ───────────────────────────────────────────── */
function TeamCard({ team }: { team: Team }) {
  const border = team.color === "cyan" ? "#00D2D2" : "#E10600";
  const nameColor = team.color === "cyan" ? "#00D2D2" : "#E10600";

  return (
    <div
      className="relative rounded-lg p-4 flex flex-col gap-2 overflow-hidden transition-transform hover:-translate-y-0.5"
      style={{
        background: team.color === "cyan"
          ? "linear-gradient(135deg, rgba(0,210,210,0.07) 0%, rgba(10,10,20,0.95) 60%)"
          : "linear-gradient(135deg, rgba(225,6,0,0.07) 0%, rgba(10,10,20,0.95) 60%)",
        border: `1.5px solid ${border}`,
        boxShadow: `0 0 18px ${border}22, inset 0 0 30px rgba(0,0,0,0.4)`,
      }}
    >
      {/* Corner checkered flag */}
      <div className="absolute top-2 right-2 opacity-60">
        <CheckeredCorner />
      </div>

      {/* Mini chart top-right */}
      <div className="absolute top-10 right-3">
        <MiniChart color={team.color} />
      </div>

      {/* Team name */}
      <h3
        className="font-bold uppercase leading-tight pr-16"
        style={{
          fontFamily: "'Rajdhani',sans-serif",
          fontSize: "clamp(1rem,2vw,1.15rem)",
          color: nameColor,
          textShadow: `0 0 12px ${nameColor}88`,
          letterSpacing: "0.04em",
        }}
      >
        {team.name}
      </h3>

      {/* F1 car */}
      <div className="absolute bottom-3 right-2 w-28 h-14 opacity-40">
        <F1CarSilhouette color={team.color} />
      </div>

      {/* Info rows */}
      <div className="space-y-1 pr-28">
        <div>
          <span className="text-white font-semibold text-xs" style={{ fontFamily: "'Titillium Web',sans-serif" }}>Project:</span>
          <br />
          <span className="text-gray-300 text-xs" style={{ fontFamily: "'Titillium Web',sans-serif" }}>{team.project}</span>
        </div>
        <div>
          <span className="text-white font-semibold text-xs" style={{ fontFamily: "'Titillium Web',sans-serif" }}>Status Lamp:</span>
          <br />
          <span className="text-xs flex items-center gap-1.5" style={{ fontFamily: "'Titillium Web',sans-serif" }}>
            <span className="w-2 h-2 rounded-full inline-block shrink-0" style={{ background: STATUS_COLOR[team.status], boxShadow: `0 0 6px ${STATUS_COLOR[team.status]}` }} />
            <span className="text-gray-300">{team.statusLabel}</span>
            <span style={{ color: STATUS_COLOR[team.status] }}>({team.status.charAt(0).toUpperCase() + team.status.slice(1)})</span>
          </span>
        </div>
        <div>
          <span className="text-white font-semibold text-xs" style={{ fontFamily: "'Titillium Web',sans-serif" }}>Team Leader: </span>
          <span className="text-gray-300 text-xs" style={{ fontFamily: "'Titillium Web',sans-serif" }}>{team.leader}</span>
        </div>
      </div>

      {/* Track tag */}
      <div className="mt-1">
        <span
          className="text-xs px-2 py-0.5 rounded"
          style={{
            fontFamily: "'Titillium Web',sans-serif",
            background: `${border}18`,
            border: `1px solid ${border}44`,
            color: border,
            fontSize: "0.65rem",
          }}
        >
          {team.track}
        </span>
      </div>
    </div>
  );
}

/* ── Pit Wall Feed ───────────────────────────────────────── */
function PitWallFeed() {
  return (
    <div
      className="rounded-lg overflow-hidden flex flex-col"
      style={{
        background: "rgba(8,8,16,0.98)",
        border: "1.5px solid #00D2D2",
        boxShadow: "0 0 24px rgba(0,210,210,0.15)",
      }}
    >
      {/* Header */}
      <div
        className="px-4 py-3 flex items-center gap-2"
        style={{ borderBottom: "1px solid rgba(0,210,210,0.2)", background: "rgba(0,210,210,0.06)" }}
      >
        <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: "#22c55e", boxShadow: "0 0 6px #22c55e" }} />
        <span className="font-bold uppercase tracking-widest text-white"
          style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: "0.8rem" }}>
          PIT WALL LIVE FEED
        </span>
      </div>

      {/* Corner framing accents */}
      <div className="relative flex-1 p-3">
        {/* neon corner brackets */}
        <div className="absolute top-1 left-1 w-4 h-4 border-t border-l" style={{ borderColor: "#00D2D2" }} />
        <div className="absolute top-1 right-1 w-4 h-4 border-t border-r" style={{ borderColor: "#00D2D2" }} />
        <div className="absolute bottom-1 left-1 w-4 h-4 border-b border-l" style={{ borderColor: "#00D2D2" }} />
        <div className="absolute bottom-1 right-1 w-4 h-4 border-b border-r" style={{ borderColor: "#00D2D2" }} />

        <div className="space-y-3 px-1">
          {FEED_ITEMS.map((item, i) => {
            const teamColor = item.color === "cyan" ? "#00D2D2" : item.color === "red" ? "#E10600" : item.color;
            return (
              <div key={i} className="flex gap-2 items-start">
                <div className="w-0.5 shrink-0 mt-1 rounded-full h-full min-h-[28px]"
                  style={{ background: teamColor, opacity: 0.7 }} />
                <p className="text-gray-400 leading-snug" style={{ fontFamily: "'Titillium Web',sans-serif", fontSize: "0.72rem" }}>
                  <span style={{ color: teamColor, fontWeight: 600 }}>{item.team}</span>
                  {" "}
                  {item.msg}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ── Page ────────────────────────────────────────────────── */
export default function PaddockPage({ onOpenGarage }: { onOpenGarage: () => void }) {
  const [search, setSearch] = useState("");
  const [track, setTrack] = useState("All Tracks");

  const filtered = useMemo(() =>
    TEAMS.filter(t =>
      (track === "All Tracks" || t.track === track) &&
      (search === "" || t.name.toLowerCase().includes(search.toLowerCase()) ||
        t.leader.toLowerCase().includes(search.toLowerCase()))
    ), [search, track]);

  return (
    <div
      className="flex-1 overflow-auto"
      style={{ background: "linear-gradient(160deg,#090910 0%,#141420 100%)" }}
    >
      {/* Carbon texture overlay */}
      <div className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: "repeating-linear-gradient(45deg,transparent,transparent 2px,rgba(255,255,255,0.012) 2px,rgba(255,255,255,0.012) 4px),repeating-linear-gradient(-45deg,transparent,transparent 2px,rgba(255,255,255,0.012) 2px,rgba(255,255,255,0.012) 4px)",
          zIndex: 0,
        }} />

      <div className="relative z-10">
        {/* Hero header */}
        <div
          className="text-center py-10 px-6"
          style={{
            background: "linear-gradient(to bottom,rgba(0,210,210,0.06) 0%,transparent 100%)",
            borderBottom: "1px solid rgba(0,210,210,0.15)",
          }}
        >
          {/* Neon corner accents */}
          <div className="absolute top-0 left-0 w-16 h-16 pointer-events-none">
            <svg viewBox="0 0 64 64" fill="none" className="w-full h-full">
              <path d="M2,32 L2,8 C2,4 4,2 8,2 L32,2" stroke="#00D2D2" strokeWidth="2" opacity="0.5" />
            </svg>
          </div>
          <div className="absolute top-0 right-0 w-16 h-16 pointer-events-none">
            <svg viewBox="0 0 64 64" fill="none" className="w-full h-full">
              <path d="M32,2 L56,2 C60,2 62,4 62,8 L62,32" stroke="#E10600" strokeWidth="2" opacity="0.5" />
            </svg>
          </div>

          <h1 className="font-bold text-white uppercase"
            style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: "clamp(1.8rem,4vw,2.8rem)", letterSpacing: "0.04em" }}>
            THE PADDOCK:
          </h1>
          <h2 className="font-semibold text-gray-300 mb-5"
            style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: "clamp(1.2rem,3vw,2rem)", letterSpacing: "0.02em" }}>
            Team Constructor Database
          </h2>
          {/* My Garage CTA */}
          <button
            onClick={onOpenGarage}
            className="inline-flex items-center gap-3 px-6 py-3 rounded transition-all hover:scale-105 active:scale-95"
            style={{
              background: "linear-gradient(135deg,#00D2D2,#008a8a)",
              border: "none",
              cursor: "pointer",
              boxShadow: "0 0 24px rgba(0,210,210,0.4), inset 0 1px 0 rgba(255,255,255,0.15)",
              fontFamily: "'Rajdhani',sans-serif",
              fontWeight: 700,
              fontSize: "0.9rem",
              letterSpacing: "0.15em",
              color: "#000",
              textTransform: "uppercase",
            }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <rect x="1" y="4" width="14" height="10" rx="1.5" stroke="#000" strokeWidth="1.4" fill="none" />
              <path d="M4 4 L4 3 C4 1.9 4.9 1 6 1 L10 1 C11.1 1 12 1.9 12 3 L12 4" stroke="#000" strokeWidth="1.4" fill="none" />
              <line x1="8" y1="7" x2="8" y2="11" stroke="#000" strokeWidth="1.4" strokeLinecap="round" />
              <line x1="6" y1="9" x2="10" y2="9" stroke="#000" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
            MY CONSTRUCTOR GARAGE
          </button>
        </div>

        {/* Search + Filter */}
        <div className="px-6 py-5 flex flex-col sm:flex-row gap-3 items-start sm:items-center"
          style={{ maxWidth: 1200, margin: "0 auto" }}>
          {/* Search */}
          <div className="relative flex-1 max-w-sm">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 opacity-40" width="14" height="14" viewBox="0 0 16 16" fill="none">
              <circle cx="6" cy="6" r="5" stroke="#fff" strokeWidth="1.5" />
              <line x1="10" y1="10" x2="14" y2="14" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <input
              type="text"
              placeholder="Search Drivers / Teams"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 rounded text-white placeholder-gray-500 outline-none focus:ring-1 text-sm"
              style={{
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.15)",
                fontFamily: "'Titillium Web',sans-serif",
                focusRingColor: "#00D2D2",
              }}
            />
          </div>

          {/* Filter label */}
          <span className="text-gray-400 text-sm shrink-0" style={{ fontFamily: "'Titillium Web',sans-serif" }}>
            Filter by Constructor
          </span>

          {/* Dropdown */}
          <select
            value={track}
            onChange={e => setTrack(e.target.value)}
            className="px-4 py-2.5 rounded text-white text-sm outline-none cursor-pointer"
            style={{
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(0,210,210,0.35)",
              fontFamily: "'Titillium Web',sans-serif",
              color: "#fff",
              minWidth: 200,
            }}
          >
            {TRACKS.map(t => (
              <option key={t} value={t} style={{ background: "#0f0f1a", color: "#fff" }}>{t}</option>
            ))}
          </select>

          {/* Stats */}
          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs text-gray-500" style={{ fontFamily: "'Titillium Web',sans-serif" }}>
              {filtered.length} constructor{filtered.length !== 1 ? "s" : ""} on grid
            </span>
          </div>
        </div>

        {/* Main grid + sidebar */}
        <div className="px-5 pb-10 flex gap-5 items-start" style={{ maxWidth: 1200, margin: "0 auto" }}>
          {/* Team cards grid */}
          <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.length === 0 ? (
              <div className="col-span-3 text-center py-16 text-gray-500"
                style={{ fontFamily: "'Titillium Web',sans-serif" }}>
                No teams match your search.
              </div>
            ) : (
              filtered.map(team => <TeamCard key={team.id} team={team} />)
            )}
          </div>

          {/* Pit Wall sidebar */}
          <div className="hidden lg:block w-64 xl:w-72 shrink-0 sticky top-20">
            <PitWallFeed />
          </div>
        </div>

        {/* Mobile pit wall */}
        <div className="lg:hidden px-5 pb-10" style={{ maxWidth: 1200, margin: "0 auto" }}>
          <PitWallFeed />
        </div>
      </div>
    </div>
  );
}
