import { useState } from "react";
import { api, ApiError } from "../lib/api";

interface Account { id: string; name: string; email?: string; handle?: string; techStack?: string[]; licenceLevel?: string; roleType?: string; teams?: Team[] }
interface Team { id: string; teamName: string; memberId: string; memberName: string; isLeader: boolean; memberCount: number; pitPassCode?: string }
type TeamAction = "leader" | "member";

export default function LoginPage({
  onAuthed,
  account: existingAccount,
  onAccount,
  onAccountLogout,
}: { onAuthed: (team: Team) => void; account?: Account | null; onAccount?: (account: Account) => void; onAccountLogout?: () => void }) {
  const [mode, setMode] = useState<"login" | "register">(existingAccount ? "register" : "login");
  const [account, setAccount] = useState<Account | null>(existingAccount ?? null);
  const [action, setAction] = useState<TeamAction>(existingAccount?.teams?.length ? "member" : "leader");
  const [name, setName] = useState(existingAccount?.name ?? "");
  const [email, setEmail] = useState("");
  const [handle, setHandle] = useState("");
  const [password, setPassword] = useState("");
  const [techStack, setTechStack] = useState("");
  const [licenceLevel, setLicenceLevel] = useState("first-time-hackathoner");
  const [teamName, setTeamName] = useState("");
  const [teamPassword, setTeamPassword] = useState("");
  const [pitPassCode, setPitPassCode] = useState("");
  const [memberCount, setMemberCount] = useState(2);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (!account) {
        const result = await api.post<{ account: Account; teams: Team[] }>(
          mode === "register" ? "/api/auth/account/register" : "/api/auth/account/login",
          { name, password, ...(mode === "register" ? { email, handle, techStack: techStack.split(",").map((item) => item.trim()).filter(Boolean), licenceLevel } : {}) },
        );
        const nextAccount = { ...result.account, teams: result.teams };
        setAccount(nextAccount);
        onAccount?.(nextAccount);
        if (mode === "login" && result.teams.length > 0) {
          onAuthed(result.teams[0]);
        }
        return;
      }

      if (action === "member") {
        const result = await api.post<{ team: Team }>("/api/auth/team/join", { pitPassCode, teamPassword });
        onAccount?.({ ...account, teams: [...(account.teams ?? []), result.team], roleType: "MEMBER" });
        onAuthed(result.team);
        return;
      }

      const result = await api.post<{ team: Team }>("/api/auth/team/create", { teamName, teamPassword, memberCount });
      onAccount?.({ ...account, teams: [...(account.teams ?? []), result.team], roleType: "LEADER" });
      onAuthed(result.team);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function switchMode() {
    setMode(mode === "login" ? "register" : "login");
    setAccount(null);
    setError(null);
  }

  const canCreateTeam = !account?.teams?.length;
  const title = !account ? (mode === "login" ? "PIT LANE ACCESS" : "DRIVER REGISTRATION") : "PADDOCK SETUP";
  const subtitle = !account ? (mode === "login" ? "Sign in with your driver handle, email, or name" : "Create your driver account first") : `Signed in as ${account.name}`;

  return (
    <div className="flex-1 flex items-center justify-center p-6 page-shell page-login" style={{ background: "linear-gradient(160deg,#080810 0%,#10101a 100%)" }}>
      <div className="w-full rounded-lg p-8" style={{ maxWidth: 480, border: "1.5px solid rgba(0,210,210,0.4)", background: "rgba(0,210,210,0.03)", boxShadow: "0 0 30px rgba(0,210,210,0.1)" }}>
        <h1 className="font-headline font-black text-white uppercase text-center mb-1" style={{ fontSize: "1.6rem", letterSpacing: "0.05em" }}>{title}</h1>
        <p className="text-center text-gray-500 text-xs mb-6" style={{ fontFamily: "'Titillium Web',sans-serif" }}>{subtitle}</p>

        <form onSubmit={submit} className="flex flex-col gap-4">
          {!account ? <>
            <label className="text-gray-500 text-xs tracking-widest uppercase">Full Name
              <input required minLength={2} value={name} onChange={(event) => setName(event.target.value)} placeholder="Alex R." className="mt-1 w-full px-3 py-2.5 rounded text-sm text-white outline-none" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.15)" }} />
            </label>
            {mode === "register" && <>
              <label className="text-gray-500 text-xs tracking-widest uppercase">Email
                <input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="driver@example.com" className="mt-1 w-full px-3 py-2.5 rounded text-sm text-white outline-none" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.15)" }} />
              </label>
              <label className="text-gray-500 text-xs tracking-widest uppercase">Driver Handle
                <input required value={handle} onChange={(event) => setHandle(event.target.value)} placeholder="@TelemetryPro" className="mt-1 w-full px-3 py-2.5 rounded text-sm text-white outline-none" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.15)" }} />
              </label>
              <label className="text-gray-500 text-xs tracking-widest uppercase">Technical Specialties
                <input value={techStack} onChange={(event) => setTechStack(event.target.value)} placeholder="ML Engineer, Frontend" className="mt-1 w-full px-3 py-2.5 rounded text-sm text-white outline-none" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.15)" }} />
              </label>
              <label className="text-gray-500 text-xs tracking-widest uppercase">Driver Super Licence
                <select value={licenceLevel} onChange={(event) => setLicenceLevel(event.target.value)} className="mt-1 w-full px-3 py-2.5 rounded text-sm text-white outline-none" style={{ background: "#111118", border: "1px solid rgba(255,255,255,0.15)" }}><option value="student">Student</option><option value="professional">Professional</option><option value="first-time-hackathoner">First-Time Hackathoner</option></select>
              </label>
            </>}
            <label className="text-gray-500 text-xs tracking-widest uppercase">Password
              <input type="password" required minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 8 characters" className="mt-1 w-full px-3 py-2.5 rounded text-sm text-white outline-none" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.15)" }} />
            </label>
          </> : <>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {(["leader", "member"] as const).filter((option) => option !== "leader" || canCreateTeam).map((option) => <button key={option} type="button" onClick={() => setAction(option)} className="rounded py-3 text-[10px] font-bold uppercase tracking-[0.12em]" style={{ background: action === option ? "#00D2D2" : "transparent", color: action === option ? "#05070a" : "#cbd5e1", border: "1px solid rgba(255,255,255,0.15)" }}>{option === "leader" ? "Found Team" : "Join Garage"}</button>)}
            </div>
            {action === "leader" && <>
              <label className="text-gray-500 text-xs tracking-widest uppercase">Team Name
                <input required value={teamName} onChange={(event) => setTeamName(event.target.value)} placeholder="Telemetry Titans" className="mt-1 w-full px-3 py-2.5 rounded text-sm text-white outline-none" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.15)" }} />
              </label>
              <label className="text-gray-500 text-xs tracking-widest uppercase">Team Password
                <input type="password" required minLength={8} value={teamPassword} onChange={(event) => setTeamPassword(event.target.value)} placeholder="Create team password" className="mt-1 w-full px-3 py-2.5 rounded text-sm text-white outline-none" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.15)" }} />
              </label>
              <label className="text-gray-500 text-xs tracking-widest uppercase">Total Members Including You
                <input type="number" min={1} max={5} required value={memberCount} onChange={(event) => setMemberCount(Math.min(5, Math.max(1, Number(event.target.value) || 1)))} className="mt-1 w-full px-3 py-2.5 rounded text-sm text-white outline-none" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.15)" }} />
              </label>
            </>}
            {action === "member" && <>
              <label className="text-gray-500 text-xs tracking-widest uppercase">Pit Pass Code
                <input required value={pitPassCode} onChange={(event) => setPitPassCode(event.target.value.toUpperCase())} placeholder="TITAN-8921" className="mt-1 w-full px-3 py-2.5 rounded text-sm text-white outline-none" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.15)" }} />
              </label>
              <label className="text-gray-500 text-xs tracking-widest uppercase">Team Password
                <input type="password" required minLength={8} value={teamPassword} onChange={(event) => setTeamPassword(event.target.value)} placeholder="Team password" className="mt-1 w-full px-3 py-2.5 rounded text-sm text-white outline-none" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.15)" }} />
              </label>
            </>}
          </>}
          {error && <p role="alert" className="text-xs text-red-400">{error}</p>}
          <button type="submit" disabled={loading} className="w-full py-3 rounded font-black uppercase tracking-widest" style={{ background: "#E10600", color: "#fff", border: "none", cursor: loading ? "wait" : "pointer", opacity: loading ? 0.7 : 1 }}>{loading ? "..." : !account ? (mode === "register" ? "CREATE ACCOUNT" : "LOG IN") : action === "leader" ? "CREATE TEAM" : "JOIN TEAM"}</button>
        </form>
        {!existingAccount && !account && <button onClick={switchMode} className="w-full text-center mt-5 text-xs" style={{ color: "#00D2D2", background: "none", border: "none", cursor: "pointer" }}>{mode === "login" ? "New here? Create an account" : "Already have an account? Log in"}</button>}
        {account && <button type="button" onClick={onAccountLogout} className="w-full text-center mt-5 text-xs" style={{ color: "#FF2D55", background: "none", border: "none", cursor: "pointer" }}>Log out of account</button>}
      </div>
    </div>
  );
}
