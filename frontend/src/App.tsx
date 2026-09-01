import { useState, useEffect, useRef, type CSSProperties } from "react";
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

const TARGET = new Date("2026-10-10T14:00:00+01:00");
const MLM_LOGO = "/assets/mlm3-official-logo.png";
const IEEE_LOGO = "/assets/ieee-essths-computer-society.png";
const STUDRZ_LOGO = "/assets/studrz.png";
const STARTUP_ASSETS = [
  HERO_IMG,
  MLM_LOGO,
  IEEE_LOGO,
  STUDRZ_LOGO,
  "/assets/gridlock/backgrounds/my-team-pit-lane.png",
];

function preloadImage(source: string, timeoutMs = 7000) {
  return new Promise<void>((resolve) => {
    const image = new Image();
    const finish = () => {
      window.clearTimeout(timeout);
      image.onload = null;
      image.onerror = null;
      resolve();
    };
    const timeout = window.setTimeout(finish, timeoutMs);
    image.onload = finish;
    image.onerror = finish;
    image.src = source;
  });
}

function waitForDocumentReadiness() {
  const documentLoaded = document.readyState === "complete"
    ? Promise.resolve()
    : new Promise<void>((resolve) => window.addEventListener("load", () => resolve(), { once: true }));
  const fontsLoaded = document.fonts?.ready.catch(() => undefined) ?? Promise.resolve();
  return Promise.all([documentLoaded, fontsLoaded]);
}

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
  }, [target]);
  return time;
}

const TRACKS = [
  { code: "ML", title: "Machine Learning foundations & data science", accent: "red" },
  { code: "CNN", title: "Convolutional networks & transfer learning", accent: "cyan" },
  { code: "AI", title: "Overnight AI hackathon & mentoring", accent: "red" },
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
  const [team, setTeam] = useState<{ id: string; teamName: string; memberId: string; memberName: string; isLeader: boolean; memberCount: number; pitPassCode?: string; selectedTrack?: { id: string; title: string; color: string } | null; members?: { id: string; name: string; isLeader: boolean }[] } | null>(null);
  const [account, setAccount] = useState<{ id: string; name: string; teams?: { id: string; teamName: string; memberId: string; memberName: string; isLeader: boolean; memberCount: number; pitPassCode?: string }[] } | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [accessNotice, setAccessNotice] = useState<string | null>(null);
  const [isPageTransitioning, setIsPageTransitioning] = useState(false);
  const [isLaunchVisible, setIsLaunchVisible] = useState(true);
  const [isLaunchLeaving, setIsLaunchLeaving] = useState(false);
  const [launchProgress, setLaunchProgress] = useState(0);
  const [startupResourcesReady, setStartupResourcesReady] = useState(false);
  const transitionTimers = useRef<number[]>([]);
  const launchStartedAt = useRef(performance.now());

  function navigateTo(nextPage: Page) {
    if (nextPage === page) return;

    setMenuOpen(false);
    transitionTimers.current.forEach(window.clearTimeout);
    transitionTimers.current = [];

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setPage(nextPage);
      return;
    }

    setIsPageTransitioning(true);
    transitionTimers.current = [
      window.setTimeout(() => setPage(nextPage), 240),
      window.setTimeout(() => setIsPageTransitioning(false), 680),
    ];
  }

  useEffect(() => () => transitionTimers.current.forEach(window.clearTimeout), []);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setIsLaunchVisible(false);
      return;
    }

    let cancelled = false;
    let readinessTimeout: number | undefined;
    let settledAssets = 0;

    const assetsLoaded = Promise.all(STARTUP_ASSETS.map((asset) => preloadImage(asset).finally(() => {
      settledAssets += 1;
      if (!cancelled) setLaunchProgress(Math.round((settledAssets / STARTUP_ASSETS.length) * 100));
    })));
    const readyOrTimedOut = Promise.race([
      Promise.all([assetsLoaded, waitForDocumentReadiness()]),
      new Promise<void>((resolve) => { readinessTimeout = window.setTimeout(resolve, 8000); }),
    ]);

    void readyOrTimedOut.then(() => {
      if (readinessTimeout) window.clearTimeout(readinessTimeout);
      if (cancelled) return;
      setStartupResourcesReady(true);
    });

    return () => {
      cancelled = true;
      if (readinessTimeout) window.clearTimeout(readinessTimeout);
    };
  }, []);

  useEffect(() => {
    if (!startupResourcesReady || !authChecked || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const remainingIntro = Math.max(0, 900 - (performance.now() - launchStartedAt.current));
    let dismissTimer: number | undefined;
    const exitTimer = window.setTimeout(() => {
      setIsLaunchLeaving(true);
      dismissTimer = window.setTimeout(() => setIsLaunchVisible(false), 460);
    }, remainingIntro);

    return () => {
      window.clearTimeout(exitTimer);
      if (dismissTimer) window.clearTimeout(dismissTimer);
    };
  }, [authChecked, startupResourcesReady]);

  useEffect(() => {
    const syncPageFromUrl = () => setPage(window.location.pathname === "/admin" ? "admin" : "home");
    window.addEventListener("popstate", syncPageFromUrl);
    return () => window.removeEventListener("popstate", syncPageFromUrl);
  }, []);

  useEffect(() => {
    const pathname = page === "admin" ? "/admin" : "/";
    if (window.location.pathname !== pathname) window.history.pushState({}, "", pathname);
    if (page === "admin") setTeam(null);
  }, [page]);

  useEffect(() => {
    Promise.all([
      api.get<{ admin: boolean }> ("/api/admin/me").then(() => true).catch(() => false),
      api.get<{ team: typeof team }>("/api/auth/me").then((res) => res.team).catch(() => null),
      api.get<{ account: { id: string; name: string }; teams: NonNullable<typeof account>["teams"] }>("/api/auth/account/me").then((res) => ({ ...res.account, teams: res.teams })).catch(() => null),
    ])
      .then(([isAdmin, currentTeam, currentAccount]) => {
        if (isAdmin) {
          setTeam(null);
          return;
        }
        setTeam(currentTeam);
        setAccount(currentAccount);
      })
      .catch(() => setTeam(null))
      .finally(() => setAuthChecked(true));
  }, []);

  useEffect(() => {
    if (!team) return;
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
  }, [team]);

  async function handleLogout() {
    await api.post("/api/auth/logout").catch(() => {});
    setTeam(null);
    setPage("home");
  }

  async function handleAccountLogout() {
    await api.post("/api/auth/account/logout").catch(() => {});
    setTeam(null);
    setAccount(null);
    setPage("home");
  }

  return (
    <div className="min-h-screen carbon-bg flex flex-col app-shell">
      {isLaunchVisible && (
        <div className={`mlm-launch-loader${isLaunchLeaving ? " is-leaving" : ""}`} role="status" aria-label="Preparing the grid">
          <div className="mlm-launch-loader__brand">
            <img src={MLM_LOGO} alt="Machine Learning Marathon 3.0" />
            <div className="mlm-launch-loader__rail" aria-hidden="true" style={{ "--launch-progress": launchProgress / 100 } as CSSProperties} />
          </div>
          <p>Loading event systems <span>{launchProgress}%</span></p>
        </div>
      )}
      {/* NAV */}
      <nav
        style={{ background: "rgba(10,10,10,0.97)", borderBottom: "1px solid #1A1A1A" }}
        className="sticky top-0 z-50 flex items-center justify-between px-5 py-2 lg:px-6"
      >
        <button
          onClick={() => navigateTo("home")}
          className="flex h-12 w-52 items-center cursor-pointer border-none bg-transparent p-0 sm:h-14 sm:w-64 lg:h-16 lg:w-72"
        >
          <img src={MLM_LOGO} alt="Machine Learning Marathon 3.0" className="h-full w-full scale-90 object-cover object-[center_62%]" />
        </button>

        {/* Desktop nav */}
        <ul className="hidden md:flex items-center gap-5 lg:gap-8">
          {NAV_ITEMS.map((item) => {
            const active = item.page === page;
            return (
              <li
                key={item.label}
                className="text-center cursor-pointer group"
                onClick={() => item.page && navigateTo(item.page)}
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
        <div className="hidden items-center gap-3 xl:flex">
          <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-500">Co-organized by</span>
          <a href="https://essths.ieee.tn/chapters/cs" target="_blank" rel="noreferrer" aria-label="Visit the IEEE ESSTHS Computer Society website">
            <img src={IEEE_LOGO} alt="IEEE ESSTHS Computer Society Student Branch Chapter" className="h-10 w-20 object-contain" />
          </a>
          <a href="https://www.studrz.com" target="_blank" rel="noreferrer" aria-label="Visit the Studrz website">
            <img src={STUDRZ_LOGO} alt="Studrz" className="h-7 w-16 object-contain" />
          </a>
        </div>

        <div className="hidden md:block">
          {team ? (
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-400" style={{ fontFamily: "'Titillium Web',sans-serif" }}>{team.teamName}</span>
              <button onClick={handleLogout} className="text-xs" style={{ color: "#00D2D2", background: "none", border: "none", cursor: "pointer" }}>
                Team log out
              </button>
              {account && <button onClick={handleAccountLogout} className="text-xs" style={{ color: "#FF2D55", background: "none", border: "none", cursor: "pointer" }}>Account log out</button>}
            </div>
          ) : (
            authChecked && (
              <button onClick={() => setPage("login")} className="px-4 py-2 rounded text-xs font-bold uppercase tracking-widest"
                style={{ background: "transparent", border: "1px solid #00D2D2", color: "#00D2D2", cursor: "pointer" }}>
                {account ? "Join a Team" : "Participant Login"}
              </button>
            )
          )}
        </div>
      </nav>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden bg-[#0A0A0A] border-b border-[#1A1A1A] px-6 py-4 z-40">
          {NAV_ITEMS.map((item) => (
            <div
              key={item.label}
              className="py-2 border-b border-[#1A1A1A] last:border-0 cursor-pointer"
              onClick={() => item.page && navigateTo(item.page)}
            >
              <span className={`font-semibold text-sm ${item.page === page ? "text-[#FF2D55]" : "text-white"}`}>
                {item.label}
              </span>
              <span className="text-xs text-gray-500 ml-2">{item.sub}</span>
            </div>
          ))}
          <div className="py-2 flex items-center justify-between">
            {team ? (
              <>
                <span className="text-xs text-gray-400">{team.teamName}</span>
                <button onClick={() => { handleLogout(); setMenuOpen(false); }} className="text-xs" style={{ color: "#00D2D2", background: "none", border: "none" }}>Team log out</button>
                {account && <button onClick={() => { handleAccountLogout(); setMenuOpen(false); }} className="text-xs" style={{ color: "#FF2D55", background: "none", border: "none" }}>Account log out</button>}
              </>
            ) : (
              <button onClick={() => { setPage("login"); setMenuOpen(false); }} className="text-xs font-semibold" style={{ color: "#00D2D2", background: "none", border: "none" }}>
                {account ? "Join a Team" : "Participant Login"}
              </button>
            )}
          </div>
          <div className="flex items-center justify-center gap-4 pt-4">
            <a href="https://essths.ieee.tn/chapters/cs" target="_blank" rel="noreferrer" aria-label="Visit the IEEE ESSTHS Computer Society website">
              <img src={IEEE_LOGO} alt="IEEE ESSTHS Computer Society Student Branch Chapter" className="h-9 w-20 object-contain" />
            </a>
            <a href="https://www.studrz.com" target="_blank" rel="noreferrer" aria-label="Visit the Studrz website">
              <img src={STUDRZ_LOGO} alt="Studrz" className="h-7 w-16 object-contain" />
            </a>
          </div>
        </div>
      )}

      {/* PAGE CONTENT */}
      {isPageTransitioning && (
        <div className="race-page-transition" aria-hidden="true">
          <img src={MLM_LOGO} alt="" />
        </div>
      )}
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
        <div className="flex-1 flex flex-col lg:flex-row relative overflow-hidden home-shell">
          {/* Left: Hero panel */}
          <div className="relative flex-1 min-h-[520px] lg:min-h-0">
            <img
              src={HERO_IMG}
              alt="Formula 1 race cars speeding at night"
              onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = "/assets/gridlock/backgrounds/my-team-pit-lane.png"; }}
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
                MACHINE LEARNING
                <br />
                MARATHON 3.0
              </h1>

              <p
                className="text-gray-300 mb-8 font-light tracking-wide"
                style={{ fontSize: "clamp(0.95rem, 2vw, 1.15rem)", maxWidth: "480px" }}
              >
                Formula 1: The AI Grand Prix. Two days of AI workshops, an overnight hackathon, and a final podium at ESSTHS Hammam-Sousse.
              </p>

              <button
                onClick={() => setPage("login")}
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
                  10–11 OCTOBER 2026
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
              ON THE GRID
              <br />
              THIS EDITION
            </h2>
            <div className="h-px mb-8 w-full" style={{ background: "linear-gradient(to right, #FF2D55, transparent)" }} />
            <div className="flex flex-col gap-8">
              {TRACKS.map((track, i) => (
                <div key={i} className="flex items-start gap-4 group cursor-pointer">
                  <div className={`track-image-frame track-marker track-marker-${track.accent} shrink-0 opacity-90 group-hover:opacity-100 transition-opacity`} aria-hidden="true">
                    {track.code}
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
        <PaddockPage onOpenGarage={() => setPage(team ? "garage" : "login")} teamName={team?.teamName} />
      )}
      {page === "garage" && (team ? <GaragePage onBack={() => setPage("paddock")} team={team} /> : <LoginPage onAuthed={(t) => { setTeam(t); setPage("garage"); }} />)}
      {page === "challenges" && <ChallengesPage team={team} onLogin={() => setPage("login")} />}
      {page === "rules" && <RulesPrizesPage />}
      {page === "login" && <LoginPage account={account} onAccount={setAccount} onAccountLogout={() => void handleAccountLogout()} onAuthed={(t) => { setTeam(t); setPage("garage"); }} />}
      {page === "admin" && <AdminPage onSessionChange={(active) => { if (active) setTeam(null); }} />}

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

      <footer className="border-t border-white/10 bg-[#0A0A0A] px-6 py-6">
        <div className="mx-auto flex max-w-5xl items-center justify-center">
          <p className="text-center text-xs leading-5 text-gray-400 sm:text-left">Machine Learning Marathon 3.0 · Formula 1: The AI Grand Prix<br />10–11 October 2026 · ESSTHS, Hammam-Sousse</p>
        </div>
      </footer>
    </div>
  );
}
