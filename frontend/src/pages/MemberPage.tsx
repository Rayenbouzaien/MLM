import { useEffect, useState } from "react";
import { api, ApiError } from "../lib/api";
import type { Member, Team } from "./LoginPage";

interface Invitation {
  id: string;
  invitedBy: string | null;
  team: Team;
}

interface MemberProfile extends Member {
  team: Team | null;
}

interface RosterMember {
  id: string;
  displayName: string;
  email: string;
  role: "leader" | "member";
}

export default function MemberPage({ onTeamJoined }: { onTeamJoined: (team: Team) => void }) {
  const [profile, setProfile] = useState<MemberProfile | null>(null);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [roster, setRoster] = useState<RosterMember[]>([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const response = await api.get<{ member: MemberProfile; invitations: Invitation[] }>("/api/auth/member/me");
      setProfile(response.member);
      setInvitations(response.invitations);
      if (response.member.role === "leader" && response.member.team) {
        const members = await api.get<{ members: RosterMember[] }>("/api/auth/team/members");
        setRoster(members.members);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load your member account.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  async function respond(id: string, action: "accept" | "decline") {
    setError(null);
    try {
      if (action === "accept") {
        const response = await api.post<{ team: Team }>(`/api/auth/invitations/${id}/accept`);
        onTeamJoined(response.team);
        return;
      }
      await api.post(`/api/auth/invitations/${id}/decline`);
      setInvitations((current) => current.filter((invite) => invite.id !== id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not update that invitation.");
    }
  }

  async function sendInvitation(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    try {
      const response = await api.post<{ invitation: { member: { displayName: string } } }>("/api/auth/team/invitations", { email: inviteEmail });
      setMessage(`Invitation sent to ${response.invitation.member.displayName}.`);
      setInviteEmail("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not send the invitation.");
    }
  }

  if (loading) return <main className="flex-1 p-8 text-center text-sm text-gray-400">Loading your member account…</main>;

  return (
    <main className="flex-1 overflow-auto px-5 py-8 sm:px-8 page-shell page-member" style={{ background: "linear-gradient(160deg,#080810 0%,#10101a 100%)" }}>
      <div className="mx-auto max-w-5xl">
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#00D2D2]">Member control room</p>
        <h1 className="mt-2 font-headline text-3xl font-black uppercase text-white">{profile?.displayName || "Member account"}</h1>
        <p className="mt-2 text-sm text-gray-400">Use invitations to join a constructor. Team leaders can manage their roster here.</p>
        {error && <p className="mt-4 rounded border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300" role="alert">{error}</p>}
        {message && <p className="mt-4 rounded border border-[#00D2D2]/40 bg-[#00D2D2]/10 p-3 text-sm text-[#9bf5f5]">{message}</p>}

        <div className="mt-7 grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
          <section className="rounded-lg border border-white/10 bg-black/25 p-5">
            <h2 className="font-headline text-lg font-bold uppercase text-white">Your grid status</h2>
            {profile?.team ? <TeamSummary team={profile.team} role={profile.role} /> : <p className="mt-4 text-sm leading-6 text-gray-400">You are not assigned to a team yet. When a leader invites your registered email address, it will appear below.</p>}
          </section>

          {profile?.role === "leader" && profile.team ? (
            <section className="rounded-lg border border-[#00D2D2]/30 bg-[#00D2D2]/5 p-5">
              <h2 className="font-headline text-lg font-bold uppercase text-white">Invite a registered member</h2>
              <p className="mt-1 text-sm text-gray-400">They will review and accept the invitation from their own account.</p>
              <form onSubmit={sendInvitation} className="mt-4 flex flex-col gap-3 sm:flex-row">
                <label className="sr-only" htmlFor="invite-email">Member email</label>
                <input id="invite-email" required type="email" value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} placeholder="member@example.com" className="form-input flex-1" />
                <button className="rounded bg-[#00D2D2] px-4 py-2 text-xs font-black uppercase tracking-widest text-[#061111]" type="submit">Send invite</button>
              </form>
              <div className="mt-5 border-t border-white/10 pt-4">
                <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400">Current roster</h3>
                <ul className="mt-3 divide-y divide-white/10" aria-label="Team roster">
                  {roster.map((member) => <li key={member.id} className="flex items-center justify-between gap-3 py-2 text-sm"><span className="text-white">{member.displayName}<span className="ml-2 text-xs text-gray-500">{member.email}</span></span><span className="text-xs uppercase tracking-wider text-[#00D2D2]">{member.role}</span></li>)}
                </ul>
              </div>
            </section>
          ) : (
            <section className="rounded-lg border border-[#E10600]/30 bg-[#E10600]/5 p-5">
              <h2 className="font-headline text-lg font-bold uppercase text-white">Team invitations</h2>
              {invitations.length === 0 ? <p className="mt-4 text-sm text-gray-400">No pending invitations. You can stay independent until the right team invites you.</p> : <div className="mt-4 space-y-3">{invitations.map((invite) => <article key={invite.id} className="rounded border border-white/10 bg-black/30 p-4"><TeamSummary team={invite.team} /><p className="mt-2 text-xs text-gray-500">Invited by {invite.invitedBy || "a team leader"}</p><div className="mt-4 flex gap-3"><button onClick={() => void respond(invite.id, "accept")} className="rounded bg-[#00D2D2] px-3 py-2 text-xs font-bold uppercase tracking-wider text-[#061111]">Accept</button><button onClick={() => void respond(invite.id, "decline")} className="rounded border border-white/20 px-3 py-2 text-xs font-bold uppercase tracking-wider text-gray-300">Decline</button></div></article>)}</div>}
            </section>
          )}
        </div>
      </div>
    </main>
  );
}

function TeamSummary({ team, role }: { team: Team; role?: string }) {
  return <div className="mt-4 flex gap-3"><div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded border border-[#00D2D2]/40 bg-[#00D2D2]/10 text-lg font-black text-[#00D2D2]">{team.logoUrl ? <img src={team.logoUrl} alt="" className="h-full w-full object-cover" /> : team.teamName.slice(0, 1)}</div><div><h3 className="font-headline text-lg font-bold uppercase text-white">{team.teamName}</h3>{role && <p className="text-xs uppercase tracking-widest text-[#00D2D2]">{role}</p>}{team.description && <p className="mt-1 text-sm text-gray-400">{team.description}</p>}</div></div>;
}
