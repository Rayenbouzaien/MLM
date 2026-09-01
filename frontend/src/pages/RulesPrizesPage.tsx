import { useState } from "react";

const REGULATIONS = [
  {
    index: "01",
    title: "Eligibility",
    label: "Entry requirements",
    accent: "red",
    items: [
      "Teams of 2 to 4 members, all registered before Lights Out.",
      "One submission per team. Resubmitting updates your entry and does not create a new one.",
      "Original work only. Do not enter pre-built projects as new work.",
    ],
  },
  {
    index: "02",
    title: "Timing",
    label: "Timing control",
    accent: "cyan",
    items: [
      "The qualifying submission deadline is final. See the countdown on the Garage page.",
      "Late submissions are not scored. No exceptions.",
      "Final Race Demo slots are assigned, not first-come-first-served.",
    ],
  },
  {
    index: "03",
    title: "Submission",
    label: "Delivery protocol",
    accent: "green",
    items: [
      "A GitHub repository link is required.",
      "A Google Drive link for slides or video is optional but recommended.",
      "Include a short README explaining what your project does and how to run it.",
    ],
  },
];

const CLASSIFICATION = [
  { place: "P2", title: "Second Place", description: "Celebrated for an exceptional final solution", accent: "cyan", trophy: "silver" },
  { place: "P1", title: "Race Winner", description: "Recognised at the awards and closing ceremony", accent: "winner", trophy: "gold" },
  { place: "P3", title: "Third Place", description: "Honoured alongside the final podium", accent: "bronze", trophy: "bronze" },
];

const INNOVATION = {
  place: "AI",
  title: "Innovation",
  description: "Judging values performance, creativity and technical capability",
};

const ORGANIZERS = [
  {
    name: "IEEE ESSTHS Computer Society",
    shortName: "IEEE ESSTHS Computer Society",
    logo: "/assets/ieee-essths-computer-society.png",
    href: "https://essths.ieee.tn/chapters/cs",
    fallback: "IEEE",
    description: "Founded in 2021, the IEEE ESSTHS Computer Society Student Branch Chapter builds learning and professional-development opportunities in computing, AI and emerging technologies. Its community has organised more than 60 events, including workshops, hackathons and conferences.",
  },
  {
    name: "Studrz",
    shortName: "Studrz",
    logo: "/assets/studrz.png",
    href: "https://www.studrz.com",
    fallback: "S",
    description: "Founded in 2025, Studrz is a digital platform for student communities, events and academic resources. Active at ESSTHS in Tunisia and University Toulouse III - Paul Sabatier in France, it brings event-management expertise and a connected student network to MLM 3.0.",
  },
];

function BrandImage({ src, alt, fallback }: { src: string; alt: string; fallback: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <span className="organizer-logo-fallback" aria-label={alt}>{fallback}</span>;
  return <img src={src} alt={alt} loading="lazy" onError={() => setFailed(true)} />;
}

function RegulationDirective({ regulation }: { regulation: typeof REGULATIONS[number] }) {
  return (
    <article className={`regulation-directive regulation-directive--${regulation.accent}`}>
      <div className="regulation-directive__index" aria-hidden="true">{regulation.index}</div>
      <div className="regulation-directive__content">
        <p>{regulation.label}</p>
        <h3>{regulation.title}</h3>
        <ul>
          {regulation.items.map((item) => <li key={item}>{item}</li>)}
        </ul>
      </div>
      <span className="regulation-directive__state">Mandatory</span>
    </article>
  );
}

function ClassificationPanel({ award }: { award: typeof CLASSIFICATION[number] }) {
  const [failed, setFailed] = useState(false);
  return (
    <article className={`classification-panel classification-panel--${award.accent}`}>
      {!failed && <div className={`classification-panel__trophy classification-panel__trophy--${award.trophy}`} aria-hidden="true"><img src="/assets/podium-trophies.png" alt="" loading="lazy" onError={() => setFailed(true)} /></div>}
      <p>Final classification</p>
      <span>{award.place}</span>
      <h3>{award.title}</h3>
      <div className="classification-panel__line" aria-hidden="true" />
      <p>{award.description}</p>
    </article>
  );
}

export default function RulesPrizesPage() {
  return (
    <main className="rules-briefing page-shell page-rules" aria-labelledby="rules-title">
      <div className="rules-archive" aria-hidden="true" />
      <div className="rules-geometry" aria-hidden="true" />
      <div className="rules-shell">
        <header className="rules-hero">
          <div className="rules-entry" aria-hidden="true"><span>Paddock</span><i /><span>Scrutineering</span><i /><strong>Race control</strong></div>
          <p className="rules-eyebrow">Race control · Regulations</p>
          <h1 id="rules-title">Rules <span>&amp; prizes</span></h1>
          <p className="rules-hero__summary">What it takes to reach the podium.</p>
          <p className="rules-hero__meta">MLM 3.0 · 10-11 October 2026 · ESSTHS, Hammam-Sousse</p>
        </header>

        <section className="regulations-section" aria-labelledby="regulations-title">
          <header className="regulations-intro">
            <p className="rules-eyebrow">Technical directive</p>
            <h2 id="regulations-title">Rules of engagement</h2>
            <p>Every constructor is judged by the same race-control requirements. Read the briefing before entering the final classification.</p>
            <div className="regulations-route" aria-hidden="true"><span>01</span><i /><span>02</span><i /><span>03</span><i /><strong>Podium</strong></div>
          </header>
          <div className="regulations-list">
            {REGULATIONS.map((regulation) => <RegulationDirective regulation={regulation} key={regulation.index} />)}
          </div>
        </section>

        <section className="podium-section" aria-labelledby="podium-title">
          <header className="podium-heading">
            <div><p className="rules-eyebrow">Championship outcome</p><h2 id="podium-title">The podium</h2></div>
            <p>Final classification follows the same rules. The trophy waits at the end of every qualifying run.</p>
          </header>
          <div className="classification-grid">
            {CLASSIFICATION.map((award) => <ClassificationPanel award={award} key={award.place} />)}
          </div>
          <article className="innovation-award">
            <div><p>Special classification</p><h3><span>{INNOVATION.place}</span> {INNOVATION.title}</h3></div>
            <p>{INNOVATION.description}</p>
          </article>
        </section>

        <section className="organizers-section" aria-labelledby="organizers-title">
          <header><p className="rules-eyebrow">Co-organizers</p><h2 id="organizers-title">The teams behind the grid</h2></header>
          <div className="organizers-grid">
            {ORGANIZERS.map((organizer) => (
              <article className="organizer-profile" key={organizer.name}>
                <a href={organizer.href} target="_blank" rel="noreferrer" className="organizer-logo"><BrandImage src={organizer.logo} alt={organizer.name} fallback={organizer.fallback} /></a>
                <div><p>Role · Co-organizer</p><h3>{organizer.shortName}</h3><p>{organizer.description}</p></div>
              </article>
            ))}
          </div>
        </section>

        <footer className="rules-closing"><i aria-hidden="true" /><p>Machine Learning Marathon 3.0 · Formula 1: The AI Grand Prix<br />10-11 October 2026 · ESSTHS, Hammam-Sousse</p></footer>
      </div>
    </main>
  );
}
