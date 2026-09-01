import { useEffect, useMemo, useState } from "react";

type Session = {
  id: string;
  time: string;
  title: string;
  kind: string;
  detail: string;
  moment?: "lights-out" | "overnight" | "finish";
};

type RaceDay = {
  id: "day-one" | "day-two";
  label: string;
  title: string;
  accent: "red" | "cyan";
  sessions: Session[];
};

const RACE_DAYS: RaceDay[] = [
  {
    id: "day-one",
    label: "Day 1",
    title: "Ignite & Innovate",
    accent: "red",
    sessions: [
      { id: "check-in", time: "14:00-15:00", title: "Check-in & registration", kind: "Arrival", detail: "Participant check-in and team arrival at ESSTHS Hammam-Sousse." },
      { id: "opening", time: "15:00-15:30", title: "Opening ceremony", kind: "Main session", detail: "The event opens and the race weekend begins." },
      { id: "panel", time: "15:30-16:30", title: "Panel discussion", kind: "Main session", detail: "A focused exchange on AI, Machine Learning and emerging technology." },
      { id: "coffee", time: "16:30-17:00", title: "Coffee break", kind: "Break", detail: "A short paddock reset before the technical programme." },
      { id: "workshops", time: "17:00-19:30", title: "Parallel AI workshops", kind: "Workshop", detail: "Machine Learning foundations, CNNs, transfer learning, Python, data science and deep learning preparation." },
      { id: "dinner", time: "19:30-20:30", title: "Dinner break", kind: "Break", detail: "Final team reset before the overnight race." },
      { id: "launch", time: "20:30-21:00", title: "ML hackathon launch", kind: "Race control", detail: "The challenge is introduced and teams move into their build strategy.", moment: "lights-out" },
      { id: "start", time: "21:00", title: "Hackathon starts", kind: "Lights out", detail: "The hackathon begins. Teams race through the night to build an AI solution.", moment: "lights-out" },
      { id: "night", time: "23:30-00:30", title: "Late-night activity", kind: "Night session", detail: "A late-night programme moment as teams settle into the overnight stint." },
    ],
  },
  {
    id: "day-two",
    label: "Day 2",
    title: "The Final Push & Closing",
    accent: "cyan",
    sessions: [
      { id: "mentoring", time: "02:00-06:00", title: "Overnight coding & mentoring", kind: "Overnight stint", detail: "Teams continue building with mentoring support through the night.", moment: "overnight" },
      { id: "stop", time: "07:00", title: "Stop coding", kind: "Race control", detail: "Development ends and teams prepare their final presentation." },
      { id: "breakfast", time: "07:00-08:00", title: "Morning breakfast", kind: "Break", detail: "A final reset before the pitching session." },
      { id: "pitching", time: "08:00-10:30", title: "Hackathon pitching", kind: "Final lap", detail: "Teams present their work and demonstrate their solutions." },
      { id: "awards", time: "11:00-12:00", title: "Awards & closing ceremony", kind: "Finish", detail: "The final podium recognises performance, creativity and technical capability.", moment: "finish" },
    ],
  },
];

const EVENT_DATE: Record<RaceDay["id"], string> = {
  "day-one": "2026-10-10",
  "day-two": "2026-10-11",
};

function sessionWindow(day: RaceDay, session: Session) {
  const [startClock, endClock] = session.time.split("-");
  const start = new Date(`${EVENT_DATE[day.id]}T${startClock}:00+01:00`);
  const end = new Date(`${EVENT_DATE[day.id]}T${endClock ?? startClock}:00+01:00`);
  if (!endClock) end.setMinutes(end.getMinutes() + 30);
  if (end < start) end.setDate(end.getDate() + 1);
  return { start, end };
}

function activeSessionAt(now: Date, sessions: { day: RaceDay; session: Session }[]) {
  const dated = sessions.map((entry) => ({ ...entry, ...sessionWindow(entry.day, entry.session) }));
  const active = dated.find((entry) => now >= entry.start && now < entry.end);
  if (active) return { ...active, mode: "live" as const };
  const completed = dated.filter((entry) => entry.start <= now).at(-1);
  return completed ? { ...completed, mode: "completed" as const } : null;
}

export default function CircuitPage() {
  const sessions = useMemo(() => RACE_DAYS.flatMap((day) => day.sessions.map((session) => ({ day, session }))), []);
  const [now, setNow] = useState(() => new Date());
  const [inspectedId, setInspectedId] = useState(sessions[0].session.id);
  const scheduled = activeSessionAt(now, sessions);
  const activeId = scheduled?.session.id ?? inspectedId;
  const active = sessions.find(({ session }) => session.id === activeId) ?? sessions[0];

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 15_000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <main className="race-weekend page-shell page-circuit" aria-labelledby="race-weekend-title">
      <div className="race-weekend-atmosphere" aria-hidden="true" />
      <div className="race-weekend-shell">
        <header className="race-weekend-header">
          <p className="race-weekend-kicker">Race weekend schedule</p>
          <div className="race-weekend-heading">
            <h1 id="race-weekend-title">The AI Grand Prix<br /><span>moves to the grid.</span></h1>
          </div>
          <p className="race-weekend-intro">10-11 October 2026 at ESSTHS Hammam-Sousse. Follow every checkpoint from registration to the final podium.</p>
          <p className={`race-weekend-status${scheduled?.mode === "live" ? " is-live" : ""}`} aria-live="polite"><i />{scheduled?.mode === "live" ? `Live now · ${scheduled.session.time}` : scheduled ? `Latest checkpoint · ${scheduled.session.time}` : "Programme armed · schedule begins 10 October"}</p>
        </header>

        <div className="race-weekend-layout">
          <aside className="race-weekend-brief" aria-label="Event overview">
            <p className="race-weekend-kicker">Programme control</p>
            <h2>One event.<br />Two days.<br />One finish line.</h2>
            <p>Day 1 builds the foundation. Day 2 turns the overnight work into a final pitch and closing ceremony.</p>
          </aside>

          <section className="race-timeline" aria-label="Machine Learning Marathon schedule">
            {RACE_DAYS.map((day, dayIndex) => (
              <section key={day.id} className={`race-day race-day--${day.accent}`} aria-labelledby={`${day.id}-title`}>
                <header className="race-day-header">
                  <p>{day.label}</p>
                  <h2 id={`${day.id}-title`}>{day.title}</h2>
                </header>
                <div className="race-day-rail" aria-hidden="true"><span /></div>
                <ol className="race-session-list">
                  {day.sessions.map((session) => {
                    const selected = activeId === session.id;
                    const live = scheduled?.mode === "live" && scheduled.session.id === session.id;
                    return (
                      <li key={session.id} className={`race-session race-session--${session.moment ?? "standard"} ${selected ? "is-active" : ""}${live ? " is-live" : ""}`}>
                        <button type="button" onClick={() => setInspectedId(session.id)} aria-pressed={selected}>
                          <time>{session.time}</time>
                          <span className="race-checkpoint" aria-hidden="true" />
                          <span className="race-session-copy">
                            <span className="race-session-kind">{session.kind}</span>
                            <strong>{session.title}</strong>
                            <span>{session.detail}</span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ol>
                {dayIndex === 0 && <div className="overnight-stint"><span>Overnight stint</span><p>Coding continues into Day 2 with mentoring support.</p></div>}
              </section>
            ))}
          </section>

          <aside className={`race-session-detail race-session-detail--${active.day.accent}`} aria-live="polite">
            <p className="race-weekend-kicker">{scheduled?.mode === "live" && scheduled.session.id === active.session.id ? "Live checkpoint" : "Selected checkpoint"}</p>
            <time>{active.session.time}</time>
            <h2>{active.session.title}</h2>
            <p>{active.session.detail}</p>
            <span>{active.day.label} · {active.session.kind}</span>
          </aside>
        </div>

        <section className="workshop-lane" aria-labelledby="workshop-lane-title">
          <div>
            <p className="race-weekend-kicker">Workshop lane</p>
            <h2 id="workshop-lane-title">Train before the lights go out.</h2>
          </div>
          <p>The parallel AI workshops prepare participants with Machine Learning fundamentals, convolutional neural networks, transfer learning, Python, data science and deep learning.</p>
          <span className="workshop-lane-mark">Pit entry</span>
        </section>
      </div>
    </main>
  );
}
