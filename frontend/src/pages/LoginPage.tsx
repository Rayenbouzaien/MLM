import { useState } from "react";
import { api, ApiError } from "../lib/api";

interface Team {
  id: string;
  teamName: string;
}

export default function LoginPage({ onAuthed }: { onAuthed: (team: Team) => void }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [teamName, setTeamName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const path = mode === "login" ? "/api/auth/login" : "/api/auth/register";
      const res = await api.post<{ team: Team }>(path, { teamName, password });
      onAuthed(res.team);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex-1 flex items-center justify-center p-6" style={{ background: "linear-gradient(160deg,#080810 0%,#10101a 100%)" }}>
      <div
        className="w-full rounded-lg p-8"
        style={{ maxWidth: 420, border: "1.5px solid rgba(0,210,210,0.4)", background: "rgba(0,210,210,0.03)", boxShadow: "0 0 30px rgba(0,210,210,0.1)" }}
      >
        <h1 className="font-headline font-black text-white uppercase text-center mb-1" style={{ fontSize: "1.6rem", letterSpacing: "0.05em" }}>
          {mode === "login" ? "TEAM LOGIN" : "REGISTER TEAM"}
        </h1>
        <p className="text-center text-gray-500 text-xs mb-6" style={{ fontFamily: "'Titillium Web',sans-serif" }}>
          {mode === "login" ? "Sign in to your constructor garage" : "Claim your grid slot"}
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-gray-500 text-xs tracking-widest uppercase" style={{ fontFamily: "'Titillium Web',sans-serif" }}>
              Team Name
            </label>
            <input
              type="text"
              required
              minLength={2}
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              placeholder="Telemetry Titans"
              className="px-3 py-2.5 rounded text-sm text-white outline-none"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.15)", fontFamily: "'Titillium Web',sans-serif" }}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-gray-500 text-xs tracking-widest uppercase" style={{ fontFamily: "'Titillium Web',sans-serif" }}>
              Password
            </label>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              className="px-3 py-2.5 rounded text-sm text-white outline-none"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.15)", fontFamily: "'Titillium Web',sans-serif" }}
            />
          </div>

          {error && (
            <p className="text-xs" style={{ fontFamily: "'Titillium Web',sans-serif", color: "#ef4444" }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded font-black uppercase tracking-widest transition-all hover:scale-[1.02] active:scale-95"
            style={{
              fontFamily: "'Rajdhani',sans-serif",
              fontSize: "0.9rem",
              letterSpacing: "0.15em",
              background: "#E10600",
              color: "#fff",
              border: "none",
              cursor: loading ? "wait" : "pointer",
              opacity: loading ? 0.7 : 1,
              boxShadow: "0 0 20px rgba(225,6,0,0.4)",
            }}
          >
            {loading ? "..." : mode === "login" ? "LOG IN" : "REGISTER"}
          </button>
        </form>

        <button
          onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(null); }}
          className="w-full text-center mt-5 text-xs"
          style={{ fontFamily: "'Titillium Web',sans-serif", color: "#00D2D2", background: "none", border: "none", cursor: "pointer" }}
        >
          {mode === "login" ? "New team? Register here" : "Already registered? Log in"}
        </button>
      </div>
    </div>
  );
}
