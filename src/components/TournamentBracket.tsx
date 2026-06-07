import type { AppMatch, AppTeam } from "../services/apiFootball";
import { translateTeamName } from "../utils/teamTranslations";
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
  const bracketRounds = buildBracketRounds(knockoutMatches);
  const groupCards = buildGroupCards(teams);
  const finalMatch = bracketRounds.final[0];
  const champion = getKnownWinner(finalMatch) ?? createPositionTeam("ייקבע לאחר הגמר");
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
      <p className="bracket-update-note">
        הקבוצות יעודכנו אוטומטית לאחר סיום שלב הבתים
      </p>

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
                      {team.logo ? (
                        <img alt="" className="team-logo" src={team.logo} />
                      ) : (
                        <span>{team.flag}</span>
                      )}
                      {translateTeamName(team.name)}
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
                  {champion.flag} {translateTeamName(champion.name)}
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

function buildBracketRounds(knockoutMatches: AppMatch[]) {
  const byRound = {
    round32: fromApiRound(knockoutMatches, "Round of 32", "round32", 49),
    round16: fromApiRound(knockoutMatches, "Round of 16", "round16", 65),
    quarterFinals: fromApiRound(knockoutMatches, "Quarter-finals", "quarterFinals", 73),
    semiFinals: fromApiRound(knockoutMatches, "Semi-finals", "semiFinals", 77),
    final: fromApiRound(knockoutMatches, "Final", "final", 79).slice(0, 1),
    thirdPlace: fromApiRound(knockoutMatches, "Third place match", "thirdPlace", 80).slice(0, 1),
  };

  if (byRound.round32.length > 0) {
    return completeApiBracket(byRound);
  }

  return buildGeneratedBracket();
}

function completeApiBracket(rounds: Record<BracketRound, BracketMatch[]>) {
  const completeRounds = { ...rounds };

  completeRounds.round16 = completeRounds.round16.length > 0
    ? completeRounds.round16
    : advanceRound(completeRounds.round32, "round16", 65, "שמינית הגמר");
  completeRounds.quarterFinals = completeRounds.quarterFinals.length > 0
    ? completeRounds.quarterFinals
    : advanceRound(completeRounds.round16, "quarterFinals", 73, "רבע הגמר");
  completeRounds.semiFinals = completeRounds.semiFinals.length > 0
    ? completeRounds.semiFinals
    : advanceRound(completeRounds.quarterFinals, "semiFinals", 77, "חצי הגמר");
  completeRounds.final = completeRounds.final.length > 0
    ? completeRounds.final.slice(0, 1)
    : advanceRound(completeRounds.semiFinals, "final", 79, "הגמר").slice(0, 1);
  completeRounds.thirdPlace = completeRounds.thirdPlace.length > 0
    ? completeRounds.thirdPlace.slice(0, 1)
    : buildThirdPlaceFromSemiFinals(completeRounds.semiFinals);

  return completeRounds;
}

function buildGeneratedBracket() {
  const round32 = createRoundOf32();
  const round16 = advanceRound(round32, "round16", 65, "שמינית הגמר");
  const quarterFinals = advanceRound(round16, "quarterFinals", 73, "רבע הגמר");
  const semiFinals = advanceRound(quarterFinals, "semiFinals", 77, "חצי הגמר");
  const final = advanceRound(semiFinals, "final", 79, "הגמר").slice(0, 1);
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

function createRoundOf32() {
  const pairings = [
    ["מקום 1 בית A", "מקום 2 בית B"],
    ["מקום 1 בית C", "מקום 2 בית D"],
    ["מקום 1 בית E", "מקום 2 בית F"],
    ["מקום 1 בית G", "מקום 2 בית H"],
    ["מקום 1 בית I", "מקום 2 בית J"],
    ["מקום 1 בית K", "מקום 2 בית L"],
    ["מקום 1 בית B", "מקום 3 מצטיינת"],
    ["מקום 1 בית D", "מקום 3 מצטיינת"],
    ["מקום 1 בית F", "מקום 3 מצטיינת"],
    ["מקום 1 בית H", "מקום 3 מצטיינת"],
    ["מקום 1 בית J", "מקום 3 מצטיינת"],
    ["מקום 1 בית L", "מקום 3 מצטיינת"],
    ["מקום 2 בית A", "מקום 2 בית C"],
    ["מקום 2 בית E", "מקום 2 בית G"],
    ["מקום 2 בית I", "מקום 2 בית K"],
    ["מקום 3 מצטיינת", "מקום 3 מצטיינת"],
  ];

  return pairings.map(([teamOne, teamTwo], index) =>
    createDerivedMatch({
      id: `generated-round32-${index + 1}`,
      matchNumber: 49 + index,
      round: "round32",
      teamOne: createPositionTeam(teamOne),
      teamTwo: createPositionTeam(teamTwo),
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
    const teamOne = getKnownWinner(pair[0]) ?? createWinnerReference(pair[0]);
    const teamTwo = getKnownWinner(pair[1]) ?? createWinnerReference(pair[1]);

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
      matchNumber: 63,
      round: "thirdPlace",
      teamOne: getKnownLoser(semiPair[0]) ?? createLoserReference(semiPair[0]),
      teamTwo: getKnownLoser(semiPair[1]) ?? createLoserReference(semiPair[1]),
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
    statusText: "יעודכן אוטומטית",
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
      logo: match.homeLogo,
      name: match.home,
      score: match.homeScore,
      winner: homeWinner,
    },
    teamTwo: {
      flag: getTeamFlag(match.away),
      logo: match.awayLogo,
      name: match.away,
      score: match.awayScore,
      winner: awayWinner,
    },
  };
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
    logo: team.logo,
    name: team.name,
    score: null,
    winner: false,
  };
}

function getKnownWinner(match?: BracketMatch): BracketTeam | null {
  if (!match) return null;
  if (match.teamOne.winner) return { ...match.teamOne, score: null, winner: false };
  if (match.teamTwo.winner) return { ...match.teamTwo, score: null, winner: false };
  if (match.teamOne.score !== null && match.teamTwo.score !== null) {
    return match.teamOne.score >= match.teamTwo.score
      ? { ...match.teamOne, score: null, winner: false }
      : { ...match.teamTwo, score: null, winner: false };
  }
  return null;
}

function getKnownLoser(match?: BracketMatch): BracketTeam | null {
  if (!match) return null;
  const winner = getKnownWinner(match);
  if (!winner) return null;
  const loser = match.teamOne.name === winner.name ? match.teamTwo : match.teamOne;
  return { ...loser, score: null, winner: false };
}

function createPositionTeam(name: string): BracketTeam {
  return {
    flag: "•",
    name,
    score: null,
    winner: false,
  };
}

function createWinnerReference(match?: BracketMatch): BracketTeam {
  return createPositionTeam(match ? `מנצחת משחק ${match.matchNumber}` : "מנצחת משחק");
}

function createLoserReference(match?: BracketMatch): BracketTeam {
  return createPositionTeam(match ? `מפסידת משחק ${match.matchNumber}` : "מפסידת משחק");
}

function buildGroupCards(teams: AppTeam[]) {
  return GROUP_NAMES.map((group) => {
    const groupTeams = teams.filter((team) => team.group === group);

    return {
      name: group,
      hebrewName: toHebrewGroupName(group),
      teams: sortGroupTeams(groupTeams).map(toBracketTeam),
    };
  }).filter((group) => group.teams.length > 0);
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
