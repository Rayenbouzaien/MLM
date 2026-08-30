import { useState } from "react";
import { api, ApiError } from "../lib/api";

export interface Team {
  id: string;
  teamName: string;
  description?: string;
  logoUrl?: string | null;
}

export interface Member {
  id: string;
  displayName: string;
  email: string;
  role: "leader" | "member";
}

type Screen = "login" | "leader" | "member";
type LoginKind = "team" | "member";

export default function LoginPage({ onAuthed }: { onAuthed: (result: { team: Team | null; member?: Member }) => void }) {
  const [screen, setScreen] = useState<Screen>("login");
  const [loginKind, setLoginKind] = useState<LoginKind>("team");
  const [teamName, setTeamName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [description, setDescription] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function changeScreen(next: Screen) {
    setScreen(next);
    setError(null);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (screen === "leader") {
        const response = await api.post<{ team: Team; member: Member }>("/api/auth/leader/register", {
          teamName, displayName, email, password, description, logoUrl: logoUrl || undefined,
        });
        onAuthed({ team: response.team, member: response.member });
      } else if (screen === "member") {
        const response = await api.post<{ member: Member }>("/api/auth/member/register", { displayName, email, password });
        onAuthed({ team: null, member: response.member });
      } else if (loginKind === "team") {
        const response = await api.post<{ team: Team }>("/api/auth/login", { teamName, password });
        onAuthed({ team: response.team });
      } else {
        const response = await api.post<{ team: Team | null; member: Member }>("/api/auth/member/login", { email, password });
        onAuthed(response);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const isLogin = screen === "login";
  const isLeader = screen === "leader";
  const title = isLogin ? (loginKind === "team" ? "TEAM LOGIN" : "MEMBER LOGIN") : isLeader ? "CREATE A TEAM" : "CREATE MEMBER ACCOUNT";
  const subtitle = isLeader
    ? "Start a team, shape its profile, then invite registered members."
    : screen === "member"
      ? "Create your account first. Join a team when its leader sends an invitation."
      : "Access your team or personal member account.";

  return (
    <main className="flex-1 flex items-center justify-center p-5 sm:p-8" style={{ background: "linear-gradient(160deg,#080810 0%,#10101a 100%)" }}>
      <section className="w-full rounded-lg p-6 sm:p-8" style={{ maxWidth: 520, border: "1.5px solid rgba(0,210,210,0.4)", background: "rgba(0,210,210,0.03)", boxShadow: "0 0 30px rgba(0,210,210,0.1)" }}>
        <p className="text-center text-xs font-semibold uppercase tracking-[0.22em] text-[#00D2D2]">Gridlock accounts</p>
        <h1 className="mt-2 font-headline font-black text-white uppercase text-center" style={{ fontSize: "1.6rem", letterSpacing: "0.05em" }}>{title}</h1>
        <p className="mx-auto mt-2 max-w-md text-center text-xs leading-5 text-gray-400" style={{ fontFamily: "'Titillium Web',sans-serif" }}>{subtitle}</p>

        {isLogin && (
          <div className="mt-6 grid grid-cols-2 gap-2 rounded p-1" style={{ background: "rgba(255,255,255,0.05)" }}>
            {(["team", "member"] as const).map((kind) => (
              <button key={kind} type="button" onClick={() => { setLoginKind(kind); setError(null); }} className="rounded px-3 py-2 text-xs font-bold uppercase tracking-wider" style={{ background: loginKind === kind ? "#00D2D2" : "transparent", color: loginKind === kind ? "#051111" : "#b7c0ca" }}>
                {kind === "team" ? "Team account" : "Member account"}
              </button>
            ))}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
          {!isLogin && <Field label="Your name"><input required minLength={2} value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Mina Driver" className="form-input" /></Field>}
          {(isLeader || screen === "member" || (isLogin && loginKind === "member")) && <Field label="Email"><input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="mina@example.com" className="form-input" /></Field>}
          {(isLeader || (isLogin && loginKind === "team")) && <Field label="Team name"><input required minLength={2} value={teamName} onChange={(e) => setTeamName(e.target.value)} placeholder="Telemetry Titans" className="form-input" /></Field>}
          {isLeader && <Field label="Team logo URL (optional)"><input type="url" value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="https://example.com/team-logo.png" className="form-input" /></Field>}
          {isLeader && <Field label="Team description (optional)"><textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={1000} rows={3} placeholder="What is your team building?" className="form-input resize-y" /></Field>}
          <Field label="Password"><input required type="password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" className="form-input" /></Field>

          {error && <p className="text-xs text-red-400" role="alert">{error}</p>}
          <button type="submit" disabled={loading} className="w-full rounded py-3 font-black uppercase tracking-widest transition-transform hover:scale-[1.01] disabled:cursor-wait disabled:opacity-70" style={{ fontFamily: "'Rajdhani',sans-serif", background: "#E10600", color: "#fff", border: "none", boxShadow: "0 0 20px rgba(225,6,0,0.35)" }}>
            {loading ? "Working…" : isLeader ? "Create team" : screen === "member" ? "Create member account" : "Log in"}
          </button>
        </form>

        <div className="mt-6 border-t border-white/10 pt-5 text-center text-xs" style={{ fontFamily: "'Titillium Web',sans-serif" }}>
          {isLogin ? <>
            <p className="text-gray-400">New here? Choose how you want to enter the grid.</p>
            <div className="mt-3 flex justify-center gap-4"><button type="button" onClick={() => changeScreen("leader")} className="text-[#00D2D2]">Create a team</button><button type="button" onClick={() => changeScreen("member")} className="text-[#00D2D2]">Create a member account</button></div>
          </> : <button type="button" onClick={() => changeScreen("login")} className="text-[#00D2D2]">Already have an account? Log in</button>}
        </div>
      </section>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="flex flex-col gap-1.5 text-xs uppercase tracking-widest text-gray-500" style={{ fontFamily: "'Titillium Web',sans-serif" }}>{label}{children}</label>;
}
