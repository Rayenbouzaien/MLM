import { useState, useEffect } from "react";
import { api, ApiError } from "../lib/api";

/* ── Live timers ─────────────────────────────────────────── */
const SESSION_START = Date.now() - (23 * 60 + 5) * 1000;
const DEADLINE = new Date(Date.now() + (16 * 24 * 60 * 60 + 22 * 60 + 15) * 1000);

function useSessionTime() {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - SESSION_START) / 1000)), 1000);
    return () => clearInterval(id);
  }, []);
  const h = Math.floor(elapsed / 3600);
  const m = Math.floor((elapsed % 3600) / 60);
  const s = elapsed % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function useDeadline() {
  const calc = () => {
    const d = Math.max(0, DEADLINE.getTime() - Date.now());
    return {
      days: Math.floor(d / 86400000),
      min: Math.floor((d % 86400000) / 60000),
      sec: Math.floor((d % 60000) / 1000),
    };
  };
  const [t, setT] = useState(calc);
  useEffect(() => {
    const id = setInterval(() => setT(calc()), 1000);
    return () => clearInterval(id);
  });
  return t;
}

function pad(n: number) { return String(n).padStart(2, "0"); }

/* ── F1 Car Blueprint (top-down SVG) ─────────────────────── */
function F1Blueprint({ teamName }: { teamName: string }) {
  return (
    <svg viewBox="0 0 480 260" fill="none" className="w-full h-full" style={{ maxHeight: 220 }}>
      <defs>
        <filter id="bpGlow">
          <feGaussianBlur stdDeviation="2.5" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(0,210,210,0.08)" strokeWidth="0.5" />
        </pattern>
      </defs>

      {/* Blueprint grid */}
      <rect width="480" height="260" fill="url(#grid)" />
      <rect width="480" height="260" fill="rgba(0,20,40,0.5)" />

      <g filter="url(#bpGlow)">
        {/* ── Main body ── */}
        <path d="M 90,100 L 100,72 L 180,62 L 300,60 L 380,68 L 400,80 L 408,100 L 408,160 L 400,172 L 380,182 L 300,190 L 180,190 L 100,182 L 90,165 Z"
          stroke="#00D2D2" strokeWidth="1.4" fill="rgba(0,30,50,0.6)" />

        {/* Cockpit halo */}
        <ellipse cx="240" cy="130" rx="35" ry="22" stroke="#00D2D2" strokeWidth="1.2" fill="rgba(0,20,40,0.8)" />
        <ellipse cx="240" cy="130" rx="22" ry="14" stroke="#E10600" strokeWidth="0.8" fill="rgba(30,5,5,0.5)" />

        {/* Front wing */}
        <path d="M 370,84 L 430,70 L 445,80 L 445,90 L 435,96 L 408,100"
          stroke="#E10600" strokeWidth="1.2" fill="none" />
        <path d="M 370,170 L 430,184 L 445,175 L 445,165 L 435,158 L 408,160"
          stroke="#E10600" strokeWidth="1.2" fill="none" />
        {/* Front wing plane */}
        <line x1="430" y1="72" x2="430" y2="182" stroke="#E10600" strokeWidth="0.7" opacity="0.5" />

        {/* Rear wing */}
        <path d="M 108,88 L 60,72 L 48,80 L 48,90 L 62,100 L 90,100"
          stroke="#E10600" strokeWidth="1.2" fill="none" />
        <path d="M 108,168 L 60,182 L 48,175 L 48,165 L 62,158 L 90,160"
          stroke="#E10600" strokeWidth="1.2" fill="none" />
        {/* Rear wing plane */}
        <line x1="60" y1="74" x2="60" y2="180" stroke="#E10600" strokeWidth="0.7" opacity="0.5" />

        {/* Front tyres */}
        <rect x="358" y="72" width="28" height="36" rx="6" stroke="#00D2D2" strokeWidth="1.3" fill="rgba(0,20,40,0.7)" />
        <rect x="358" y="152" width="28" height="36" rx="6" stroke="#00D2D2" strokeWidth="1.3" fill="rgba(0,20,40,0.7)" />

        {/* Rear tyres */}
        <rect x="94" y="76" width="32" height="40" rx="6" stroke="#00D2D2" strokeWidth="1.3" fill="rgba(0,20,40,0.7)" />
        <rect x="94" y="144" width="32" height="40" rx="6" stroke="#00D2D2" strokeWidth="1.3" fill="rgba(0,20,40,0.7)" />

        {/* Floor detail lines */}
        <line x1="130" y1="80" x2="360" y2="80" stroke="#00D2D2" strokeWidth="0.6" opacity="0.4" />
        <line x1="130" y1="175" x2="360" y2="175" stroke="#00D2D2" strokeWidth="0.6" opacity="0.4" />
        <line x1="130" y1="90" x2="200" y2="90" stroke="#00D2D2" strokeWidth="0.5" opacity="0.25" />
        <line x1="300" y1="90" x2="360" y2="90" stroke="#00D2D2" strokeWidth="0.5" opacity="0.25" />
        <line x1="130" y1="168" x2="200" y2="168" stroke="#00D2D2" strokeWidth="0.5" opacity="0.25" />
        <line x1="300" y1="168" x2="360" y2="168" stroke="#00D2D2" strokeWidth="0.5" opacity="0.25" />

        {/* Engine cover centre line */}
        <line x1="100" y1="130" x2="408" y2="130" stroke="#00D2D2" strokeWidth="0.6" strokeDasharray="6,4" opacity="0.3" />

        {/* Sidepods */}
        <path d="M 160,68 L 160,82 L 200,82 L 200,68" stroke="#00D2D2" strokeWidth="0.9" fill="none" opacity="0.6" />
        <path d="M 160,186 L 160,172 L 200,172 L 200,186" stroke="#00D2D2" strokeWidth="0.9" fill="none" opacity="0.6" />
        <path d="M 290,68 L 290,82 L 330,82 L 330,68" stroke="#00D2D2" strokeWidth="0.9" fill="none" opacity="0.6" />
        <path d="M 290,186 L 290,172 L 330,172 L 330,186" stroke="#00D2D2" strokeWidth="0.9" fill="none" opacity="0.6" />

        {/* Team name on car */}
        <text x="240" y="120" textAnchor="middle"
          fontFamily="'Rajdhani',sans-serif" fontWeight="700" fontSize="10"
          fill="#E10600" letterSpacing="3" transform="rotate(-0,240,120)" opacity="0.9">
          {teamName.toUpperCase()}
        </text>
        <text x="240" y="148" textAnchor="middle"
          fontFamily="'Titillium Web',sans-serif" fontSize="7"
          fill="#00D2D2" letterSpacing="2" opacity="0.6">
          MACHINE LEARNING MARATHON 3.0
        </text>

        {/* Annotation lines */}
        <line x1="386" y1="90" x2="460" y2="55" stroke="#00D2D2" strokeWidth="0.7" opacity="0.4" />
        <text x="462" y="52" fontFamily="'Titillium Web',sans-serif" fontSize="7" fill="#00D2D2" opacity="0.5">FRONT WING</text>
        <line x1="110" y1="96" x2="38" y2="60" stroke="#00D2D2" strokeWidth="0.7" opacity="0.4" />
        <text x="4" y="57" fontFamily="'Titillium Web',sans-serif" fontSize="7" fill="#00D2D2" opacity="0.5">REAR</text>
        <line x1="374" y1="90" x2="420" y2="220" stroke="#00D2D2" strokeWidth="0.7" opacity="0.3" />
        <text x="380" y="232" fontFamily="'Titillium Web',sans-serif" fontSize="7" fill="#00D2D2" opacity="0.5">F. TYRE</text>
      </g>
    </svg>
  );
}

/* ── Progress tracker ───────────────────────────────────── */
const MILESTONES = [
  { label: "IDEATION", done: true },
  { label: "PROTOTYPE", done: true },
  { label: "QUALIFYING\nSUBMISSION", done: true },
  { label: "FINAL RACE\nDEMO", done: false },
];

function ProgressTracker() {
  return (
    <div className="pt-3 pb-1">
      <div className="relative flex items-center justify-between">
        {/* Track line */}
        <div className="absolute left-0 right-0 top-3.5 h-0.5" style={{ background: "#333", zIndex: 0 }} />
        <div
          className="absolute left-0 top-3.5 h-0.5"
          style={{ width: "66%", background: "linear-gradient(to right,#22c55e,#22c55e)", zIndex: 0 }}
        />
        {MILESTONES.map((m, i) => (
          <div key={i} className="relative flex flex-col items-center gap-1.5 z-10">
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center"
              style={{
                background: m.done ? "#22c55e" : "#1a1a2e",
                border: m.done ? "2px solid #22c55e" : "2px solid #444",
                boxShadow: m.done ? "0 0 8px #22c55e80" : "none",
              }}
            >
              {m.done ? (
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M2 6 L5 9 L10 3" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ) : (
                <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
                  <circle cx="7" cy="7" r="5" stroke="#00D2D2" strokeWidth="1.4" fill="none" />
                  <path d="M5 5 A3 3 0 0 1 11 7" stroke="#00D2D2" strokeWidth="1.2" fill="none" strokeLinecap="round" />
                </svg>
              )}
            </div>
            <span
              className="text-center whitespace-pre-line leading-tight"
              style={{
                fontFamily: "'Titillium Web',sans-serif",
                fontSize: "0.55rem",
                color: m.done ? "#22c55e" : "#666",
                letterSpacing: "0.03em",
              }}
            >
              {m.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Member row ──────────────────────────────────────────── */
function Avatar({ name }: { name: string }) {
  const initials = name.replace("User_", "").slice(0, 2).toUpperCase();
  return (
    <div
      className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-bold"
      style={{ background: "rgba(0,210,210,0.15)", border: "1.5px solid rgba(0,210,210,0.4)", color: "#00D2D2", fontFamily: "'Rajdhani',sans-serif" }}
    >
      {initials}
    </div>
  );
}

/* ── Countdown digit box ─────────────────────────────────── */
function DigitBox({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <div
        className="px-3 py-1.5 rounded text-center"
        style={{
          fontFamily: "'Orbitron',monospace",
          fontSize: "1.3rem",
          color: "#E10600",
          background: "#0d0d0d",
          border: "1px solid #2a2a2a",
          textShadow: "0 0 10px rgba(225,6,0,0.8)",
          minWidth: 52,
        }}
      >
        {value}
      </div>
      <span style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: "0.55rem", color: "#555", letterSpacing: "0.1em" }}>
        {label}
      </span>
    </div>
  );
}

/* ── Page ────────────────────────────────────────────────── */
export default function GaragePage({ onBack, team }: { onBack: () => void; team: { id: string; teamName: string; memberId: string; memberName: string; isLeader: boolean; memberCount: number; selectedTrack?: { id: string; title: string; color: string } | null; members?: { id: string; name: string; isLeader: boolean }[] } }) {
  const sessionTime = useSessionTime();
  const { days, min, sec } = useDeadline();
  const [repoUrl, setRepoUrl] = useState("");
  const [driveUrl, setDriveUrl] = useState("");
  const [selectedChallenges, setSelectedChallenges] = useState<{ id: string; title: string; color: string }[]>(team.selectedTrack ? [team.selectedTrack] : []);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<{ github_url: string; drive_url: string | null }> ("/api/submissions/me")
      .then((sub) => {
        setRepoUrl(sub.github_url);
        setDriveUrl(sub.drive_url ?? "");
        setSubmitted(true);
      })
      .catch(() => {}); // no submission yet — that's fine, form stays blank

    api.get<{ team: typeof team }>("/api/auth/me")
      .then((res) => setTeamMembers(res.team.members ?? []))
      .catch(() => {});

    api
      .get<{ challenges: { id: string; title: string; color: string }[] }>("/api/challenges/me")
      .then((res) => setSelectedChallenges(res.challenges))
      .catch(() => setSelectedChallenges([]));
  }, []);

  const [teamMembers, setTeamMembers] = useState<{ id: string; name: string; isLeader: boolean }[]>(team.members ?? []);

  async function handleSubmit() {
    if (submitting) return;
    setSubmitError(null);

    if (!repoUrl.trim()) {
      setSubmitError("A GitHub repository link is required.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.post<{ submission: { github_url: string } }>("/api/submissions", {
        githubUrl: repoUrl.trim(),
        driveUrl: driveUrl.trim() || undefined,
      });
      setRepoUrl(res.submission.github_url);
      setSubmitted(true);
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.message : "Submission failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="flex-1 overflow-auto relative"
      style={{ background: "linear-gradient(160deg,#080810 0%,#10101a 100%)" }}
    >
      {/* Carbon texture */}
      <div className="pointer-events-none absolute inset-0 z-0"
        style={{
          backgroundImage: "repeating-linear-gradient(45deg,transparent,transparent 2px,rgba(255,255,255,0.01) 2px,rgba(255,255,255,0.01) 4px),repeating-linear-gradient(-45deg,transparent,transparent 2px,rgba(255,255,255,0.01) 2px,rgba(255,255,255,0.01) 4px)",
        }} />

      <div className="relative z-10 p-5" style={{ maxWidth: 1200, margin: "0 auto" }}>
        {/* Back button */}
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-sm mb-5 transition-colors hover:text-white"
          style={{ fontFamily: "'Rajdhani',sans-serif", color: "#00D2D2", background: "none", border: "none", cursor: "pointer" }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M10 3 L5 8 L10 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          BACK TO THE PADDOCK
        </button>

        {/* Main 3-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr_260px] gap-5">

          {/* ── LEFT: Roster + Progress ── */}
          <div className="flex flex-col gap-4">
            {/* Team Roster */}
            <div
              className="rounded-lg overflow-hidden"
              style={{ border: "1.5px solid rgba(0,210,210,0.4)", background: "rgba(0,210,210,0.04)" }}
            >
              {/* Header */}
              <div className="px-4 py-3" style={{ borderBottom: "1px solid rgba(0,210,210,0.2)" }}>
                <h3 className="font-bold uppercase tracking-widest text-white"
                  style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: "0.9rem" }}>
                  TEAM ROSTER ({teamMembers.length}/{team.memberCount})
                </h3>
              </div>
              {/* Members */}
              <div className="divide-y" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
                {teamMembers.map((m) => (
                  <div key={m.id} className="flex items-center gap-3 px-4 py-2.5">
                    <Avatar name={m.name} />
                    <div className="flex-1 min-w-0">
                      <div className="text-white text-sm font-semibold truncate"
                        style={{ fontFamily: "'Rajdhani',sans-serif" }}>
                        {m.name}
                      </div>
                      <div className="text-gray-500 text-xs" style={{ fontFamily: "'Titillium Web',sans-serif" }}>
                        {m.isLeader ? "Team Leader" : "Team Member"}
                      </div>
                    </div>
                    <span
                      className="text-xs px-2 py-0.5 rounded-full shrink-0"
                      style={{
                        fontFamily: "'Titillium Web',sans-serif",
                        fontSize: "0.65rem",
                        color: m.isLeader ? "#E10600" : "#22c55e",
                        border: `1px solid ${m.isLeader ? "#E10600" : "#22c55e"}`,
                        background: `${m.isLeader ? "#E10600" : "#22c55e"}15`,
                        whiteSpace: "nowrap",
                      }}
                    >
                        {m.isLeader ? "LEADER" : "ACTIVE"}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Project Pit Stop */}
            <div
              className="rounded-lg p-4"
              style={{ border: "1.5px solid rgba(225,6,0,0.35)", background: "rgba(225,6,0,0.04)" }}
            >
              <h3 className="font-bold uppercase tracking-widest text-white mb-0.5"
                style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: "0.9rem" }}>
                PROJECT PIT STOP
              </h3>
              <p className="text-gray-500 text-xs mb-3" style={{ fontFamily: "'Titillium Web',sans-serif" }}>
                Progress Tracking
              </p>
              <ProgressTracker />
            </div>
          </div>

          {/* ── CENTER: Blueprint + Timer ── */}
          <div className="flex flex-col gap-4">
            {/* Title */}
            <div className="text-center">
              <h2 className="font-bold text-white uppercase"
                style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: "clamp(1.4rem,3vw,2rem)", letterSpacing: "0.05em" }}>
                YOUR CONSTRUCTOR GARAGE
              </h2>
              <p className="text-gray-400 text-sm" style={{ fontFamily: "'Rajdhani',sans-serif", letterSpacing: "0.1em" }}>
                TEAM: {team.teamName} · YOU: {team.memberName}
              </p>
              {team.isLeader && team.pitPassCode && <div className="mt-2 flex items-center justify-center gap-2 text-xs uppercase tracking-widest" style={{ color: "#00D2D2" }}><span>Pit Pass: {team.pitPassCode}</span><button type="button" onClick={() => void navigator.clipboard?.writeText(team.pitPassCode ?? "")} className="border border-[#00D2D2] px-2 py-1 text-[10px] text-[#00D2D2]">Copy invite</button></div>}
            </div>

            {/* Car blueprint panel */}
            <div
              className="rounded-lg p-3 flex items-center justify-center"
              style={{
                border: "1.5px solid rgba(0,210,210,0.5)",
                background: "rgba(0,10,25,0.9)",
                boxShadow: "0 0 30px rgba(0,210,210,0.1)",
                minHeight: 180,
              }}
            >
              <F1Blueprint teamName={team.teamName} />
            </div>

            {/* Session timer + Submission form */}
            <div
              className="rounded-lg px-5 py-4 flex flex-col gap-4"
              style={{
                border: "1.5px solid rgba(0,210,210,0.3)",
                background: "rgba(0,0,0,0.6)",
              }}
            >
              <div className="flex items-center gap-4 flex-wrap">
                <div className="flex flex-col">
                  <span className="text-gray-500 text-xs tracking-widest uppercase mb-1"
                    style={{ fontFamily: "'Titillium Web',sans-serif" }}>
                    Session Time
                  </span>
                  <span
                    style={{
                      fontFamily: "'Orbitron',monospace",
                      fontSize: "1.6rem",
                      color: "#E10600",
                      textShadow: "0 0 14px rgba(225,6,0,0.8)",
                      letterSpacing: "0.08em",
                    }}
                  >
                    {sessionTime}
                  </span>
                </div>
              </div>

              {/* GitHub link */}
              <div className="flex flex-col gap-1.5">
                <span className="text-gray-500 text-xs tracking-widest uppercase"
                  style={{ fontFamily: "'Titillium Web',sans-serif" }}>
                  GitHub Repository (required)
                </span>
                <div
                  className="flex items-center gap-2 px-3 py-2 rounded"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)" }}
                >
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="shrink-0">
                    <path d="M8 1C4.13 1 1 4.13 1 8c0 3.09 2.01 5.72 4.79 6.65.35.06.48-.15.48-.34v-1.2C4.1 13.54 3.7 12.11 3.7 12.11c-.32-.81-.78-1.02-.78-1.02-.64-.43.05-.42.05-.42.7.05 1.07.72 1.07.72.63 1.07 1.64.76 2.04.58.06-.45.24-.76.44-.93-1.56-.18-3.2-.78-3.2-3.47 0-.77.28-1.39.72-1.88-.07-.18-.31-.89.07-1.85 0 0 .58-.19 1.91.71A6.6 6.6 0 018 5.14c.59 0 1.19.08 1.74.23 1.33-.9 1.91-.71 1.91-.71.38.96.14 1.67.07 1.85.45.49.72 1.11.72 1.88 0 2.7-1.64 3.29-3.2 3.47.25.22.47.65.47 1.3v1.93c0 .19.13.4.48.34A7 7 0 0015 8c0-3.87-3.13-7-7-7z" fill="#aaa" />
                  </svg>
                  <input
                    type="text"
                    value={repoUrl}
                    onChange={e => { setRepoUrl(e.target.value); setSubmitted(false); }}
                    placeholder="https://github.com/your-team/your-repo"
                    className="flex-1 bg-transparent text-xs outline-none text-gray-300 truncate"
                    style={{ fontFamily: "'Titillium Web',sans-serif" }}
                  />
                </div>
              </div>

              {/* Google Drive link (optional) */}
              <div className="flex flex-col gap-1.5">
                <span className="text-gray-500 text-xs tracking-widest uppercase"
                  style={{ fontFamily: "'Titillium Web',sans-serif" }}>
                  Google Drive Link (optional)
                </span>
                <div
                  className="flex items-center gap-2 px-3 py-2 rounded"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)" }}
                >
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="shrink-0">
                    <path d="M5.5 1.5 L1 9.3 L3.2 13.1 L7.7 5.3 Z" fill="#00D2D2" opacity="0.85" />
                    <path d="M8.3 5.3 L12.8 13.1 L15 9.3 L10.5 1.5 Z" fill="#E10600" opacity="0.85" />
                    <path d="M3.6 13.6 L12.4 13.6 L14 10.9 L2 10.9 Z" fill="#aaa" opacity="0.85" />
                  </svg>
                  <input
                    type="text"
                    value={driveUrl}
                    onChange={e => { setDriveUrl(e.target.value); setSubmitted(false); }}
                    placeholder="https://drive.google.com/... (optional)"
                    className="flex-1 bg-transparent text-xs outline-none text-gray-300 truncate"
                    style={{ fontFamily: "'Titillium Web',sans-serif" }}
                  />
                </div>
              </div>

              {submitError && (
                <p className="text-xs" style={{ fontFamily: "'Titillium Web',sans-serif", color: "#ef4444" }}>
                  {submitError}
                </p>
              )}

              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="w-full py-3 rounded font-black uppercase tracking-widest transition-all hover:scale-[1.02] active:scale-95"
                style={{
                  fontFamily: "'Rajdhani',sans-serif",
                  fontSize: "1rem",
                  letterSpacing: "0.2em",
                  background: submitting ? "#444" : submitted ? "#22c55e" : "#E10600",
                  color: "#fff",
                  border: "none",
                  cursor: submitting ? "wait" : "pointer",
                  boxShadow: submitted
                    ? "0 0 20px rgba(34,197,94,0.5)"
                    : "0 0 20px rgba(225,6,0,0.5), inset 0 1px 0 rgba(255,255,255,0.1)",
                  opacity: submitting ? 0.7 : 1,
                }}
              >
                {submitting ? "SUBMITTING..." : submitted ? "✓ INNOVATION SUBMITTED" : "SUBMIT INNOVATION"}
              </button>
            </div>
          </div>

          {/* ── RIGHT: Stats ── */}
          <div
            className="rounded-lg overflow-hidden flex flex-col"
            style={{ border: "1.5px solid rgba(225,6,0,0.35)", background: "rgba(10,5,5,0.9)" }}
          >
            <div className="px-4 py-3" style={{ borderBottom: "1px solid rgba(225,6,0,0.2)" }}>
              <h3 className="font-bold uppercase text-white tracking-wider"
                style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: "0.85rem" }}>
                TEAM STATUS &amp; STATS
              </h3>
            </div>

            <div className="p-4 flex flex-col gap-5 flex-1">
              {/* 1. Selected track */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-bold" style={{ fontFamily: "'Rajdhani',sans-serif", color: "#E10600" }}>1.</span>
                  <span className="text-white text-xs font-bold uppercase tracking-widest"
                    style={{ fontFamily: "'Rajdhani',sans-serif" }}>Selected Track</span>
                </div>
                {selectedChallenges.length === 0 ? (
                  <p className="pl-4 text-xs text-gray-500" style={{ fontFamily: "'Titillium Web',sans-serif" }}>No challenge selected yet.</p>
                ) : (
                  <div className="flex flex-col gap-2 pl-4">
                    {selectedChallenges.map((challenge) => (
                      <div key={challenge.id} className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ background: challenge.color, boxShadow: `0 0 10px ${challenge.color}` }} />
                        <p className="font-bold uppercase text-white leading-tight" style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: "0.85rem", letterSpacing: "0.03em" }}>
                          {challenge.title}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-bold" style={{ fontFamily: "'Rajdhani',sans-serif", color: "#E10600" }}>2.</span>
                  <span className="text-white text-xs font-bold uppercase tracking-widest"
                    style={{ fontFamily: "'Rajdhani',sans-serif" }}>Submission Status</span>
                </div>
                <p className="text-xs pl-4" style={{ fontFamily: "'Titillium Web',sans-serif", color: submitted ? "#22c55e" : "#888" }}>
                  {submitted ? "Saved to the grid ✓" : "Not submitted yet"}
                </p>
              </div>

              <div className="h-px" style={{ background: "rgba(255,255,255,0.06)" }} />

              {/* 3. Next deadline */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-bold" style={{ fontFamily: "'Rajdhani',sans-serif", color: "#E10600" }}>3.</span>
                  <span className="text-white text-xs font-bold uppercase tracking-widest"
                    style={{ fontFamily: "'Rajdhani',sans-serif" }}>Next Deadline</span>
                </div>
                <p className="text-gray-500 text-xs mb-3 pl-4"
                  style={{ fontFamily: "'Titillium Web',sans-serif", letterSpacing: "0.05em" }}>
                  QUALIFYING SUBMISSION IN
                </p>
                <div className="flex items-end gap-1.5 pl-2">
                  <DigitBox value={pad(days)} label="DAYS" />
                  <span style={{ color: "#E10600", fontFamily: "'Orbitron',monospace", fontSize: "1.1rem", marginBottom: 14 }}>:</span>
                  <DigitBox value={pad(min)} label="MIN" />
                  <span style={{ color: "#E10600", fontFamily: "'Orbitron',monospace", fontSize: "1.1rem", marginBottom: 14 }}>:</span>
                  <DigitBox value={pad(sec)} label="SEC" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
