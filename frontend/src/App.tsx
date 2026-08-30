import { useState, useEffect } from "react";
import CircuitPage from "./pages/CircuitPage";
import PaddockPage from "./pages/PaddockPage";
import GaragePage from "./pages/GaragePage";
import ChallengesPage from "./pages/ChallengesPage";
import LoginPage from "./pages/LoginPage";
import AdminPage from "./pages/AdminPage";
import RulesPrizesPage from "./pages/RulesPrizesPage";
import { API_BASE, api } from "./lib/api";

const HERO_IMG =
  "https://images.unsplash.com/photo-1784565646478-584a622b0933?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwzfHxGb3JtdWxhJTIwMSUyMHJhY2UlMjBjYXJzJTIwc3BlZWQlMjB0cmFjayUyMG5pZ2h0fGVufDF8fHx8MTc4Nzc1MjAzM3ww&ixlib=rb-4.1.0&q=80&w=1080";

const TARGET = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000 + 14 * 60 * 60 * 1000 + 55 * 60 * 1000 + 21 * 1000);

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function useCountdown(target: Date) {
  const calc = () => {
    const diff = Math.max(0, target.getTime() - Date.now());
    return {
      days: Math.floor(diff / 86400000),
      hrs: Math.floor((diff % 86400000) / 3600000),
      min: Math.floor((diff % 3600000) / 60000),
      sec: Math.floor((diff % 60000) / 1000),
    };
  };
  const [time, setTime] = useState(calc);
  useEffect(() => {
    const id = setInterval(() => setTime(calc()), 1000);
    return () => clearInterval(id);
  });
  return time;
}

function SpeedometerIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
      <circle cx="20" cy="22" r="15" stroke="#FF2D55" strokeWidth="1.5" fill="none" />
      <path d="M8 30 A14 14 0 0 1 32 30" stroke="#FF2D55" strokeWidth="1.5" fill="none" />
      <line x1="20" y1="22" x2="28" y2="14" stroke="#FF2D55" strokeWidth="2" strokeLinecap="round" />
      <circle cx="20" cy="22" r="2" fill="#FF2D55" />
      <line x1="10" y1="30" x2="12" y2="30" stroke="#FF2D55" strokeWidth="1.5" />
      <line x1="30" y1="30" x2="28" y2="30" stroke="#FF2D55" strokeWidth="1.5" />
      <line x1="20" y1="10" x2="20" y2="12" stroke="#FF2D55" strokeWidth="1.5" />
    </svg>
  );
}
function FanIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
      <circle cx="20" cy="14" r="5" stroke="#FF2D55" strokeWidth="1.5" fill="none" />
      <path d="M10 34 C10 26 30 26 30 34" stroke="#FF2D55" strokeWidth="1.5" fill="none" />
      <circle cx="30" cy="12" r="3" stroke="#FF2D55" strokeWidth="1.2" fill="none" />
      <path d="M33 10 L37 7" stroke="#FF2D55" strokeWidth="1.2" />
      <path d="M34 13 L38 13" stroke="#FF2D55" strokeWidth="1.2" />
      <path d="M32 16 L35 19" stroke="#FF2D55" strokeWidth="1.2" />
    </svg>
  );
}
function LeafCarIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
      <path d="M6 24 L10 16 L28 16 L34 24 Z" stroke="#FF2D55" strokeWidth="1.5" fill="none" />
      <circle cx="12" cy="26" r="3" stroke="#FF2D55" strokeWidth="1.5" fill="none" />
      <circle cx="28" cy="26" r="3" stroke="#FF2D55" strokeWidth="1.5" fill="none" />
      <path d="M28 10 C28 10 32 6 36 8 C34 12 30 12 28 10Z" stroke="#FF2D55" strokeWidth="1.2" fill="none" />
      <line x1="30" y1="10" x2="29" y2="16" stroke="#FF2D55" strokeWidth="1.2" />
    </svg>
  );
}

const TRACKS = [
  { icon: <SpeedometerIcon />, title: "AI-POWERED TELEMETRY ANALYTICS" },
  { icon: <FanIcon />, title: "SMART FAN ENGAGEMENT PLATFORMS" },
  { icon: <LeafCarIcon />, title: "SUSTAINABLE RACE LOGISTICS" },
];

type Page = "home" | "circuit" | "paddock" | "garage" | "challenges" | "login" | "admin" | "rules";

const NAV_ITEMS: { label: string; sub: string; page: Page | null }[] = [
  { label: "Lights Out", sub: "Home", page: "home" },
  { label: "Circuit", sub: "Schedule", page: "circuit" },
  { label: "The Paddock", sub: "Teams", page: "paddock" },
  { label: "Rules", sub: "Regulations", page: "rules" },
  { label: "Challenges", sub: "Defies", page: "challenges" },
];

export default function App() {
  const { days, hrs, min, sec } = useCountdown(TARGET);
  const [menuOpen, setMenuOpen] = useState(false);
  const [page, setPage] = useState<Page>(() => window.location.pathname === "/admin" ? "admin" : "home");
  const [team, setTeam] = useState<{ id: string; teamName: string } | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [accessNotice, setAccessNotice] = useState<string | null>(null);

  useEffect(() => {
    const syncPageFromUrl = () => setPage(window.location.pathname === "/admin" ? "admin" : "home");
    window.addEventListener("popstate", syncPageFromUrl);
    return () => window.removeEventListener("popstate", syncPageFromUrl);
  }, []);

  useEffect(() => {
    const pathname = page === "admin" ? "/admin" : "/";
    if (window.location.pathname !== pathname) window.history.pushState({}, "", pathname);
  }, [page]);

  useEffect(() => {
    api
      .get<{ team: { id: string; teamName: string } }>("/api/auth/me")
      .then((res) => setTeam(res.team))
      .catch(() => setTeam(null))
      .finally(() => setAuthChecked(true));
  }, []);

  useEffect(() => {
    if (!team || page === "admin") return;
    const source = new EventSource(`${API_BASE}/api/live`);
    source.onmessage = (message) => {
      try {
        const event = JSON.parse(message.data) as { type?: string; teamId?: string };
        if (event.type === "team_access_revoked" && event.teamId === team.id) {
          source.close();
          void api.post("/api/auth/logout").catch(() => {});
          setTeam(null);
          setPage("home");
          setAccessNotice("Your team account is no longer active. You have been signed out. Contact an organizer if you need help.");
        }
      } catch {
        // Keep-alive comments are intentionally ignored.
      }
    };
    return () => source.close();
  }, [team, page]);

  async function handleLogout() {
    await api.post("/api/auth/logout").catch(() => {});
    setTeam(null);
    setPage("home");
  }

  return (
    <div className="min-h-screen carbon-bg flex flex-col">
      {/* NAV */}
      <nav
        style={{ background: "rgba(10,10,10,0.97)", borderBottom: "1px solid #1A1A1A" }}
        className="sticky top-0 z-50 px-6 py-3 flex items-center justify-between"
      >
        <button
          onClick={() => setPage("home")}
          className="flex items-center gap-3 cursor-pointer bg-transparent border-none p-0"
        >
          <div>
            <div className="font-headline font-black text-white text-xl leading-none tracking-wider">
              GRIDLOCK
            </div>
            <div className="text-xs text-gray-400 font-light tracking-widest mt-0.5">
              Formula 1 Hackathon
            </div>
          </div>
        </button>

        {/* Desktop nav */}
        <ul className="hidden md:flex items-center gap-8">
          {NAV_ITEMS.map((item) => {
            const active = item.page === page;
            return (
              <li
                key={item.label}
                className="text-center cursor-pointer group"
                onClick={() => item.page && setPage(item.page)}
              >
                <div
                  className={`font-semibold text-sm tracking-wide ${active ? "text-white" : "text-gray-300 group-hover:text-white"} transition-colors`}
                >
                  {item.label}
                </div>
                <div
                  className={`text-xs mt-0.5 ${active ? "text-[#FF2D55]" : "text-gray-500 group-hover:text-gray-300"} transition-colors`}
                >
                  {item.sub}
                </div>
                {active && (
                  <div
                    className="h-0.5 mt-1 rounded-full"
                    style={{ background: "#FF2D55", boxShadow: "0 0 6px #FF2D55" }}
                  />
                )}
              </li>
            );
          })}
        </ul>

        {/* Mobile hamburger */}
        <button
          className="md:hidden text-white p-2"
          onClick={() => setMenuOpen(!menuOpen)}
        >
          <div className="w-5 h-0.5 bg-white mb-1" />
          <div className="w-5 h-0.5 bg-white mb-1" />
          <div className="w-5 h-0.5 bg-white" />
        </button>

        {/* Desktop team session control */}
        {page !== "admin" && <div className="hidden md:block">
          {team ? (
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-400" style={{ fontFamily: "'Titillium Web',sans-serif" }}>{team.teamName}</span>
              <button onClick={handleLogout} className="text-xs" style={{ color: "#00D2D2", background: "none", border: "none", cursor: "pointer" }}>
                Log out
              </button>
            </div>
          ) : (
            authChecked && (
              <button onClick={() => setPage("login")} className="px-4 py-2 rounded text-xs font-bold uppercase tracking-widest"
                style={{ background: "transparent", border: "1px solid #00D2D2", color: "#00D2D2", cursor: "pointer" }}>
                Team Login
              </button>
            )
          )}
        </div>}
      </nav>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden bg-[#0A0A0A] border-b border-[#1A1A1A] px-6 py-4 z-40">
          {NAV_ITEMS.map((item) => (
            <div
              key={item.label}
              className="py-2 border-b border-[#1A1A1A] last:border-0 cursor-pointer"
              onClick={() => { item.page && setPage(item.page); setMenuOpen(false); }}
            >
              <span className={`font-semibold text-sm ${item.page === page ? "text-[#FF2D55]" : "text-white"}`}>
                {item.label}
              </span>
              <span className="text-xs text-gray-500 ml-2">{item.sub}</span>
            </div>
          ))}
          {page !== "admin" && <div className="py-2 flex items-center justify-between">
            {team ? (
              <>
                <span className="text-xs text-gray-400">{team.teamName}</span>
                <button onClick={() => { handleLogout(); setMenuOpen(false); }} className="text-xs" style={{ color: "#00D2D2", background: "none", border: "none" }}>Log out</button>
              </>
            ) : (
              <button onClick={() => { setPage("login"); setMenuOpen(false); }} className="text-xs font-semibold" style={{ color: "#00D2D2", background: "none", border: "none" }}>
                Team Login
              </button>
            )}
          </div>}
        </div>
      )}

      {/* PAGE CONTENT */}
      {accessNotice && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-5" role="alertdialog" aria-modal="true" aria-labelledby="account-status-title">
          <div className="w-full max-w-md border border-[#E10600] bg-[#111118] p-6 shadow-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#E10600]">Account status</p>
            <h2 id="account-status-title" className="mt-3 font-headline text-2xl font-black uppercase text-white">Session ended</h2>
            <p className="mt-3 text-sm leading-6 text-gray-300">{accessNotice}</p>
            <button onClick={() => setAccessNotice(null)} className="mt-6 w-full bg-[#E10600] px-4 py-3 text-xs font-bold uppercase tracking-[0.15em] text-white">Close</button>
          </div>
        </div>
      )}
      {page === "home" && (
        <div className="flex-1 flex flex-col lg:flex-row relative overflow-hidden">
          {/* Left: Hero panel */}
          <div className="relative flex-1 min-h-[520px] lg:min-h-0">
            <img
              src={HERO_IMG}
              alt="Formula 1 race cars speeding at night"
              className="absolute inset-0 w-full h-full object-cover"
            />
            <div
              className="absolute inset-0"
              style={{
                background:
                  "linear-gradient(to right, rgba(10,10,10,0.85) 0%, rgba(10,10,10,0.55) 60%, rgba(10,10,10,0.2) 100%)",
              }}
            />
            <div
              className="absolute top-0 left-0 w-1 h-full"
              style={{ background: "linear-gradient(to bottom, transparent, #FF2D55 40%, transparent)" }}
            />
            <div
              className="absolute bottom-0 left-0 right-0 h-px"
              style={{ background: "linear-gradient(to right, #FF2D55, transparent)" }}
            />
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                border: "1px solid rgba(255,45,85,0.25)",
                clipPath: "polygon(2% 3%, 94% 3%, 94% 97%, 2% 97%)",
              }}
            />

            <div className="relative z-10 flex flex-col justify-center h-full px-8 lg:px-14 py-16">
              <h1
                className="font-headline font-black text-white leading-none mb-4"
                style={{
                  fontSize: "clamp(2rem, 5vw, 3.5rem)",
                  textTransform: "uppercase",
                  textShadow: "0 2px 20px rgba(0,0,0,0.8)",
                  maxWidth: "620px",
                }}
              >
                THE RACE FOR INNOVATION
                <br />
                STARTS HERE.
              </h1>

              <p
                className="text-gray-300 mb-8 font-light tracking-wide"
                style={{ fontSize: "clamp(0.95rem, 2vw, 1.15rem)", maxWidth: "480px" }}
              >
                24 Hours to Prototype. Max Speed. Zero Friction.
              </p>

              <button
                className="font-headline font-bold tracking-widest text-white uppercase py-4 px-10 rounded cursor-pointer transition-all hover:scale-105 active:scale-95 w-fit"
                style={{
                  background: "#FF2D55",
                  fontSize: "0.85rem",
                  letterSpacing: "0.15em",
                  boxShadow: "0 0 24px rgba(255,45,85,0.5), inset 0 1px 0 rgba(255,255,255,0.1)",
                  border: "none",
                }}
              >
                REGISTER YOUR TEAM
              </button>

              <div className="mt-10">
                <div className="font-headline text-xs tracking-[0.4em] text-gray-400 mb-4 uppercase flex items-center gap-3">
                  <div className="h-px flex-1 max-w-12" style={{ background: "#333" }} />
                  LIGHTS OUT
                  <div className="h-px flex-1 max-w-12" style={{ background: "#333" }} />
                </div>
                <div className="flex items-end gap-3">
                  {[
                    { value: pad(days), label: "DAYS" },
                    { value: pad(hrs), label: "HRS" },
                    { value: pad(min), label: "MIN" },
                    { value: pad(sec), label: "SEC" },
                  ].map((item, i) => (
                    <div key={item.label} className="flex items-end gap-1">
                      {i > 0 && (
                        <span
                          className="colon-blink font-headline font-bold mb-5"
                          style={{ color: "#FF2D55", fontSize: "1.5rem" }}
                        >
                          :
                        </span>
                      )}
                      <div className="flex flex-col items-center gap-1">
                        <div
                          className="countdown-digit"
                          style={{ width: "clamp(52px, 8vw, 70px)", height: "clamp(52px, 8vw, 70px)", fontSize: "clamp(1.4rem, 3vw, 2rem)" }}
                        >
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

          {/* Right: Featured Tracks sidebar */}
          <div
            className="lg:w-72 xl:w-80 flex flex-col justify-center px-8 py-10 lg:py-0"
            style={{ background: "rgba(10,10,10,0.95)", borderLeft: "1px solid #1A1A1A" }}
          >
            <h2 className="font-headline font-bold text-white uppercase mb-8 tracking-wider" style={{ fontSize: "1rem" }}>
              FEATURED
              <br />
              TRACKS
            </h2>
            <div className="h-px mb-8 w-full" style={{ background: "linear-gradient(to right, #FF2D55, transparent)" }} />
            <div className="flex flex-col gap-8">
              {TRACKS.map((track, i) => (
                <div key={i} className="flex items-start gap-4 group cursor-pointer">
                  <div className="shrink-0 opacity-80 group-hover:opacity-100 transition-opacity">
                    {track.icon}
                  </div>
                  <p
                    className="font-headline font-bold text-white leading-tight group-hover:text-[#FF2D55] transition-colors"
                    style={{ fontSize: "0.75rem", letterSpacing: "0.05em" }}
                  >
                    {track.title}
                  </p>
                </div>
              ))}
            </div>
            <div className="h-px mt-8 w-full" style={{ background: "linear-gradient(to right, #FF2D55, transparent)" }} />
          </div>
        </div>
      )}

      {page === "circuit" && <CircuitPage />}
      {page === "paddock" && (
        <PaddockPage onOpenGarage={() => setPage(team ? "garage" : "login")} />
      )}
      {page === "garage" && (team ? <GaragePage onBack={() => setPage("paddock")} team={team} /> : <LoginPage onAuthed={(t) => { setTeam(t); setPage("garage"); }} />)}
      {page === "challenges" && <ChallengesPage team={team} onLogin={() => setPage("login")} />}
      {page === "rules" && <RulesPrizesPage />}
      {page === "login" && <LoginPage onAuthed={(t) => { setTeam(t); setPage("garage"); }} />}
      {page === "admin" && <AdminPage />}

      {/* Bottom teaser — home only */}
      {page === "home" && (
        <div className="py-6 px-8 lg:px-14" style={{ background: "#0A0A0A", borderTop: "1px solid #1A1A1A" }}>
          <h2
            className="font-headline font-black text-white uppercase tracking-widest"
            style={{ fontSize: "clamp(1.5rem, 4vw, 2.5rem)", opacity: 0.15 }}
          >
            FEATURED
          </h2>
        </div>
      )}

      <footer className="py-3 px-8 text-center text-xs text-gray-700" style={{ background: "#0A0A0A", borderTop: "1px solid #1A1A1A" }}>GRIDLOCK / Formula 1 Hackathon</footer>
    </div>
  );
}
