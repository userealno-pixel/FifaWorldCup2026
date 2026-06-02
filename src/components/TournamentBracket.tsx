import { WORLD_CUP_2026_GROUPS } from "../data/worldCupGroups";
import type { AppMatch, AppTeam } from "../services/apiFootball";
import { BracketMatchCard, type BracketMatch, type BracketRound, type BracketTeam } from "./BracketMatchCard";

type BracketRoundConfig = {
  key: BracketRound;
  title: string;
};

const ROUND_CONFIGS: BracketRoundConfig[] = [
  { key: "round32", title: "שלב 32 האחרונות" },
  { key: "round16", title: "שמינית הגמר" },
  { key: "quarterFinals", title: "רבע הגמר" },
  { key: "semiFinals", title: "חצי הגמר" },
  { key: "final", title: "הגמר" },
];

const FLAG_BY_TEAM: Record<string, string> = {
  Algeria: "🇩🇿",
  Argentina: "🇦🇷",
  Australia: "🇦🇺",
  Austria: "🇦🇹",
  Belgium: "🇧🇪",
  "Bosnia & Herzegovina": "🇧🇦",
  "Bosnia and Herzegovina": "🇧🇦",
  Brazil: "🇧🇷",
  Canada: "🇨🇦",
  "Cape Verde": "🇨🇻",
  "Cape Verde Islands": "🇨🇻",
  Colombia: "🇨🇴",
  Croatia: "🇭🇷",
  Curaçao: "🇨🇼",
  "Czech Republic": "🇨🇿",
  Czechia: "🇨🇿",
  "DR Congo": "🇨🇩",
  Ecuador: "🇪🇨",
  Egypt: "🇪🇬",
  England: "🏴",
  France: "🇫🇷",
  Germany: "🇩🇪",
  Ghana: "🇬🇭",
  Haiti: "🇭🇹",
  Iran: "🇮🇷",
  Iraq: "🇮🇶",
  "Ivory Coast": "🇨🇮",
  Japan: "🇯🇵",
  Jordan: "🇯🇴",
  Mexico: "🇲🇽",
  Morocco: "🇲🇦",
  Netherlands: "🇳🇱",
  "New Zealand": "🇳🇿",
  Norway: "🇳🇴",
  Panama: "🇵🇦",
  Paraguay: "🇵🇾",
  Portugal: "🇵🇹",
  Qatar: "🇶🇦",
  "Saudi Arabia": "🇸🇦",
  Scotland: "🏴",
  Senegal: "🇸🇳",
  "South Africa": "🇿🇦",
  "South Korea": "🇰🇷",
  Spain: "🇪🇸",
  Sweden: "🇸🇪",
  Switzerland: "🇨🇭",
  Tunisia: "🇹🇳",
  Türkiye: "🇹🇷",
  Turkey: "🇹🇷",
  Uruguay: "🇺🇾",
  USA: "🇺🇸",
  "United States": "🇺🇸",
  Uzbekistan: "🇺🇿",
};

const GROUP_NAMES = [
  "Group A",
  "Group B",
  "Group C",
  "Group D",
  "Group E",
  "Group F",
  "Group G",
  "Group H",
  "Group I",
  "Group J",
  "Group K",
  "Group L",
];

export function TournamentBracket({
  matches,
  teams,
}: {
  matches: AppMatch[];
  teams: AppTeam[];
}) {
  const knockoutMatches = matches.filter((match) => match.stage === "knockout");
  const bracketRounds = buildBracketRounds(knockoutMatches, teams);
  const groupCards = buildGroupCards(teams);
  const finalMatch = bracketRounds.final[0];
  const champion = pickWinner(finalMatch);
  const thirdPlace = bracketRounds.thirdPlace[0];

  return (
    <section className="real-bracket-page" aria-labelledby="real-bracket-heading">
      <div className="real-bracket-heading">
        <div>
          <p>FIFA WORLD CUP 2026</p>
          <h2 id="real-bracket-heading">תרשים הטורניר</h2>
        </div>
        <span>נוקאאוט</span>
      </div>

      <div className="real-bracket-shell">
        <aside className="real-group-sidebar" aria-label="שלב הבתים">
          <h3>בתים</h3>
          <div className="real-group-list">
            {groupCards.map((group) => (
              <article className="real-group-card" key={group.name}>
                <strong>{group.hebrewName}</strong>
                <ul>
                  {group.teams.map((team) => (
                    <li key={team.name}>
                      <span>{team.flag}</span>
                      {team.name}
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </aside>

        <div className="real-bracket-scroll">
          <div className="real-bracket-tree">
            {ROUND_CONFIGS.map((round) => (
              <BracketRoundColumn
                key={round.key}
                matches={bracketRounds[round.key]}
                round={round}
              />
            ))}

            <section className="real-bracket-round winner-round">
              <h3>הזוכה</h3>
              <article className="winner-trophy-card">
                <span aria-hidden="true">🏆</span>
                <strong>הזוכה במונדיאל 2026</strong>
                <p>
                  {champion.flag} {champion.name}
                </p>
              </article>
            </section>

            <section className="real-bracket-round third-place-round">
              <h3>משחק על המקום השלישי</h3>
              <div className="real-round-track">
                <div className="real-match-pair single">
                  <BracketMatchCard match={thirdPlace} />
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </section>
  );
}

function BracketRoundColumn({
  matches,
  round,
}: {
  matches: BracketMatch[];
  round: BracketRoundConfig;
}) {
  return (
    <section className={`real-bracket-round ${round.key}`}>
      <h3>{round.title}</h3>
      <div className="real-round-track">
        {toPairs(matches).map((pair, index) => (
          <div className={pair.length > 1 ? "real-match-pair" : "real-match-pair single"} key={`${round.key}-${index}`}>
            {pair.map((match) => (
              <BracketMatchCard key={match.id} match={match} />
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}

function buildBracketRounds(knockoutMatches: AppMatch[], teams: AppTeam[]) {
  const byRound = {
    round32: fromApiRound(knockoutMatches, "Round of 32", "round32", 1),
    round16: fromApiRound(knockoutMatches, "Round of 16", "round16", 17),
    quarterFinals: fromApiRound(knockoutMatches, "Quarter-finals", "quarterFinals", 25),
    semiFinals: fromApiRound(knockoutMatches, "Semi-finals", "semiFinals", 29),
    final: fromApiRound(knockoutMatches, "Final", "final", 31).slice(0, 1),
    thirdPlace: fromApiRound(knockoutMatches, "Third place match", "thirdPlace", 32).slice(0, 1),
  };

  if (byRound.round32.length > 0) {
    return completeApiBracket(byRound);
  }

  return buildGeneratedBracket(teams);
}

function completeApiBracket(rounds: Record<BracketRound, BracketMatch[]>) {
  const completeRounds = { ...rounds };

  completeRounds.round16 = completeRounds.round16.length > 0
    ? completeRounds.round16
    : advanceRound(completeRounds.round32, "round16", 17, "שמינית הגמר");
  completeRounds.quarterFinals = completeRounds.quarterFinals.length > 0
    ? completeRounds.quarterFinals
    : advanceRound(completeRounds.round16, "quarterFinals", 25, "רבע הגמר");
  completeRounds.semiFinals = completeRounds.semiFinals.length > 0
    ? completeRounds.semiFinals
    : advanceRound(completeRounds.quarterFinals, "semiFinals", 29, "חצי הגמר");
  completeRounds.final = completeRounds.final.length > 0
    ? completeRounds.final.slice(0, 1)
    : advanceRound(completeRounds.semiFinals, "final", 31, "הגמר").slice(0, 1);
  completeRounds.thirdPlace = completeRounds.thirdPlace.length > 0
    ? completeRounds.thirdPlace.slice(0, 1)
    : buildThirdPlaceFromSemiFinals(completeRounds.semiFinals);

  return completeRounds;
}

function buildGeneratedBracket(teams: AppTeam[]) {
  const qualifiers = getCurrentQualifiers(teams);
  const round32 = createRoundOf32(qualifiers);
  const round16 = advanceRound(round32, "round16", 17, "שמינית הגמר");
  const quarterFinals = advanceRound(round16, "quarterFinals", 25, "רבע הגמר");
  const semiFinals = advanceRound(quarterFinals, "semiFinals", 29, "חצי הגמר");
  const final = advanceRound(semiFinals, "final", 31, "הגמר").slice(0, 1);
  const thirdPlace = buildThirdPlaceFromSemiFinals(semiFinals);

  return { round32, round16, quarterFinals, semiFinals, final, thirdPlace };
}

function fromApiRound(
  matches: AppMatch[],
  roundLabel: string,
  round: BracketRound,
  matchOffset: number,
) {
  return matches
    .filter((match) => normalizeRoundLabel(match.round) === roundLabel)
    .sort((first, second) => first.timestamp - second.timestamp)
    .map((match, index) => toBracketMatchFromApi(match, round, matchOffset + index));
}

function createRoundOf32(qualifiers: BracketTeam[]) {
  const topSeeds = qualifiers.slice(0, 16);
  const bottomSeeds = qualifiers.slice(16, 32).reverse();

  return topSeeds.map((teamOne, index) =>
    createDerivedMatch({
      id: `generated-round32-${index + 1}`,
      matchNumber: index + 1,
      round: "round32",
      teamOne,
      teamTwo: bottomSeeds[index],
      title: "שלב 32 האחרונות",
    }),
  );
}

function advanceRound(
  sourceMatches: BracketMatch[],
  round: BracketRound,
  matchOffset: number,
  title: string,
) {
  return toPairs(sourceMatches).map((pair, index) => {
    const teamOne = pickWinner(pair[0]);
    const teamTwo = pickWinner(pair[1]);

    return createDerivedMatch({
      id: `${round}-${index + 1}`,
      matchNumber: matchOffset + index,
      round,
      teamOne,
      teamTwo,
      title,
    });
  });
}

function buildThirdPlaceFromSemiFinals(semiFinals: BracketMatch[]) {
  const semiPair = semiFinals.slice(0, 2);

  return [
    createDerivedMatch({
      id: "third-place-derived",
      matchNumber: 32,
      round: "thirdPlace",
      teamOne: pickLoser(semiPair[0]),
      teamTwo: pickLoser(semiPair[1]),
      title: "משחק על המקום השלישי",
    }),
  ];
}

function createDerivedMatch({
  id,
  matchNumber,
  round,
  teamOne,
  teamTwo,
  title,
}: {
  id: string;
  matchNumber: number;
  round: BracketRound;
  teamOne: BracketTeam;
  teamTwo: BracketTeam;
  title: string;
}): BracketMatch {
  return {
    id,
    round,
    matchNumber,
    kickoff: title,
    status: "scheduled",
    statusText: "לפי דירוג נוכחי",
    teamOne,
    teamTwo,
  };
}

function toBracketMatchFromApi(match: AppMatch, round: BracketRound, matchNumber: number): BracketMatch {
  const homeWinner = match.homeWinner === true || (match.status === "final" && (match.homeScore ?? 0) > (match.awayScore ?? 0));
  const awayWinner = match.awayWinner === true || (match.status === "final" && (match.awayScore ?? 0) > (match.homeScore ?? 0));

  return {
    id: String(match.id),
    round,
    matchNumber,
    kickoff: formatIsraelKickoff(match),
    status: match.status,
    statusText: translateStatus(match.status, match.statusText),
    teamOne: {
      flag: getTeamFlag(match.home),
      name: match.home,
      score: match.homeScore,
      winner: homeWinner,
    },
    teamTwo: {
      flag: getTeamFlag(match.away),
      name: match.away,
      score: match.awayScore,
      winner: awayWinner,
    },
  };
}

function getCurrentQualifiers(teams: AppTeam[]) {
  const teamsByGroup = new Map<string, AppTeam[]>();

  GROUP_NAMES.forEach((group) => {
    const groupTeams = teams.filter((team) => team.group === group);
    const fallbackTeams = WORLD_CUP_2026_GROUPS[group as keyof typeof WORLD_CUP_2026_GROUPS].map((name) => ({
      name,
      group,
      status: "active" as const,
      points: 0,
      goalDifference: 0,
      goalsFor: 0,
    }));

    teamsByGroup.set(group, sortGroupTeams(groupTeams.length > 0 ? groupTeams : fallbackTeams));
  });

  const winners = GROUP_NAMES.map((group) => teamsByGroup.get(group)?.[0]).filter(Boolean) as AppTeam[];
  const runnersUp = GROUP_NAMES.map((group) => teamsByGroup.get(group)?.[1]).filter(Boolean) as AppTeam[];
  const thirdPlaced = GROUP_NAMES.map((group) => teamsByGroup.get(group)?.[2]).filter(Boolean) as AppTeam[];
  const bestThirdPlaced = thirdPlaced.sort(compareTeamsForSeeding).slice(0, 8);

  return [...winners, ...runnersUp, ...bestThirdPlaced].map(toBracketTeam);
}

function sortGroupTeams(groupTeams: AppTeam[]) {
  return [...groupTeams].sort(compareTeamsForSeeding);
}

function compareTeamsForSeeding(first: AppTeam, second: AppTeam) {
  return (
    (second.points ?? 0) - (first.points ?? 0) ||
    (second.goalDifference ?? 0) - (first.goalDifference ?? 0) ||
    (second.goalsFor ?? 0) - (first.goalsFor ?? 0) ||
    first.name.localeCompare(second.name)
  );
}

function toBracketTeam(team: AppTeam): BracketTeam {
  return {
    flag: getTeamFlag(team.name),
    name: team.name,
    score: null,
    winner: false,
  };
}

function pickWinner(match?: BracketMatch): BracketTeam {
  if (!match) return toBracketTeam({ name: "טרם נקבע", group: "", status: "active" });
  if (match.teamOne.winner) return { ...match.teamOne, score: null, winner: false };
  if (match.teamTwo.winner) return { ...match.teamTwo, score: null, winner: false };
  if (match.teamOne.score !== null && match.teamTwo.score !== null) {
    return match.teamOne.score >= match.teamTwo.score
      ? { ...match.teamOne, score: null, winner: false }
      : { ...match.teamTwo, score: null, winner: false };
  }
  return { ...match.teamOne, score: null, winner: false };
}

function pickLoser(match?: BracketMatch): BracketTeam {
  if (!match) return toBracketTeam({ name: "טרם נקבע", group: "", status: "active" });
  const winner = pickWinner(match).name;
  const loser = match.teamOne.name === winner ? match.teamTwo : match.teamOne;
  return { ...loser, score: null, winner: false };
}

function buildGroupCards(teams: AppTeam[]) {
  return GROUP_NAMES.map((group) => {
    const groupTeams = teams.filter((team) => team.group === group);
    const fallbackTeams = WORLD_CUP_2026_GROUPS[group as keyof typeof WORLD_CUP_2026_GROUPS].map((name) => ({
      name,
      group,
      status: "active" as const,
    }));

    return {
      name: group,
      hebrewName: toHebrewGroupName(group),
      teams: sortGroupTeams(groupTeams.length > 0 ? groupTeams : fallbackTeams).map(toBracketTeam),
    };
  });
}

function toPairs<T>(items: T[]) {
  const pairs: T[][] = [];

  for (let index = 0; index < items.length; index += 2) {
    pairs.push(items.slice(index, index + 2));
  }

  return pairs;
}

function normalizeRoundLabel(round: string) {
  const lower = round.toLowerCase();

  if (lower.includes("round of 32")) return "Round of 32";
  if (lower.includes("round of 16")) return "Round of 16";
  if (lower.includes("quarter")) return "Quarter-finals";
  if (lower.includes("semi")) return "Semi-finals";
  if (lower.includes("third") || lower.includes("3rd")) return "Third place match";
  if (lower.includes("final")) return "Final";
  return round;
}

function translateStatus(status: AppMatch["status"], statusText: string) {
  if (status === "live") return "חי";
  if (status === "final") return "הסתיים";
  if (statusText.toLowerCase().includes("not started")) return "מתוכנן";
  return statusText || "מתוכנן";
}

function formatIsraelKickoff(match: AppMatch) {
  const date = new Date(match.timestamp * 1000);

  if (Number.isNaN(date.getTime())) return `${match.date} ${match.localTime}`;

  return new Intl.DateTimeFormat("he-IL", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Jerusalem",
  }).format(date);
}

function getTeamFlag(teamName: string) {
  return FLAG_BY_TEAM[teamName] ?? "🏳";
}

function toHebrewGroupName(group: string) {
  const match = group.match(/Group\s+([A-L])/i);

  return match ? `בית ${match[1].toUpperCase()}` : group;
}
