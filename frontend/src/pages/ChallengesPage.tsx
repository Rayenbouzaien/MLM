import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { API_BASE, api, ApiError } from "../lib/api";

interface TeamSession {
  id: string;
  teamName: string;
  isLeader: boolean;
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

type SyncState = "guest" | "loading" | "saved" | "saving" | "error";

const CHALLENGE_MEDIA: Record<number, string> = {
  1: "/assets/challenge-strategy.png",
  2: "/assets/challenge-fan-command.png",
  3: "/assets/challenge-logistics.png",
};

function challengeNumber(challenge: Challenge, index: number) {
  return String(challenge.sort_order || index + 1).padStart(2, "0");
}

function ChallengeVisual({ number, title }: { number: string; title: string }) {
  const monogram = title.trim().charAt(0).toUpperCase() || number;

  return (
    <div className="challenge-visual" aria-hidden="true">
      <span className="challenge-visual__number">{number}</span>
      <span className="challenge-visual__mark">{monogram}</span>
      <i className="challenge-visual__line challenge-visual__line--one" />
      <i className="challenge-visual__line challenge-visual__line--two" />
    </div>
  );
}

function ChallengeMedia({ challenge, number }: { challenge: Challenge; number: string }) {
  const [failed, setFailed] = useState(false);
  const source = CHALLENGE_MEDIA[challenge.sort_order];

  if (!source || failed) return <ChallengeVisual number={number} title={challenge.title} />;
  return (
    <div className="challenge-media" aria-hidden="true">
      <img src={source} alt="" loading="lazy" onError={() => setFailed(true)} />
      <span>Race {number}</span>
    </div>
  );
}

function ChallengeBrief({
  challenge,
  number,
  selected,
  canManage,
  isGuest,
  saving,
  onToggle,
}: {
  challenge: Challenge;
  number: string;
  selected: boolean;
  canManage: boolean;
  isGuest: boolean;
  saving: boolean;
  onToggle: () => void;
}) {
  const actionLabel = saving
    ? "Saving programme…"
    : isGuest
      ? "Participant login →"
      : !canManage
        ? "Team leader controls"
        : selected
          ? "Remove from programme →"
          : "Enter challenge →";

  return (
    <article
      className={`challenge-brief${selected ? " challenge-brief--selected" : ""}`}
      style={{ "--challenge-accent": challenge.color } as CSSProperties}
    >
      <div className="challenge-brief__rail" aria-hidden="true"><i /></div>
      <div className="challenge-brief__head">
        <div>
          <p>Challenge {number}</p>
          <h2>{challenge.title}</h2>
        </div>
        <span className="challenge-brief__state">{selected ? "In programme" : "Available"}</span>
      </div>

      <div className="challenge-brief__body">
        <ChallengeMedia challenge={challenge} number={number} />
        <div className="challenge-brief__copy">
          <p className="challenge-brief__label">Race brief</p>
          <p className="challenge-brief__description">{challenge.description}</p>
        </div>
      </div>

      {challenge.deliverables && (
        <div className="challenge-brief__deliverables">
          <p>Deliverables</p>
          <span>{challenge.deliverables}</span>
        </div>
      )}

      <button
        type="button"
        aria-pressed={selected}
        aria-label={`${selected ? "Remove" : "Enter"} ${challenge.title}${canManage ? " in your race programme" : isGuest ? "; participant login required" : "; team leader permission required"}`}
        disabled={saving || (!canManage && !isGuest)}
        onClick={onToggle}
        className="challenge-brief__action"
      >
        <span aria-hidden="true">{selected ? "✓" : "+"}</span>
        {actionLabel}
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
  const [syncState, setSyncState] = useState<SyncState>(team ? "loading" : "guest");

  const canManage = Boolean(team?.isLeader);
  const selectedChallenges = useMemo(
    () => challenges.filter((challenge) => selectedIds.has(challenge.id)),
    [challenges, selectedIds],
  );

  const load = useCallback(async () => {
    try {
      setError(null);
      const challengeResponse = await api.get<{ challenges: Challenge[] }>("/api/challenges");
      setChallenges(challengeResponse.challenges);

      if (team) {
        setSyncState("loading");
        const selectionResponse = await api.get<{ challenges: Challenge[] }>("/api/challenges/me");
        setSelectedIds(new Set(selectionResponse.challenges.map((challenge) => challenge.id)));
        setSyncState("saved");
      } else {
        setSelectedIds(new Set());
        setSyncState("guest");
      }
    } catch (err) {
      setSyncState("error");
      setError(err instanceof ApiError ? err.message : "Unable to load the challenge board.");
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
        // Keep-alive messages are intentionally ignored.
      }
    };
    return () => source.close();
  }, [load]);

  async function toggleChallenge(challengeId: string) {
    if (!team) {
      onLogin();
      return;
    }
    if (!team.isLeader) return;

    const nextSelection = new Set(selectedIds);
    if (nextSelection.has(challengeId)) nextSelection.delete(challengeId);
    else nextSelection.add(challengeId);

    setSavingId(challengeId);
    setSyncState("saving");
    setError(null);
    try {
      const response = await api.put<{ challenges: Challenge[] }>("/api/challenges/me", { challengeIds: [...nextSelection] });
      setSelectedIds(new Set(response.challenges.map((challenge) => challenge.id)));
      setSyncState("saved");
    } catch (err) {
      setSyncState("error");
      setError(err instanceof ApiError ? err.message : "Unable to save your race programme.");
    } finally {
      setSavingId(null);
    }
  }

  return (
    <main className="challenge-board page-challenges" aria-labelledby="challenge-board-title">
      <div className="challenge-board__scene" aria-hidden="true" />
      <div className="challenge-board__geometry" aria-hidden="true" />
      <div className="challenge-board__shell">
        <header className="challenge-command">
          <p className="challenge-entry"><i />Race control <span>Programme entry</span></p>
          <p className="challenge-command__eyebrow">MLM 3.0 · Challenge board</p>
          <div className="challenge-command__content">
            <div>
              <h1 id="challenge-board-title">Choose <span>your race.</span></h1>
              <p className="challenge-command__summary">Select the challenges your constructor will enter. Every confirmed entry is kept with your team account.</p>
            </div>
            <dl className="challenge-command__stats" aria-label="Challenge board status">
              <div><dt>Challenges</dt><dd>{String(challenges.length).padStart(2, "0")}</dd></div>
              <div><dt>Selected</dt><dd>{String(selectedChallenges.length).padStart(2, "0")}</dd></div>
              <div><dt>Entry</dt><dd>{team ? "Team" : "Guest"}</dd></div>
            </dl>
          </div>
        </header>

        {error && <p role="alert" className="challenge-alert">{error}</p>}

        <div className="challenge-workspace">
          <aside className="challenge-programme" aria-label="Race programme">
            <div className="challenge-programme__heading">
              <p>Constructor programme</p>
              <h2>{team ? team.teamName : "Guest entry"}</h2>
            </div>
            <div className="challenge-programme__count">
              <strong>{String(selectedChallenges.length).padStart(2, "0")}</strong>
              <span>/ {String(challenges.length).padStart(2, "0")} entered</span>
            </div>
            <ol className="challenge-programme__list">
              {selectedChallenges.length > 0 ? selectedChallenges.map((challenge, index) => (
                <li key={challenge.id} style={{ "--programme-accent": challenge.color } as CSSProperties}>
                  <span>{challengeNumber(challenge, index)}</span>{challenge.title}
                </li>
              )) : <li className="challenge-programme__empty">{team ? "No challenges entered yet." : "Sign in to build and save your programme."}</li>}
            </ol>
            <p className={`challenge-programme__sync challenge-programme__sync--${syncState}`} aria-live="polite">
              <i />{syncState === "saving" ? "Saving entry" : syncState === "saved" ? "Programme synced" : syncState === "loading" ? "Checking programme" : syncState === "error" ? "Programme needs attention" : "Participant login required"}
            </p>
            {!team && <button type="button" className="challenge-programme__login" onClick={onLogin}>Participant login →</button>}
            {team && !team.isLeader && <p className="challenge-programme__notice">Only your team leader can change entries.</p>}
          </aside>

          <section className="challenge-races" aria-label="Available race challenges">
            <div className="challenge-races__heading"><p>Race programme</p><span>Multiple entries available</span></div>
            {loading ? (
              <div className="challenge-loading" aria-busy="true" aria-label="Loading challenges"><i /><i /><i /></div>
            ) : challenges.length === 0 ? (
              <section className="challenge-empty" role="status"><h2>No challenges published yet</h2><p>Race Control will publish the briefing shortly.</p></section>
            ) : challenges.map((challenge, index) => (
              <ChallengeBrief
                key={challenge.id}
                challenge={challenge}
                number={challengeNumber(challenge, index)}
                selected={selectedIds.has(challenge.id)}
                canManage={canManage}
                isGuest={!team}
                saving={savingId === challenge.id}
                onToggle={() => void toggleChallenge(challenge.id)}
              />
            ))}
          </section>
        </div>

        {!loading && challenges.length > 0 && (
          <section className="challenge-finish" aria-labelledby="programme-finish-title">
            <p>Programme complete</p>
            <h2 id="programme-finish-title">Your race programme</h2>
            <span>{selectedChallenges.length === 0 ? "Select one or more challenges to shape your entry." : `${selectedChallenges.length} challenge${selectedChallenges.length === 1 ? "" : "s"} confirmed in your programme.`}</span>
          </section>
        )}
      </div>
    </main>
  );
}
