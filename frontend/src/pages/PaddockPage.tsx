import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { API_BASE, api } from "../lib/api";

type Constructor = {
  team_name: string;
  description: string;
  logo_url: string | null;
  submitted: boolean;
};

type LiveEvent = {
  type: "team_joined" | "submission" | "data_changed" | "team_access_revoked";
  teamName?: string;
  at: string;
};

type Filter = "all" | "submitted" | "garage";

function garageNumber(index: number) {
  return String(index + 1).padStart(2, "0");
}

function initials(name: string) {
  return name.split(/\s+/).map((word) => word[0]).join("").slice(0, 2).toUpperCase();
}

function formatTime(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit", hour12: false }).format(date);
}

function ConstructorMark({ constructor }: { constructor: Constructor }) {
  const [failed, setFailed] = useState(false);
  const showImage = Boolean(constructor.logo_url) && !failed;

  return (
    <div className="constructor-mark" aria-hidden="true">
      {showImage ? <img src={constructor.logo_url ?? ""} alt="" loading="lazy" onError={() => setFailed(true)} /> : <span>{initials(constructor.team_name)}</span>}
    </div>
  );
}

function GarageBay({ constructor, index, active, onSelect }: { constructor: Constructor; index: number; active: boolean; onSelect: () => void }) {
  const state = constructor.submitted ? "cleared" : "garage";
  const status = constructor.submitted ? "Submission received" : "Garage status · Preparing";

  return (
    <li className={`garage-bay garage-bay--${state}${active ? " is-active" : ""}`} style={{ "--bay-index": index } as CSSProperties}>
      <button type="button" onClick={onSelect} aria-pressed={active} aria-label={`Inspect garage ${garageNumber(index)} for ${constructor.team_name}`}>
        <span className="garage-bay__scan" aria-hidden="true" />
        <span className="garage-bay__number">Garage {garageNumber(index)}</span>
        <ConstructorMark constructor={constructor} />
        <span className="garage-bay__content">
          <strong>{constructor.team_name}</strong>
          {constructor.description && <span className="garage-bay__description">{constructor.description}</span>}
          <span className="garage-bay__status"><i aria-hidden="true" />{status}</span>
        </span>
        <span className="garage-bay__action">Inspect bay <b aria-hidden="true">→</b></span>
      </button>
    </li>
  );
}

function PitWall({ events, connection, selected, selectedIndex }: { events: LiveEvent[]; connection: "connecting" | "live" | "offline"; selected?: Constructor; selectedIndex: number }) {
  const visibleEvents = events.filter((event) => event.type === "team_joined" || event.type === "submission");
  const connectionText = connection === "live" ? "Live" : connection === "connecting" ? "Connecting" : "Offline";

  return (
    <aside className="pit-wall" aria-label="Pit Wall live feed">
      <header>
        <div><p>Pit wall</p><h2>Live feed</h2></div>
        <span className={`pit-wall__connection is-${connection}`}><i aria-hidden="true" />{connectionText}</span>
      </header>
      {selected && (
        <section className={`pit-wall__inspection ${selected.submitted ? "is-cleared" : "is-garage"}`} aria-live="polite">
          <p>Selected constructor</p>
          <strong>Garage {garageNumber(selectedIndex)} · {selected.team_name}</strong>
          <span>{selected.submitted ? "Submission received" : "Preparing in garage"}</span>
        </section>
      )}
      <div className="pit-wall__events">
        {visibleEvents.length === 0 ? (
          <div className="pit-wall__empty"><strong>Pit wall active</strong><p>Awaiting constructor activity.</p></div>
        ) : (
          <ol>{visibleEvents.map((event, index) => (
            <li key={`${event.at}-${index}`}><time>{formatTime(event.at)}</time><div><strong>{event.teamName ?? "Constructor"}</strong><span>{event.type === "submission" ? "Submission received" : "Constructor registered"}</span></div></li>
          ))}</ol>
        )}
      </div>
    </aside>
  );
}

function GarageSkeleton() {
  return <div className="garage-grid" aria-busy="true" aria-label="Loading constructor directory">{Array.from({ length: 6 }, (_, index) => <div className="garage-bay-skeleton" key={index} />)}</div>;
}

export default function PaddockPage({ onOpenGarage, teamName }: { onOpenGarage: () => void; teamName?: string }) {
  const [constructors, setConstructors] = useState<Constructor[]>([]);
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [activeName, setActiveName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [connection, setConnection] = useState<"connecting" | "live" | "offline">("connecting");

  useEffect(() => {
    let active = true;
    const loadConstructors = async () => {
      try {
        const response = await api.get<{ teams: Constructor[] }>("/api/teams");
        if (!active) return;
        setConstructors(response.teams);
        setError(false);
      } catch {
        if (active) setError(true);
      } finally {
        if (active) setLoading(false);
      }
    };

    void loadConstructors();
    const source = new EventSource(`${API_BASE}/api/live`);
    source.onopen = () => setConnection("live");
    source.onerror = () => setConnection("offline");
    source.onmessage = (message) => {
      try {
        const event: LiveEvent = JSON.parse(message.data);
        if (event.type === "team_joined" || event.type === "submission") setEvents((current) => [event, ...current].slice(0, 8));
        if (event.type === "team_joined" || event.type === "submission" || event.type === "data_changed") void loadConstructors();
      } catch {
        // Keep-alive SSE comments do not carry a usable event payload.
      }
    };

    return () => { active = false; source.close(); };
  }, []);

  const counts = useMemo(() => ({
    all: constructors.length,
    submitted: constructors.filter((constructor) => constructor.submitted).length,
    garage: constructors.filter((constructor) => !constructor.submitted).length,
  }), [constructors]);
  const filtered = useMemo(() => constructors.filter((constructor) => {
    const matchesSearch = constructor.team_name.toLowerCase().includes(search.trim().toLowerCase());
    const matchesFilter = filter === "all" || (filter === "submitted" ? constructor.submitted : !constructor.submitted);
    return matchesSearch && matchesFilter;
  }), [constructors, filter, search]);
  const rows = useMemo(() => Array.from({ length: Math.ceil(filtered.length / 3) }, (_, index) => filtered.slice(index * 3, index * 3 + 3)), [filtered]);
  const activeConstructor = constructors.find((constructor) => constructor.team_name === activeName);
  const activeIndex = activeConstructor ? constructors.indexOf(activeConstructor) : -1;
  const garageLabel = teamName ? `Garage ${teamName}` : "Claim garage";

  return (
    <main className="paddock-experience page-shell page-paddock" aria-labelledby="paddock-title">
      <div className="paddock-scene" aria-hidden="true" />
      <div className="paddock-structure" aria-hidden="true" />
      <div className="paddock-shell">
        <header className="paddock-command">
          <div className="paddock-entry" aria-hidden="true"><span>Final sector</span><i /><strong>Pit entry</strong></div>
          <p className="paddock-eyebrow">Paddock access / Constructor directory</p>
          <h1 id="paddock-title">The paddock</h1>
          <p className="paddock-subtitle">Constructor database</p>
          <div className="paddock-command__lower">
            <dl className="paddock-stats" aria-label="Constructor status">
              <div><dt>Constructors</dt><dd>{counts.all}</dd></div><div><dt>Submitted</dt><dd>{counts.submitted}</dd></div><div><dt>In garage</dt><dd>{counts.garage}</dd></div><div><dt>Paddock status</dt><dd>{connection === "live" ? "Live" : connection === "offline" ? "Offline" : "Syncing"}</dd></div>
            </dl>
            <button className="paddock-garage-control" type="button" onClick={onOpenGarage}><span>{teamName ? "My constructor" : "Your garage"}</span><strong>{garageLabel} <b aria-hidden="true">→</b></strong></button>
          </div>
        </header>

        <div className="paddock-workspace">
          <section className="constructor-directory" aria-labelledby="directory-title">
            <header className="directory-controls">
              <div><p className="paddock-eyebrow">Paddock index</p><h2 id="directory-title">Constructor search</h2></div>
              <label className="constructor-search"><span className="sr-only">Search constructor or garage</span><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search constructor / garage" /></label>
            </header>
            <div className="paddock-filters" role="group" aria-label="Filter constructors by status">
              {(["all", "submitted", "garage"] as const).map((value) => <button type="button" key={value} className={filter === value ? "is-active" : ""} onClick={() => setFilter(value)}><span>{value === "all" ? "All" : value === "submitted" ? "Submitted" : "In garage"}</span><b>{counts[value]}</b></button>)}
            </div>
            {loading ? <GarageSkeleton /> : error ? (
              <div className="directory-state" role="alert"><strong>Directory unavailable</strong><p>Race Control could not load constructors. Refresh to try again.</p></div>
            ) : filtered.length === 0 ? (
              <div className="directory-state" role="status"><strong>No constructor found</strong><p>Try a different constructor name or status control.</p></div>
            ) : (
              <div className="garage-rows">{rows.map((row, rowIndex) => (
                <section className="garage-row" key={`${row[0]?.team_name}-${rowIndex}`} aria-label={`Paddock row ${String.fromCharCode(65 + rowIndex)}`}>
                  <header><span>Row {String.fromCharCode(65 + rowIndex)}</span><i /></header>
                  <ol className="garage-grid">{row.map((constructor) => {
                    const index = constructors.indexOf(constructor);
                    return <GarageBay key={constructor.team_name} constructor={constructor} index={index} active={activeName === constructor.team_name} onSelect={() => setActiveName(constructor.team_name)} />;
                  })}</ol>
                </section>
              ))}</div>
            )}
          </section>
          <PitWall events={events} connection={connection} selected={activeConstructor} selectedIndex={activeIndex} />
        </div>
      </div>
    </main>
  );
}
