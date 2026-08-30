import { useState, useEffect } from "react";
import { api, ApiError } from "../lib/api";

interface Challenge {
  id: string;
  title: string;
  description: string;
  deliverables: string;
  color: string;
  sort_order: number;
}

interface Team {
  id: string;
  team_name: string;
  banned: boolean;
  created_at: string;
  github_url: string | null;
  drive_url: string | null;
  submitted_at: string | null;
}

function AdminLogin({ onLoggedIn }: { onLoggedIn: () => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await api.post("/api/admin/login", { password });
      onLoggedIn();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Login failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex-1 flex items-center justify-center p-6" style={{ background: "linear-gradient(160deg,#080810 0%,#10101a 100%)" }}>
      <form
        onSubmit={handleSubmit}
        className="w-full rounded-lg p-8 flex flex-col gap-4"
        style={{ maxWidth: 380, border: "1.5px solid rgba(225,6,0,0.4)", background: "rgba(225,6,0,0.03)" }}
      >
        <h1 className="font-headline font-black text-white uppercase text-center" style={{ fontSize: "1.4rem", letterSpacing: "0.05em" }}>
          RACE CONTROL
        </h1>
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Admin password"
          className="px-3 py-2.5 rounded text-sm text-white outline-none"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.15)", fontFamily: "'Titillium Web',sans-serif" }}
        />
        {error && <p className="text-xs" style={{ color: "#ef4444", fontFamily: "'Titillium Web',sans-serif" }}>{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="py-3 rounded font-black uppercase tracking-widest"
          style={{ fontFamily: "'Rajdhani',sans-serif", background: "#E10600", color: "#fff", border: "none", cursor: "pointer", letterSpacing: "0.15em" }}
        >
          {loading ? "..." : "ENTER"}
        </button>
      </form>
    </div>
  );
}

function ChallengeForm({ onSaved, editing, onCancel }: { onSaved: () => void; editing: Challenge | null; onCancel: () => void }) {
  const [title, setTitle] = useState(editing?.title ?? "");
  const [description, setDescription] = useState(editing?.description ?? "");
  const [deliverables, setDeliverables] = useState(editing?.deliverables ?? "");
  const [color, setColor] = useState(editing?.color ?? "#E10600");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const body = { title, description, deliverables, color };
      if (editing) {
        await api.patch(`/api/challenges/${editing.id}`, body);
      } else {
        await api.post("/api/challenges", body);
      }
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 p-4 rounded-lg" style={{ border: "1px solid rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.02)" }}>
      <input required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Challenge title"
        className="px-3 py-2 rounded text-sm text-white outline-none" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.15)" }} />
      <textarea required value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description" rows={3}
        className="px-3 py-2 rounded text-sm text-white outline-none resize-none" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.15)" }} />
      <input value={deliverables} onChange={(e) => setDeliverables(e.target.value)} placeholder="Deliverables (optional)"
        className="px-3 py-2 rounded text-sm text-white outline-none" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.15)" }} />
      <div className="flex items-center gap-2">
        <label className="text-xs text-gray-500">Color</label>
        <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="w-8 h-8 rounded cursor-pointer" style={{ background: "transparent", border: "none" }} />
      </div>
      {error && <p className="text-xs" style={{ color: "#ef4444" }}>{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={saving} className="flex-1 py-2 rounded font-bold uppercase text-xs" style={{ background: "#22c55e", color: "#000", border: "none", cursor: "pointer" }}>
          {saving ? "..." : editing ? "Save Changes" : "Add Challenge"}
        </button>
        {editing && (
          <button type="button" onClick={onCancel} className="px-4 py-2 rounded font-bold uppercase text-xs" style={{ background: "transparent", color: "#888", border: "1px solid #444", cursor: "pointer" }}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}

function ChallengesTab() {
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [editing, setEditing] = useState<Challenge | null>(null);
  const [showForm, setShowForm] = useState(false);

  async function load() {
    const res = await api.get<{ challenges: Challenge[] }>("/api/challenges");
    setChallenges(res.challenges);
  }
  useEffect(() => { load(); }, []);

  async function handleDelete(id: string) {
    if (!confirm("Delete this challenge?")) return;
    await api.delete(`/api/challenges/${id}`);
    load();
  }

  return (
    <div className="flex flex-col gap-4">
      {challenges.map((c) => (
        <div key={c.id} className="rounded-lg p-4 flex justify-between items-start gap-4" style={{ border: `1.5px solid ${c.color}`, background: `${c.color}0a` }}>
          <div>
            <h3 className="font-bold text-white" style={{ fontFamily: "'Rajdhani',sans-serif" }}>{c.title}</h3>
            <p className="text-gray-400 text-xs mt-1" style={{ fontFamily: "'Titillium Web',sans-serif" }}>{c.description}</p>
          </div>
          <div className="flex gap-2 shrink-0">
            <button onClick={() => { setEditing(c); setShowForm(true); }} className="px-3 py-1.5 rounded text-xs font-bold uppercase" style={{ background: "transparent", border: "1px solid #00D2D2", color: "#00D2D2", cursor: "pointer" }}>Edit</button>
            <button onClick={() => handleDelete(c.id)} className="px-3 py-1.5 rounded text-xs font-bold uppercase" style={{ background: "transparent", border: "1px solid #ef4444", color: "#ef4444", cursor: "pointer" }}>Delete</button>
          </div>
        </div>
      ))}

      {showForm ? (
        <ChallengeForm
          editing={editing}
          onCancel={() => { setShowForm(false); setEditing(null); }}
          onSaved={() => { setShowForm(false); setEditing(null); load(); }}
        />
      ) : (
        <button onClick={() => setShowForm(true)} className="py-3 rounded font-bold uppercase text-xs" style={{ background: "transparent", border: "1px dashed #666", color: "#888", cursor: "pointer" }}>
          + Add Challenge
        </button>
      )}
    </div>
  );
}

function TeamsTab() {
  const [teams, setTeams] = useState<Team[]>([]);

  async function load() {
    const res = await api.get<{ teams: Team[] }>("/api/admin/teams");
    setTeams(res.teams);
  }
  useEffect(() => { load(); }, []);

  async function toggleBan(team: Team) {
    await api.patch(`/api/admin/teams/${team.id}/ban`, { banned: !team.banned });
    load();
  }

  async function remove(team: Team) {
    if (!confirm(`Remove "${team.team_name}"? This deletes their submission too.`)) return;
    await api.delete(`/api/admin/teams/${team.id}`);
    load();
  }

  return (
    <div className="rounded-lg overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.15)" }}>
      <table className="w-full text-sm" style={{ fontFamily: "'Titillium Web',sans-serif" }}>
        <thead>
          <tr style={{ background: "rgba(255,255,255,0.04)" }}>
            <th className="text-left px-4 py-2 text-gray-400 text-xs uppercase">Team</th>
            <th className="text-left px-4 py-2 text-gray-400 text-xs uppercase">Submission</th>
            <th className="text-left px-4 py-2 text-gray-400 text-xs uppercase">Status</th>
            <th className="text-right px-4 py-2 text-gray-400 text-xs uppercase">Actions</th>
          </tr>
        </thead>
        <tbody>
          {teams.map((t) => (
            <tr key={t.id} style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
              <td className="px-4 py-3 text-white">{t.team_name}</td>
              <td className="px-4 py-3">
                {t.github_url ? (
                  <a href={t.github_url} target="_blank" rel="noreferrer" style={{ color: "#00D2D2" }}>repo ↗</a>
                ) : (
                  <span className="text-gray-600">not yet</span>
                )}
              </td>
              <td className="px-4 py-3">
                <span style={{ color: t.banned ? "#ef4444" : "#22c55e" }}>{t.banned ? "Banned" : "Active"}</span>
              </td>
              <td className="px-4 py-3 text-right">
                <button onClick={() => toggleBan(t)} className="px-3 py-1 rounded text-xs font-bold uppercase mr-2" style={{ background: "transparent", border: `1px solid ${t.banned ? "#22c55e" : "#f59e0b"}`, color: t.banned ? "#22c55e" : "#f59e0b", cursor: "pointer" }}>
                  {t.banned ? "Unban" : "Ban"}
                </button>
                <button onClick={() => remove(t)} className="px-3 py-1 rounded text-xs font-bold uppercase" style={{ background: "transparent", border: "1px solid #ef4444", color: "#ef4444", cursor: "pointer" }}>
                  Remove
                </button>
              </td>
            </tr>
          ))}
          {teams.length === 0 && (
            <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-600">No teams registered yet.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export default function AdminPage() {
  const [authed, setAuthed] = useState(false);
  const [tab, setTab] = useState<"challenges" | "teams">("challenges");

  if (!authed) return <AdminLogin onLoggedIn={() => setAuthed(true)} />;

  return (
    <div className="flex-1 p-6" style={{ background: "linear-gradient(160deg,#080810 0%,#10101a 100%)", maxWidth: 900, margin: "0 auto", width: "100%" }}>
      <h1 className="font-headline font-black text-white uppercase mb-6" style={{ fontSize: "1.6rem", letterSpacing: "0.05em" }}>RACE CONTROL</h1>
      <div className="flex gap-2 mb-6">
        {(["challenges", "teams"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="px-4 py-2 rounded font-bold uppercase text-xs tracking-widest"
            style={{
              background: tab === t ? "#E10600" : "transparent",
              color: tab === t ? "#fff" : "#888",
              border: `1px solid ${tab === t ? "#E10600" : "#444"}`,
              cursor: "pointer",
            }}
          >
            {t}
          </button>
        ))}
      </div>
      {tab === "challenges" ? <ChallengesTab /> : <TeamsTab />}
    </div>
  );
}
