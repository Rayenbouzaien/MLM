import { useEffect, useState, type CSSProperties, type FormEvent } from "react";
import { api, ApiError } from "../lib/api";
import ScalabilityTab from "./ScalabilityTab";
import { CHALLENGE_ART_OPTIONS, getChallengeArtKey, getChallengeArtSource, type ChallengeArtKey } from "../lib/challenge-art";

interface SelectedTeam { id: string; teamName: string; }
interface Challenge {
  id: string;
  title: string;
  description: string;
  deliverables: string;
  color: string;
  image_key?: string | null;
  sort_order: number;
  selected_teams: SelectedTeam[];
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

function ChallengeImage({ challenge }: { challenge: Challenge }) {
  const primarySource = getChallengeArtSource(challenge.image_key, challenge.sort_order);
  const fallbackSource = getChallengeArtSource("innovation");
  const [source, setSource] = useState(primarySource);
  const [failed, setFailed] = useState(false);
  useEffect(() => { setSource(primarySource); setFailed(false); }, [primarySource]);
  if (failed) return <span className="admin-challenge-image__fallback">Image unavailable</span>;
  return <img src={source} alt="" loading="lazy" onError={() => source === fallbackSource ? setFailed(true) : setSource(fallbackSource)} />;
}

function AdminLogin({ onLoggedIn }: { onLoggedIn: () => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!password.trim()) return setError("Enter the admin password.");
    setLoading(true);
    setError(null);
    try { await api.post("/api/admin/login", { password }); onLoggedIn(); }
    catch (err) { setError(err instanceof ApiError ? err.message : "Access could not be verified."); }
    finally { setLoading(false); }
  }

  return <main className="admin-access page-shell page-admin-login"><form className="admin-access__card" onSubmit={handleSubmit}>
    <p>Restricted system</p><h1>Race control</h1><span>Administrator access is required to manage the grid.</span>
    <label>Access password<input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} /></label>
    {error && <p className="admin-alert" role="alert">{error}</p>}
    <button type="submit" disabled={loading}>{loading ? "Verifying…" : "Enter race control →"}</button>
  </form></main>;
}

function ChallengeForm({ editing, onSaved, onCancel }: { editing: Challenge | null; onSaved: () => void; onCancel: () => void }) {
  const [title, setTitle] = useState(editing?.title ?? "");
  const [description, setDescription] = useState(editing?.description ?? "");
  const [deliverables, setDeliverables] = useState(editing?.deliverables ?? "");
  const [color, setColor] = useState(editing?.color ?? "#E10600");
  const [imageKey, setImageKey] = useState<ChallengeArtKey>(() => getChallengeArtKey(editing?.image_key, editing?.sort_order));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault(); setSaving(true); setError(null);
    try {
      const body = { title, description, deliverables, color, imageKey };
      if (editing) await api.patch(`/api/challenges/${editing.id}`, body);
      else await api.post("/api/challenges", body);
      onSaved();
    } catch (err) { setError(err instanceof ApiError ? err.message : "The challenge could not be saved."); }
    finally { setSaving(false); }
  }

  return <form onSubmit={submit} className="admin-form">
    <div><p>Challenge editor</p><h3>{editing ? "Update race brief" : "Publish race brief"}</h3></div>
    <label>Challenge title<input required value={title} onChange={(event) => setTitle(event.target.value)} /></label>
    <label>Race brief<textarea required rows={4} value={description} onChange={(event) => setDescription(event.target.value)} /></label>
    <label>Deliverables<input value={deliverables} onChange={(event) => setDeliverables(event.target.value)} /></label>
    <label className="admin-form__color">Challenge accent<input type="color" value={color} onChange={(event) => setColor(event.target.value)} /></label>
    <fieldset className="admin-art-picker"><legend>Challenge image</legend><p>Select the visual shown on the public Challenge Board.</p><div>{CHALLENGE_ART_OPTIONS.map((option) => <label className={imageKey === option.key ? "is-selected" : ""} key={option.key}><input type="radio" name="challenge-art" value={option.key} checked={imageKey === option.key} onChange={() => setImageKey(option.key)} /><img src={option.source} alt="" /><span>{option.label}</span></label>)}</div></fieldset>
    {error && <p className="admin-alert" role="alert">{error}</p>}
    <div className="admin-form__actions"><button type="submit" disabled={saving}>{saving ? "Saving…" : editing ? "Save brief" : "Publish challenge"}</button><button type="button" onClick={onCancel}>Cancel</button></div>
  </form>;
}

function ChallengesTab() {
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [editing, setEditing] = useState<Challenge | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true); setError(null);
    try { const response = await api.get<{ challenges: Challenge[] }>("/api/admin/challenges"); setChallenges(response.challenges); }
    catch (err) { setError(err instanceof ApiError ? err.message : "Challenge data is unavailable."); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);
  async function remove(challenge: Challenge) {
    if (!window.confirm(`Remove “${challenge.title}”?`)) return;
    try { await api.delete(`/api/challenges/${challenge.id}`); void load(); }
    catch (err) { setError(err instanceof ApiError ? err.message : "The challenge could not be removed."); }
  }

  return <section className="admin-panel" aria-labelledby="admin-challenges-title">
    <header className="admin-panel__head"><div><p>Programme desk</p><h2 id="admin-challenges-title">Challenge board</h2></div><button onClick={() => { setEditing(null); setShowForm(true); }}>Publish challenge →</button></header>
    {error && <p className="admin-alert" role="alert">{error}</p>}
    {showForm && <ChallengeForm editing={editing} onCancel={() => { setEditing(null); setShowForm(false); }} onSaved={() => { setEditing(null); setShowForm(false); void load(); }} />}
    {loading ? <div className="admin-skeleton" aria-busy="true"><i /><i /><i /></div> : challenges.length === 0 ? <div className="admin-empty"><h3>No challenges published</h3><p>Publish a race brief to open it to constructors.</p></div> : <div className="admin-challenge-list">{challenges.map((challenge, index) => <article className="admin-challenge" key={challenge.id} style={{ "--admin-accent": challenge.color } as CSSProperties}>
      <div className="admin-challenge-image"><ChallengeImage challenge={challenge} /></div>
      <div className="admin-challenge__brief"><p>Race {String(challenge.sort_order || index + 1).padStart(2, "0")} · Published by Race Control</p><h3>{challenge.title}</h3><span>{challenge.description}</span></div>
      <div className="admin-challenge__entries"><p>Entered teams · {challenge.selected_teams.length}</p>{challenge.selected_teams.length ? <ul>{challenge.selected_teams.map((team) => <li key={team.id}>{team.teamName}</li>)}</ul> : <span>No constructor entries yet.</span>}</div>
      <div className="admin-challenge__actions"><button onClick={() => { setEditing(challenge); setShowForm(true); }}>Edit</button><button onClick={() => void remove(challenge)}>Remove</button></div>
    </article>)}</div>}
  </section>;
}

function TeamForm({ onSaved, onCancel }: { onSaved: () => void; onCancel: () => void }) {
  const [teamName, setTeamName] = useState(""); const [password, setPassword] = useState(""); const [error, setError] = useState<string | null>(null); const [saving, setSaving] = useState(false);
  async function submit(event: FormEvent) { event.preventDefault(); setSaving(true); setError(null); try { await api.post("/api/admin/teams", { teamName, password }); onSaved(); } catch (err) { setError(err instanceof ApiError ? err.message : "The team could not be created."); } finally { setSaving(false); } }
  return <form className="admin-form" onSubmit={submit}><div><p>Constructor desk</p><h3>Add constructor</h3></div><label>Team name<input required value={teamName} onChange={(event) => setTeamName(event.target.value)} /></label><label>Temporary team password<input required minLength={8} type="password" value={password} onChange={(event) => setPassword(event.target.value)} /></label>{error && <p className="admin-alert" role="alert">{error}</p>}<div className="admin-form__actions"><button type="submit" disabled={saving}>{saving ? "Creating…" : "Create team"}</button><button type="button" onClick={onCancel}>Cancel</button></div></form>;
}

function TeamsTab() {
  const [teams, setTeams] = useState<Team[]>([]); const [showForm, setShowForm] = useState(false); const [error, setError] = useState<string | null>(null); const [loading, setLoading] = useState(true);
  async function load() { setLoading(true); setError(null); try { const response = await api.get<{ teams: Team[] }>("/api/admin/teams"); setTeams(response.teams); } catch (err) { setError(err instanceof ApiError ? err.message : "Team data is unavailable."); } finally { setLoading(false); } }
  useEffect(() => { void load(); }, []);
  async function toggleBan(team: Team) { try { await api.patch(`/api/admin/teams/${team.id}/ban`, { banned: !team.banned }); void load(); } catch (err) { setError(err instanceof ApiError ? err.message : "The team status could not be updated."); } }
  async function remove(team: Team) { if (!window.confirm(`Remove “${team.team_name}” and its submission?`)) return; try { await api.delete(`/api/admin/teams/${team.id}`); void load(); } catch (err) { setError(err instanceof ApiError ? err.message : "The team could not be removed."); } }
  const submitted = teams.filter((team) => team.submitted_at).length;
  return <section className="admin-panel" aria-labelledby="admin-teams-title"><header className="admin-panel__head"><div><p>Grid operations</p><h2 id="admin-teams-title">Constructor directory</h2></div><button onClick={() => setShowForm(true)}>Add constructor →</button></header><dl className="admin-team-stats"><div><dt>Constructors</dt><dd>{String(teams.length).padStart(2, "0")}</dd></div><div><dt>Submitted</dt><dd>{String(submitted).padStart(2, "0")}</dd></div><div><dt>Held</dt><dd>{String(teams.filter((team) => team.banned).length).padStart(2, "0")}</dd></div></dl>{error && <p className="admin-alert" role="alert">{error}</p>}{showForm && <TeamForm onCancel={() => setShowForm(false)} onSaved={() => { setShowForm(false); void load(); }} />}{loading ? <div className="admin-skeleton" aria-busy="true"><i /><i /><i /></div> : <div className="admin-team-table"><table><thead><tr><th>Constructor</th><th>Submission</th><th>Grid status</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{teams.map((team) => <tr key={team.id}><td><strong>{team.team_name}</strong><span>Joined {new Date(team.created_at).toLocaleDateString()}</span></td><td>{team.github_url ? <a href={team.github_url} target="_blank" rel="noreferrer">Repository ↗</a> : <span>Not submitted</span>}</td><td><b className={team.banned ? "is-held" : team.submitted_at ? "is-ready" : ""}>{team.banned ? "Held" : team.submitted_at ? "Submitted" : "In garage"}</b></td><td><div><button onClick={() => void toggleBan(team)}>{team.banned ? "Release" : "Hold"}</button><button onClick={() => void remove(team)}>Remove</button></div></td></tr>)}{teams.length === 0 && <tr><td colSpan={4}><div className="admin-empty"><h3>No teams registered</h3><p>The grid will appear here as constructors join.</p></div></td></tr>}</tbody></table></div>}</section>;
}

export default function AdminPage({ onSessionChange }: { onSessionChange?: (active: boolean) => void }) {
  const [authed, setAuthed] = useState(false); const [checking, setChecking] = useState(true); const [tab, setTab] = useState<"challenges" | "teams" | "scalability">("challenges");
  useEffect(() => { api.get("/api/admin/me").then(() => setAuthed(true)).catch(() => setAuthed(false)).finally(() => setChecking(false)); }, []);
  async function logout() { await api.post("/api/admin/logout").catch(() => {}); setAuthed(false); onSessionChange?.(false); }
  if (checking) return <main className="admin-access page-shell page-admin-login"><p className="admin-checking">Checking Race Control access…</p></main>;
  if (!authed) return <AdminLogin onLoggedIn={() => { setAuthed(true); onSessionChange?.(true); }} />;
  return <main className="admin-console page-shell page-admin" aria-labelledby="admin-title"><div className="admin-console__shell"><header className="admin-console__header"><div><p>MLM 3.0 · Administrator</p><h1 id="admin-title">Race control</h1><span>Manage constructors, challenge briefs and confirmed programme entries.</span></div><button onClick={() => void logout()}>Log out</button></header><nav className="admin-tabs" aria-label="Race Control sections"><button aria-pressed={tab === "challenges"} onClick={() => setTab("challenges")}>Challenge board</button><button aria-pressed={tab === "teams"} onClick={() => setTab("teams")}>Constructors</button><button aria-pressed={tab === "scalability"} onClick={() => setTab("scalability")}>Scalability</button></nav>{tab === "challenges" ? <ChallengesTab /> : tab === "teams" ? <TeamsTab /> : <ScalabilityTab />}</div></main>;
}
