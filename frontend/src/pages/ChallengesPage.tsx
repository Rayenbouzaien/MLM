import { useCallback, useEffect, useState } from "react";
import { API_BASE, api, ApiError } from "../lib/api";

interface TeamSession {
  id: string;
  teamName: string;
}

interface Challenge {
  id: string;
  title: string;
  description: string;
  deliverables: string;
  color: string;
  sort_order: number;
}

interface LiveEvent {
  type: "team_joined" | "submission" | "data_changed" | "team_access_revoked";
}

function ChallengeCard({
  challenge,
  selected,
  disabled,
  saving,
  onToggle,
}: {
  challenge: Challenge;
  selected: boolean;
  disabled: boolean;
  saving: boolean;
  onToggle: () => void;
}) {
  return (
    <article className="flex flex-col gap-5 border p-6" style={{ borderColor: selected ? challenge.color : "#2a2a35", background: "#111118" }}>
      <div className="flex items-start justify-between gap-4">
        <p className="text-xs font-bold uppercase tracking-[0.2em]" style={{ color: challenge.color }}>
          Challenge {String(challenge.sort_order || 0).padStart(2, "0")}
        </p>
        {selected && <span className="border px-2 py-1 text-xs font-semibold uppercase tracking-wider" style={{ borderColor: challenge.color, color: challenge.color }}>Selected</span>}
      </div>

      <div className="space-y-3">
        <h2 className="font-headline text-2xl font-black uppercase leading-tight text-white">{challenge.title}</h2>
        <p className="text-sm leading-6 text-gray-300" style={{ fontFamily: "'Titillium Web', sans-serif" }}>{challenge.description}</p>
      </div>

      {challenge.deliverables && <div className="border-l-2 pl-3 text-sm text-gray-400" style={{ borderColor: challenge.color }}><span className="font-semibold text-white">Deliverables: </span>{challenge.deliverables}</div>}

      <button
        type="button"
        disabled={saving}
        onClick={onToggle}
        className="mt-auto w-full border px-4 py-3 text-xs font-bold uppercase tracking-[0.15em] transition-colors disabled:cursor-wait disabled:opacity-60"
        style={{ borderColor: challenge.color, background: selected ? challenge.color : "transparent", color: selected ? "#09090d" : challenge.color }}
      >
        {saving ? "Saving…" : disabled ? "Sign in to select" : selected ? "Remove selection" : "Select challenge"}
      </button>
    </article>
  );
}

export default function ChallengesPage({ team, onLogin }: { team: TeamSession | null; onLogin: () => void }) {
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const challengeResponse = await api.get<{ challenges: Challenge[] }>("/api/challenges");
      setChallenges(challengeResponse.challenges);
      if (team) {
        const selectionResponse = await api.get<{ challenges: Challenge[] }>("/api/challenges/me");
        setSelectedIds(new Set(selectionResponse.challenges.map((challenge) => challenge.id)));
      } else {
        setSelectedIds(new Set());
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to load challenges.");
    } finally {
      setLoading(false);
    }
  }, [team]);

  useEffect(() => {
    setLoading(true);
    void load();
    const source = new EventSource(`${API_BASE}/api/live`);
    source.onmessage = (message) => {
      try {
        const event: LiveEvent = JSON.parse(message.data);
        if (event.type === "data_changed") void load();
      } catch {
        // Keep-alive comments are intentionally ignored.
      }
    };
    return () => source.close();
  }, [load]);

  async function toggleChallenge(challengeId: string) {
    if (!team) {
      onLogin();
      return;
    }
    const nextSelection = new Set(selectedIds);
    if (nextSelection.has(challengeId)) nextSelection.delete(challengeId);
    else nextSelection.add(challengeId);

    setSavingId(challengeId);
    setError(null);
    try {
      const response = await api.put<{ challenges: Challenge[] }>("/api/challenges/me", { challengeIds: [...nextSelection] });
      setSelectedIds(new Set(response.challenges.map((challenge) => challenge.id)));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to save your challenge selections.");
    } finally {
      setSavingId(null);
    }
  }

  return (
    <main className="flex-1 bg-[#09090d] px-5 py-10 text-white sm:px-8 lg:px-12">
      <div className="mx-auto max-w-6xl">
        <header className="border-b border-[#2a2a35] pb-8">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#00D2D2]">Gridlock / Challenge board</p>
          <div className="mt-4 flex flex-col justify-between gap-5 md:flex-row md:items-end">
            <div>
              <h1 className="font-headline text-4xl font-black uppercase tracking-wide sm:text-5xl">Choose your race.</h1>
              <p className="mt-3 max-w-2xl text-gray-400">Teams can select every challenge they intend to explore. Your choices are saved to your team account.</p>
            </div>
            <p className="border-l-2 border-[#E10600] pl-3 text-sm text-gray-300">{team ? `Signed in as ${team.teamName}` : "Sign in to save your selections."}</p>
          </div>
        </header>

        {error && <p role="alert" className="mt-6 border border-red-500/60 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</p>}

        {loading ? (
          <div className="grid grid-cols-1 gap-5 py-8 md:grid-cols-2 lg:grid-cols-3" aria-busy="true" aria-label="Loading challenges">
            {[0, 1, 2].map((item) => <div key={item} className="h-80 animate-pulse bg-[#15151e]" />)}
          </div>
        ) : challenges.length === 0 ? (
          <section className="py-20 text-center" role="status"><h2 className="font-headline text-2xl font-bold uppercase">No challenges published yet</h2><p className="mt-2 text-gray-400">Race Control will publish the briefing shortly.</p></section>
        ) : (
          <section className="grid grid-cols-1 gap-5 py-8 md:grid-cols-2 lg:grid-cols-3" aria-label="Available challenges">
            {challenges.map((challenge) => <ChallengeCard key={challenge.id} challenge={challenge} selected={selectedIds.has(challenge.id)} disabled={!team} saving={savingId === challenge.id} onToggle={() => void toggleChallenge(challenge.id)} />)}
          </section>
        )}
      </div>
    </main>
  );
}
