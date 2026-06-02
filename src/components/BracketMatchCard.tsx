import type { AppMatchStatus } from "../services/apiFootball";

export type BracketTeam = {
  flag: string;
  name: string;
  score: number | null;
  winner: boolean;
};

export type BracketMatch = {
  id: string;
  round: BracketRound;
  matchNumber: number;
  kickoff: string;
  status: AppMatchStatus;
  statusText: string;
  teamOne: BracketTeam;
  teamTwo: BracketTeam;
};

export type BracketRound =
  | "round32"
  | "round16"
  | "quarterFinals"
  | "semiFinals"
  | "final"
  | "thirdPlace";

export function BracketMatchCard({ match }: { match: BracketMatch }) {
  const isLive = match.status === "live";

  return (
    <article className={`real-bracket-match ${isLive ? "is-live" : ""}`}>
      <div className="real-match-top">
        <strong>משחק {match.matchNumber}</strong>
        <span className={isLive ? "live-badge" : "match-status"}>{isLive ? "LIVE" : match.statusText}</span>
      </div>
      <time>{match.kickoff}</time>
      <div className="real-team-list">
        <TeamRow team={match.teamOne} />
        <TeamRow team={match.teamTwo} />
      </div>
    </article>
  );
}

function TeamRow({ team }: { team: BracketTeam }) {
  return (
    <div className={`real-team-row ${team.winner ? "winner" : ""}`}>
      <span className="team-flag" aria-hidden="true">
        {team.flag}
      </span>
      <span className="team-name">{team.name}</span>
      <b>{team.score ?? "-"}</b>
    </div>
  );
}
