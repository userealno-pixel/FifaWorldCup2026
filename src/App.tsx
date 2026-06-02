import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  createApiFootballStatus,
  getSharedApiCache,
  syncFixturesWithApp,
  type ApiFootballStatus,
  type AppMatch,
  type AppMatchStatus,
  type AppTeam,
} from "./services/apiFootball";
import { TournamentBracket } from "./components/TournamentBracket";

type Tab =
  | "schedule"
  | "bracket"
  | "groupStage"
  | "knockoutStage"
  | "participants"
  | "finalPrediction"
  | "adminPanel";

type Team = AppTeam;
type Match = AppMatch;
type MatchStatus = AppMatchStatus;

type Participant = {
  id: number;
  name: string;
  winnerPick: string;
  points: number;
};

const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD ?? "123456";

// Local-only protection for this prototype. Production admin access must move
// to real server-side auth such as Firebase Auth or Supabase Auth before launch.
// Keep the local test password out of the UI. Configure VITE_ADMIN_PASSWORD for deployments.

const navItems: { id: Tab; label: string }[] = [
  { id: "schedule", label: "לוח משחקים" },
  { id: "bracket", label: "תרשים הטורניר" },
  { id: "groupStage", label: "שלב הבתים" },
  { id: "knockoutStage", label: "שלב הנוקאאוט" },
  { id: "participants", label: "טבלת משתתפים" },
  { id: "finalPrediction", label: "תחזית לזוכה" },
  { id: "adminPanel", label: "פאנל ניהול" },
];

const LIVE_REFRESH_MS = 5_000;
const SLOWED_LIVE_REFRESH_MS = 60_000;
const NO_LIVE_REFRESH_MS = 10 * 60_000;
const API_RETRY_MS = 60_000;
const KNOCKOUT_ROUND_ORDER = [
  "Round of 32",
  "Round of 16",
  "Quarter-finals",
  "Semi-finals",
  "Third place match",
  "Final",
];

const ui = {
  appTitle: "פלטפורמת תחזיות לקריאה בלבד",
  appIntro: "משתמשים ציבוריים יכולים לצפות בלוח המשחקים, תוצאות חיות, משתתפים ותחזיות לזוכה במונדיאל. שינויים מנוהלים רק דרך פאנל המנהל.",
  matchesLoaded: "משחקים נטענו",
  live: "חי",
  teamsEliminated: "נבחרות הודחו",
  participants: "משתתפים",
  eliminated: "הודחו",
  winnerPredictions: "תחזיות לזוכה",
  loading: "טוען",
  match: "משחק",
  connected: "מחובר",
  lastUpdated: "עודכן לאחרונה",
  refreshInterval: "תדירות רענון",
  usageClose: "שימוש קרוב למגבלה היומית",
  requestsToday: "בקשות היום",
  readOnly: "קריאה בלבד",
  loadingFixtures: "טוען נתוני מונדיאל 2026...",
  matches: "משחקים",
  noApiData: "אין נתוני API",
  worldCupSchedule: "לוח משחקי מונדיאל 2026",
  localTime: "שעון ישראל",
  advancing: "עולות",
  rank: "דירוג",
  team: "נבחרת",
  pts: "נק'",
  pld: "מש'",
  wins: "נצ'",
  draws: "תיקו",
  losses: "הפ'",
  gf: "זכות",
  ga: "חובה",
  gd: "הפרש",
  advance: "עלייה",
  pending: "ממתין",
  scheduled: "מתוכנן",
  final: "הסתיים",
  finished: "הסתיים",
  active: "פעיל",
  standingsUnavailable: "טבלת הבית עדיין לא זמינה.",
  fixturesNotPublished: "המשחקים הרשמיים עדיין לא פורסמו ב-API-Football.",
  advances: "עולה",
  fixtures: "משחקים",
  tbd: "ייקבע בהמשך",
  groupStage: "שלב הבתים",
  knockoutStage: "שלב הנוקאאוט",
  roundOf32: "שלב 32 האחרונות",
  roundOf16: "שמינית הגמר",
  quarterFinals: "רבע הגמר",
  semiFinals: "חצי הגמר",
  thirdPlaceMatch: "משחק על המקום השלישי",
  apiFootball: "API-Football",
  apiConnected: "API-Football מחובר",
  apiReadyToConnect: "API-Football מוכן להתחברות",
  apiKeyNotConnected: "API key is not connected yet",
  apiUnavailable: "API-Football אינו זמין כרגע",
  activeParticipants: "משתתפים פעילים",
  eliminatedParticipants: "משתתפים שהודחו",
  noParticipants: "אין משתתפים עדיין. מנהלים יכולים להוסיף משתתפים לאחר התחברות.",
  name: "שם",
  winnerPick: "בחירת זוכה",
  points: "נקודות",
  status: "סטטוס",
  finalPrediction: "תחזית לזוכה",
  password: "סיסמה",
  enterAdminPassword: "הזן סיסמת מנהל",
  login: "התחברות",
  logout: "התנתקות",
  incorrectPassword: "סיסמת מנהל שגויה.",
  protected: "מוגן",
  adminOnly: "מנהל בלבד",
  adminPanel: "פאנל ניהול",
  addParticipant: "הוספת משתתף",
  editParticipant: "עריכת משתתף",
  teamsUnavailable: "מפתח API לא מחובר, לכן הנבחרות לא זמינות.",
  matchesUnavailable: "מפתח API לא מחובר, לכן המשחקים לא זמינים.",
  saveParticipant: "שמירת משתתף",
  manualScoreUpdate: "עדכון תוצאה ידני",
  home: "בית",
  away: "חוץ",
  updateScore: "עדכון תוצאה",
  eliminateTeam: "סימון נבחרת כהודחה",
  markEliminated: "סמן כהודחה",
  eliminationRule: "משתתפים שבחרו בנבחרת זו יועברו אוטומטית להדחה.",
  manageParticipants: "ניהול משתתפים",
  edit: "עריכה",
  delete: "מחיקה",
  apiDebugStatus: "סטטוס API",
  baseUrl: "כתובת בסיס",
  header: "כותרת",
  apiKeyLoaded: "מפתח API נטען מ-.env",
  yes: "כן",
  no: "לא",
  liveEndpointChecked: "נקודת live נבדקה",
  todaysScheduledMatches: "משחקים מתוכננים היום",
  lastEndpoint: "נקודת API אחרונה",
  nextRefresh: "רענון הבא",
  dataSource: "מקור נתונים",
  groupStageDataSource: "מקור נתוני שלב הבתים",
  groupValidation: "בדיקת שלב הבתים",
  validationOk: "לא נמצאו בעיות בקבוצות.",
  duplicateTeamGroupWarning: "נבחרת מופיעה ביותר מבית אחד",
  groupSizeWarning: "מספר נבחרות לא תקין בבית",
  wrongMatchGroupWarning: "משחק משויך לבית שגוי",
  exactApiError: "שגיאת API מדויקת",
  none: "אין",
  adminDataNote: "נתוני מנהל נשמרים כרגע ב-React state מקומי. לפני פרודקשן יש להעביר אותם ל-Firebase, Supabase או Backend.",
} as const;

function formatScore(match: Match) {
  return match.homeScore === null || match.awayScore === null
    ? ui.pending
    : `${match.homeScore} - ${match.awayScore}`;
}

function getMatchLabel(match: Match) {
  return `${match.home} vs ${match.away}`;
}

function getRefreshInterval(matches: Match[], apiStatus: ApiFootballStatus) {
  if (apiStatus.retryCount > 0 || (!apiStatus.connected && apiStatus.apiKeyLoaded)) {
    return API_RETRY_MS;
  }

  const hasLiveMatches = matches.some((match) => match.status === "live");

  if (hasLiveMatches) {
    return apiStatus.usageCloseToLimit ? SLOWED_LIVE_REFRESH_MS : LIVE_REFRESH_MS;
  }

  return NO_LIVE_REFRESH_MS;
}

function formatDateTime(value: string) {
  if (!value) return ui.pending;

  return new Intl.DateTimeFormat("he-IL", {
    dateStyle: "medium",
    timeStyle: "medium",
    timeZone: "Asia/Jerusalem",
  }).format(new Date(value));
}

function formatMatchDateTime(match: Match) {
  const date = new Date(match.timestamp * 1000);

  if (Number.isNaN(date.getTime())) {
    return `${match.date} · ${match.localTime}`;
  }

  return new Intl.DateTimeFormat("he-IL", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Jerusalem",
  }).format(date);
}

function formatDuration(ms: number) {
  const safeMs = Math.max(0, ms);
  const totalSeconds = Math.ceil(safeMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

function translateStatus(status: MatchStatus) {
  if (status === "live") return ui.live;
  if (status === "final") return ui.final;
  return ui.scheduled;
}

function translateStatusText(statusText: string) {
  const normalized = statusText.toLowerCase();

  if (normalized.includes("not started") || normalized.includes("scheduled")) return ui.scheduled;
  if (normalized.includes("finished") || normalized.includes("final")) return ui.finished;
  if (normalized.includes("live") || normalized.includes("progress")) return ui.live;
  return statusText;
}

function translateRound(round: string) {
  const normalized = normalizeRoundLabel(round);

  if (normalized === "Round of 32") return ui.roundOf32;
  if (normalized === "Round of 16") return ui.roundOf16;
  if (normalized === "Quarter-finals") return ui.quarterFinals;
  if (normalized === "Semi-finals") return ui.semiFinals;
  if (normalized === "Third place match") return ui.thirdPlaceMatch;
  if (normalized === "Final") return ui.final;
  if (round.toLowerCase().includes("group")) return ui.groupStage;
  return round;
}

function translateApiMessage(message: string) {
  if (message === "API-Football connected") return ui.apiConnected;
  if (message === "API-Football ready to connect") return ui.apiReadyToConnect;
  if (message === "API key is not connected yet") return ui.apiKeyNotConnected;
  if (message === "API-Football is not available right now") return ui.apiUnavailable;
  return message;
}

export function App() {
  const [activeTab, setActiveTab] = useState<Tab>("schedule");
  const [teams, setTeams] = useState<Team[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [adminLoggedIn, setAdminLoggedIn] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [apiStatus, setApiStatus] = useState<ApiFootballStatus>(
    createApiFootballStatus({ loading: true }),
  );
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    document.documentElement.dir = "rtl";
    document.documentElement.lang = "he";
  }, []);

  useEffect(() => {
    let isMounted = true;
    let timeoutId: number | undefined;

    function applyFixtures(nextMatches: Match[], nextTeams: Team[]) {
      setMatches(nextMatches);
      setTeams((currentTeams) =>
        nextTeams.map((team) => ({
          ...team,
          status:
            currentTeams.find((currentTeam) => currentTeam.name === team.name)?.status ??
            team.status,
        })),
      );
    }

    function scheduleNext(nextMatches: Match[], nextStatus: ApiFootballStatus) {
      const refreshIntervalMs = getRefreshInterval(nextMatches, nextStatus);
      const nextRefreshAt = new Date(Date.now() + refreshIntervalMs).toISOString();
      const scheduledStatus = {
        ...nextStatus,
        loading: false,
        nextRefreshAt,
        refreshIntervalMs,
      };

      setApiStatus(scheduledStatus);
      timeoutId = window.setTimeout(syncData, refreshIntervalMs);
    }

    async function syncData() {
      setApiStatus((current) => ({ ...current, loading: true }));
      const result = await syncFixturesWithApp();
      if (!isMounted) return;

      applyFixtures(result.fixtures, result.teams);
      scheduleNext(result.fixtures, result.status);
    }

    const cachedResult = getSharedApiCache();
    if (cachedResult) {
      applyFixtures(cachedResult.fixtures, cachedResult.teams);
      scheduleNext(cachedResult.fixtures, cachedResult.status);
    } else {
      syncData();
    }

    return () => {
      isMounted = false;
      if (timeoutId) window.clearTimeout(timeoutId);
    };
  }, []);

  useEffect(() => {
    const intervalId = window.setInterval(() => setNow(Date.now()), 1000);

    return () => window.clearInterval(intervalId);
  }, []);

  const activeParticipants = useMemo(
    () =>
      participants.filter(
        (participant) =>
          teams.find((team) => team.name === participant.winnerPick)?.status !== "eliminated",
      ),
    [participants, teams],
  );
  const eliminatedParticipants = useMemo(
    () =>
      participants.filter(
        (participant) =>
          teams.find((team) => team.name === participant.winnerPick)?.status === "eliminated",
      ),
    [participants, teams],
  );
  const liveMatches = matches.filter((match) => match.status === "live");
  const eliminatedTeams = teams.filter((team) => team.status === "eliminated");
  const nextRefreshInMs = apiStatus.nextRefreshAt
    ? new Date(apiStatus.nextRefreshAt).getTime() - now
    : 0;
  function handleLogin(password: string) {
    if (password === ADMIN_PASSWORD) {
      setAdminLoggedIn(true);
      setLoginError("");
      setActiveTab("adminPanel");
      return;
    }

    setLoginError(ui.incorrectPassword);
  }

  return (
    <main className="app-shell" dir="rtl" lang="he">
      <section className="hero" aria-labelledby="page-title">
        <div className="hero-copy">
          <p className="eyebrow">FIFA World Cup 2026</p>
          <h1 id="page-title">{ui.appTitle}</h1>
          <p>{ui.appIntro}</p>
        </div>

        <div className="hero-panel" aria-label="Platform snapshot">
          <span className="status-dot" />
          <div>
            <strong>{matches.length} {ui.matchesLoaded}</strong>
            <span>{liveMatches.length} {ui.live} · {eliminatedTeams.length} {ui.teamsEliminated}</span>
          </div>
        </div>
      </section>

      <nav className="tabs" aria-label="אזורי פלטפורמת התחזיות">
        {navItems.map((item) => (
          <button
            key={item.id}
            className={activeTab === item.id ? "active" : ""}
            type="button"
            onClick={() => setActiveTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </nav>

      {activeTab === "schedule" && (
        <MatchScheduleView
          apiStatus={apiStatus}
          matches={matches}
        />
      )}
      {activeTab === "bracket" && (
        <TournamentBracket matches={matches} teams={teams} />
      )}
      {activeTab === "groupStage" && (
        <GroupStageView apiStatus={apiStatus} matches={matches} teams={teams} />
      )}
      {activeTab === "knockoutStage" && (
        <KnockoutStageView apiStatus={apiStatus} matches={matches} />
      )}
      {activeTab === "participants" && (
        <ParticipantsView
          activeParticipants={activeParticipants}
          eliminatedParticipants={eliminatedParticipants}
        />
      )}
      {activeTab === "finalPrediction" && (
        <FinalPredictionView
          activeParticipants={activeParticipants}
          eliminatedParticipants={eliminatedParticipants}
          teams={teams}
        />
      )}
      {activeTab === "adminPanel" && (
        <AdminPanel
          adminLoggedIn={adminLoggedIn}
          loginError={loginError}
          matches={matches}
          onLogin={handleLogin}
          participants={participants}
          apiStatus={apiStatus}
          nextRefreshInMs={nextRefreshInMs}
          setAdminLoggedIn={setAdminLoggedIn}
          setMatches={setMatches}
          setParticipants={setParticipants}
          setTeams={setTeams}
          teams={teams}
        />
      )}
    </main>
  );
}

function MatchScheduleView({
  apiStatus,
  matches,
}: {
  apiStatus: ApiFootballStatus;
  matches: Match[];
}) {
  if (matches.length === 0) {
    return (
      <section className="table-panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">{ui.matches}</p>
            <h2>{ui.worldCupSchedule}</h2>
          </div>
          <span className="status-badge eliminated">{ui.noApiData}</span>
        </div>
        <p className="empty-state">
          {apiStatus.loading ? ui.loadingFixtures : translateApiMessage(apiStatus.message)}
        </p>
      </section>
    );
  }

  return (
    <section className="content-grid matches-grid">
      {matches.map((match) => (
        <article className="match-card" key={match.id}>
          <div className="card-topline">
            <span className={`pill ${match.status}`}>{translateStatus(match.status)}</span>
            <span>{translateRound(match.round)}</span>
          </div>
          <div className="scoreboard">
            <TeamScore team={match.home} score={match.homeScore} />
            <span className="time">{formatScore(match)}</span>
            <TeamScore team={match.away} score={match.awayScore} />
          </div>
          <p className="muted">
            {formatMatchDateTime(match)} · {ui.localTime} · {translateStatusText(match.statusText)}
          </p>
          <p className="muted">
            {match.stadium}, {match.city}
          </p>
        </article>
      ))}
    </section>
  );
}

function TeamScore({ team, score }: { team: string; score: number | null }) {
  return (
    <div className="team-score">
      <strong>{team}</strong>
      <span>{score ?? "-"}</span>
    </div>
  );
}

function GroupStageView({
  apiStatus,
  matches,
  teams,
}: {
  apiStatus: ApiFootballStatus;
  matches: Match[];
  teams: Team[];
}) {
  const groupMatches = matches.filter((match) => match.stage === "group");
  const groupNames = Array.from(
    new Set([...teams.map((team) => team.group), ...groupMatches.map((match) => match.group)]),
  )
    .filter((group) => /^Group\s+[A-L]$/i.test(group))
    .sort(compareGroupLabels);
  const visibleGroups = groupNames.length > 0 ? groupNames : ["All"];

  if (matches.length === 0) {
    return <ApiEmptyPanel apiStatus={apiStatus} title={ui.groupStage} />;
  }

  return (
    <section className="stacked-panels">
      {visibleGroups.map((group) => {
        const groupTeams = teams.filter((team) => team.group === group);
        const fixtures =
          group === "All"
            ? groupMatches
            : groupMatches.filter((match) => match.group === group);

        return (
          <section className="table-panel" key={group}>
            <div className="section-heading">
              <div>
                <p className="eyebrow">{ui.groupStage}</p>
                <h2>{group}</h2>
              </div>
              <span className="status-badge active">
                {groupTeams.filter((team) => team.advanced).length} {ui.advancing}
              </span>
            </div>

            <div className="group-layout">
              {groupTeams.length > 0 ? (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>{ui.rank}</th>
                        <th>{ui.team}</th>
                        <th>{ui.pts}</th>
                        <th>{ui.pld}</th>
                        <th>{ui.wins}</th>
                        <th>{ui.draws}</th>
                        <th>{ui.losses}</th>
                        <th>{ui.gf}</th>
                        <th>{ui.ga}</th>
                        <th>{ui.gd}</th>
                        <th>{ui.advance}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {groupTeams.map((team) => (
                        <tr key={team.name}>
                          <td>{team.rank ?? "-"}</td>
                          <td>{team.name}</td>
                          <td>{team.points ?? "-"}</td>
                          <td>{team.played ?? "-"}</td>
                          <td>{team.wins ?? "-"}</td>
                          <td>{team.draws ?? "-"}</td>
                          <td>{team.losses ?? "-"}</td>
                          <td>{team.goalsFor ?? "-"}</td>
                          <td>{team.goalsAgainst ?? "-"}</td>
                          <td>{team.goalDifference ?? "-"}</td>
                          <td>
                            <span className={`status-badge ${team.advanced ? "active" : "eliminated"}`}>
                              {team.advanced ? ui.advancing : ui.pending}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="empty-state">{ui.standingsUnavailable}</p>
              )}

              <div className="mini-fixtures">
                {fixtures.map((match) => (
                  <CompactMatch match={match} key={match.id} />
                ))}
              </div>
            </div>
          </section>
        );
      })}
    </section>
  );
}

function KnockoutStageView({
  apiStatus,
  matches,
}: {
  apiStatus: ApiFootballStatus;
  matches: Match[];
}) {
  const knockoutMatches = getOrderedKnockoutMatches(matches);

  if (matches.length === 0) {
    return <ApiEmptyPanel apiStatus={apiStatus} title={ui.knockoutStage} />;
  }

  return (
    <section className="stacked-panels">
      {KNOCKOUT_ROUND_ORDER.map((round) => {
        const roundMatches = knockoutMatches.filter((match) => normalizeRoundLabel(match.round) === round);

        return (
          <section className="table-panel" key={round}>
            <div className="section-heading">
              <div>
                <p className="eyebrow">{ui.knockoutStage}</p>
                <h2>{translateRound(round)}</h2>
              </div>
              <span className="status-badge active">{roundMatches.length} {ui.fixtures}</span>
            </div>

            {roundMatches.length === 0 ? (
              <p className="empty-state">{ui.fixturesNotPublished}</p>
            ) : (
              <div className="content-grid matches-grid knockout-round-list">
                {roundMatches.map((match) => (
                  <article className="match-card" key={match.id}>
                    <div className="card-topline">
                      <span className={`pill ${match.status}`}>{translateStatus(match.status)}</span>
                      <span>{translateRound(match.round)}</span>
                    </div>
                    <div className="scoreboard">
                      <TeamScore team={match.home} score={match.homeScore} />
                      <span className="time">{formatScore(match)}</span>
                      <TeamScore team={match.away} score={match.awayScore} />
                    </div>
                    <p className="muted">
                      {formatMatchDateTime(match)} · {ui.localTime} · {translateStatusText(match.statusText)}
                    </p>
                    <p className="muted">
                      {ui.advances}: {getAdvancingTeam(match) ?? ui.tbd}
                    </p>
                  </article>
                ))}
              </div>
            )}
          </section>
        );
      })}
    </section>
  );
}

function CompactMatch({ match }: { match: Match }) {
  return (
    <article className="fixture-row">
      <strong>{getMatchLabel(match)}</strong>
      <span>{formatScore(match)} · {translateStatusText(match.statusText)}</span>
      <small>{formatMatchDateTime(match)} · {ui.localTime}</small>
    </article>
  );
}

function ApiEmptyPanel({
  apiStatus,
  title,
}: {
  apiStatus: ApiFootballStatus;
  title: string;
}) {
  return (
    <section className="table-panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">{ui.apiFootball}</p>
          <h2>{title}</h2>
        </div>
        <span className="status-badge eliminated">{ui.noApiData}</span>
      </div>
      <p className="empty-state">
        {apiStatus.loading ? ui.loadingFixtures : translateApiMessage(apiStatus.message)}
      </p>
    </section>
  );
}

function getOrderedKnockoutMatches(matches: Match[]) {
  return matches
    .filter((match) => match.stage === "knockout")
    .sort((first, second) => {
      const firstRound = KNOCKOUT_ROUND_ORDER.indexOf(normalizeRoundLabel(first.round));
      const secondRound = KNOCKOUT_ROUND_ORDER.indexOf(normalizeRoundLabel(second.round));

      return firstRound - secondRound || first.timestamp - second.timestamp;
    });
}

function getAdvancingTeam(match: Match) {
  if (match.homeWinner) return match.home;
  if (match.awayWinner) return match.away;
  return null;
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

function compareGroupLabels(firstGroup: string, secondGroup: string) {
  return getGroupIndex(firstGroup) - getGroupIndex(secondGroup);
}

function getGroupIndex(group: string) {
  const match = group.match(/Group\s+([A-L])/i);

  return match ? match[1].toUpperCase().charCodeAt(0) : 999;
}

function validateGroupStageData(teams: Team[], matches: Match[]) {
  const warnings: string[] = [];
  const teamGroups = new Map<string, Set<string>>();

  teams
    .filter((team) => /^Group\s+[A-L]$/i.test(team.group))
    .forEach((team) => {
      teamGroups.set(team.name, new Set([...(teamGroups.get(team.name) ?? []), team.group]));
    });

  teamGroups.forEach((groups, teamName) => {
    if (groups.size > 1) {
      warnings.push(`${ui.duplicateTeamGroupWarning}: ${teamName} (${Array.from(groups).join(", ")})`);
    }
  });

  const groupNames = Array.from(
    new Set([
      ...teams.map((team) => team.group),
      ...matches.filter((match) => match.stage === "group").map((match) => match.group),
    ]),
  )
    .filter((group) => /^Group\s+[A-L]$/i.test(group))
    .sort(compareGroupLabels);

  groupNames.forEach((group) => {
    const groupTeams = teams.filter((team) => team.group === group);

    if (groupTeams.length !== 4) {
      warnings.push(`${ui.groupSizeWarning}: ${group} (${groupTeams.length}/4)`);
    }
  });

  matches
    .filter((match) => match.stage === "group")
    .forEach((match) => {
      const homeGroup = teams.find((team) => team.name === match.home)?.group;
      const awayGroup = teams.find((team) => team.name === match.away)?.group;

      if (!homeGroup || !awayGroup || homeGroup !== awayGroup || match.group !== homeGroup) {
        warnings.push(
          `${ui.wrongMatchGroupWarning}: ${getMatchLabel(match)} (${match.group}; ${homeGroup ?? ui.pending}/${awayGroup ?? ui.pending})`,
        );
      }
    });

  return warnings;
}

function ParticipantsView({
  activeParticipants,
  eliminatedParticipants,
}: {
  activeParticipants: Participant[];
  eliminatedParticipants: Participant[];
}) {
  return (
    <section className="stacked-panels">
      <ParticipantSection participants={activeParticipants} status="active" title={ui.activeParticipants} />
      <ParticipantSection participants={eliminatedParticipants} status="eliminated" title={ui.eliminatedParticipants} />
    </section>
  );
}

function ParticipantSection({
  title,
  participants,
  status,
}: {
  title: string;
  participants: Participant[];
  status: "active" | "eliminated";
}) {
  const statusLabel = status === "active" ? ui.active : ui.eliminated;

  return (
    <section className="table-panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">{ui.participants}</p>
          <h2>{title}</h2>
        </div>
        <span className={`status-badge ${status}`}>{participants.length} {statusLabel}</span>
      </div>

      {participants.length === 0 ? (
        <p className="empty-state">{ui.noParticipants}</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{ui.name}</th>
                <th>{ui.winnerPick}</th>
                <th>{ui.points}</th>
              </tr>
            </thead>
            <tbody>
              {participants.map((participant) => (
                <tr key={participant.id}>
                  <td>{participant.name}</td>
                  <td>{participant.winnerPick}</td>
                  <td>{participant.points}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function FinalPredictionView({
  activeParticipants,
  eliminatedParticipants,
  teams,
}: {
  activeParticipants: Participant[];
  eliminatedParticipants: Participant[];
  teams: Team[];
}) {
  const participants = [...activeParticipants, ...eliminatedParticipants];

  return (
    <section className="table-panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">{ui.winnerPredictions}</p>
          <h2>{ui.finalPrediction}</h2>
        </div>
        <span className="status-badge active">{ui.readOnly}</span>
      </div>

      {participants.length === 0 ? (
        <p className="empty-state">{ui.noParticipants}</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{ui.name}</th>
                <th>{ui.winnerPick}</th>
                <th>{ui.status}</th>
              </tr>
            </thead>
            <tbody>
              {participants.map((participant) => {
                const pickedTeam = teams.find((team) => team.name === participant.winnerPick);
                const eliminated = pickedTeam?.status === "eliminated";

                return (
                  <tr key={participant.id}>
                    <td>{participant.name}</td>
                    <td>{participant.winnerPick}</td>
                    <td>
                      <span className={`status-badge ${eliminated ? "eliminated" : "active"}`}>
                        {eliminated ? ui.eliminated : ui.active}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function AdminPanel({
  apiStatus,
  adminLoggedIn,
  loginError,
  matches,
  nextRefreshInMs,
  onLogin,
  participants,
  setAdminLoggedIn,
  setMatches,
  setParticipants,
  setTeams,
  teams,
}: {
  apiStatus: ApiFootballStatus;
  adminLoggedIn: boolean;
  loginError: string;
  matches: Match[];
  nextRefreshInMs: number;
  onLogin: (password: string) => void;
  participants: Participant[];
  setAdminLoggedIn: (value: boolean) => void;
  setMatches: React.Dispatch<React.SetStateAction<Match[]>>;
  setParticipants: React.Dispatch<React.SetStateAction<Participant[]>>;
  setTeams: React.Dispatch<React.SetStateAction<Team[]>>;
  teams: Team[];
}) {
  const firstTeamName = teams[0]?.name ?? "";
  const firstMatchId = matches[0]?.id ?? 0;
  const [adminPasswordInput, setAdminPasswordInput] = useState("");
  const [participantName, setParticipantName] = useState("");
  const [participantPick, setParticipantPick] = useState(firstTeamName);
  const [editingParticipantId, setEditingParticipantId] = useState<number | null>(null);
  const [scoreMatchId, setScoreMatchId] = useState(firstMatchId);
  const [homeScore, setHomeScore] = useState("");
  const [awayScore, setAwayScore] = useState("");
  const [scoreStatus, setScoreStatus] = useState<MatchStatus>("scheduled");
  const [teamToEliminate, setTeamToEliminate] = useState(firstTeamName);
  const groupValidationWarnings = useMemo(
    () => validateGroupStageData(teams, matches),
    [matches, teams],
  );

  useEffect(() => {
    if (!participantPick && firstTeamName) setParticipantPick(firstTeamName);
    if (!teamToEliminate && firstTeamName) setTeamToEliminate(firstTeamName);
    if (!scoreMatchId && firstMatchId) setScoreMatchId(firstMatchId);
  }, [
    firstMatchId,
    firstTeamName,
    participantPick,
    scoreMatchId,
    teamToEliminate,
  ]);

  if (!adminLoggedIn) {
    function submitLogin(event: FormEvent<HTMLFormElement>) {
      event.preventDefault();
      onLogin(adminPasswordInput);
      setAdminPasswordInput("");
    }

    return (
      <section className="admin-layout login-panel">
        <p className="eyebrow">{ui.protected}</p>
        <h2>{ui.adminPanel}</h2>
        <form className="admin-card" onSubmit={submitLogin}>
          <label>
            {ui.password}
            <input
              type="password"
              value={adminPasswordInput}
              onChange={(event) => setAdminPasswordInput(event.target.value)}
              placeholder={ui.enterAdminPassword}
            />
          </label>
          {loginError ? <p className="error-text">{loginError}</p> : null}
          <button type="submit">{ui.login}</button>
        </form>
      </section>
    );
  }

  function saveParticipant(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!participantName.trim()) return;

    if (editingParticipantId !== null) {
      setParticipants((current) =>
        current.map((participant) =>
          participant.id === editingParticipantId
            ? {
                ...participant,
                name: participantName.trim(),
                winnerPick: participantPick,
              }
            : participant,
        ),
      );
      setEditingParticipantId(null);
    } else {
      setParticipants((current) => [
        ...current,
        {
          id: Date.now(),
          name: participantName.trim(),
          winnerPick: participantPick,
          points: 0,
        },
      ]);
    }

    setParticipantName("");
    setParticipantPick(firstTeamName);
  }

  function editParticipant(participant: Participant) {
    setEditingParticipantId(participant.id);
    setParticipantName(participant.name);
    setParticipantPick(participant.winnerPick);
  }

  function deleteParticipant(id: number) {
    setParticipants((current) => current.filter((participant) => participant.id !== id));
  }

  function updateScore(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMatches((current) =>
      current.map((match) =>
        match.id === scoreMatchId
          ? {
              ...match,
              status: scoreStatus,
              homeScore: homeScore === "" ? null : Number(homeScore),
              awayScore: awayScore === "" ? null : Number(awayScore),
            }
          : match,
      ),
    );
  }

  function markEliminated(teamName: string) {
    setTeams((current) =>
      current.map((team) =>
        team.name === teamName ? { ...team, status: "eliminated" } : team,
      ),
    );
  }

  return (
    <section className="admin-layout" aria-labelledby="admin-heading">
      <div className="section-heading">
        <div>
          <p className="eyebrow">{ui.adminOnly}</p>
          <h2 id="admin-heading">{ui.adminPanel}</h2>
        </div>
        <button className="secondary-button" type="button" onClick={() => setAdminLoggedIn(false)}>
          {ui.logout}
        </button>
      </div>

      <div className="admin-grid">
        <form className="admin-card" onSubmit={saveParticipant}>
          <h3>{editingParticipantId === null ? ui.addParticipant : ui.editParticipant}</h3>
          {teams.length === 0 ? (
            <p className="empty-state">{ui.teamsUnavailable}</p>
          ) : null}
          <label>
            {ui.name}
            <input value={participantName} onChange={(event) => setParticipantName(event.target.value)} />
          </label>
          <label>
            {ui.winnerPick}
            <select value={participantPick} onChange={(event) => setParticipantPick(event.target.value)}>
              {teams.map((team) => (
                <option key={team.name}>{team.name}</option>
              ))}
            </select>
          </label>
          <button type="submit" disabled={teams.length === 0}>{ui.saveParticipant}</button>
        </form>

        <form className="admin-card" onSubmit={updateScore}>
          <h3>{ui.manualScoreUpdate}</h3>
          {matches.length === 0 ? (
            <p className="empty-state">{ui.matchesUnavailable}</p>
          ) : null}
          <label>
            {ui.match}
            <select value={scoreMatchId} onChange={(event) => setScoreMatchId(Number(event.target.value))}>
              {matches.map((match) => (
                <option key={match.id} value={match.id}>{getMatchLabel(match)}</option>
              ))}
            </select>
          </label>
          <div className="score-inputs">
            <label>
              {ui.home}
              <input type="number" min="0" value={homeScore} onChange={(event) => setHomeScore(event.target.value)} />
            </label>
            <label>
              {ui.away}
              <input type="number" min="0" value={awayScore} onChange={(event) => setAwayScore(event.target.value)} />
            </label>
          </div>
          <label>
            {ui.status}
            <select value={scoreStatus} onChange={(event) => setScoreStatus(event.target.value as MatchStatus)}>
              <option value="scheduled">{ui.scheduled}</option>
              <option value="live">{ui.live}</option>
              <option value="final">{ui.final}</option>
            </select>
          </label>
          <button type="submit" disabled={matches.length === 0}>{ui.updateScore}</button>
        </form>

        <div className="admin-card">
          <h3>{ui.eliminateTeam}</h3>
          {teams.length === 0 ? (
            <p className="empty-state">{ui.teamsUnavailable}</p>
          ) : null}
          <label>
            {ui.team}
            <select value={teamToEliminate} onChange={(event) => setTeamToEliminate(event.target.value)}>
              {teams.map((team) => (
                <option key={team.name}>{team.name}</option>
              ))}
            </select>
          </label>
          <button type="button" disabled={teams.length === 0} onClick={() => markEliminated(teamToEliminate)}>
            {ui.markEliminated}
          </button>
          <p className="rule-note">{ui.eliminationRule}</p>
        </div>

        <div className="admin-card audit-card">
          <h3>{ui.manageParticipants}</h3>
          {participants.length === 0 ? (
            <p className="muted">{ui.noParticipants}</p>
          ) : (
            <ul>
              {participants.map((participant) => (
                <li key={participant.id}>
                  <span>{participant.name} · {participant.winnerPick}</span>
                  <div className="inline-actions">
                    <button type="button" onClick={() => editParticipant(participant)}>{ui.edit}</button>
                    <button type="button" onClick={() => deleteParticipant(participant.id)}>{ui.delete}</button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="admin-card api-debug-card">
          <h3>{ui.apiDebugStatus}</h3>
          <dl className="debug-list">
            <div>
              <dt>{ui.baseUrl}</dt>
              <dd>{apiStatus.baseUrl}</dd>
            </div>
            <div>
              <dt>{ui.header}</dt>
              <dd>{apiStatus.headerName}</dd>
            </div>
            <div>
              <dt>{ui.apiKeyLoaded}</dt>
              <dd>{apiStatus.apiKeyLoaded ? ui.yes : ui.no}</dd>
            </div>
            <div>
              <dt>{ui.loading}</dt>
              <dd>{apiStatus.loading ? ui.yes : ui.no}</dd>
            </div>
            <div>
              <dt>{ui.lastUpdated}</dt>
              <dd>{formatDateTime(apiStatus.lastUpdatedAt)}</dd>
            </div>
            <div>
              <dt>{ui.nextRefresh}</dt>
              <dd>{formatDuration(nextRefreshInMs)}</dd>
            </div>
            <div>
              <dt>{ui.refreshInterval}</dt>
              <dd>{formatDuration(apiStatus.refreshIntervalMs)}</dd>
            </div>
            <div>
              <dt>{ui.connected}</dt>
              <dd>{apiStatus.connected ? ui.yes : ui.no}</dd>
            </div>
            <div>
              <dt>{ui.liveEndpointChecked}</dt>
              <dd>{apiStatus.liveEndpointChecked ? ui.yes : ui.no}</dd>
            </div>
            <div>
              <dt>{ui.dataSource}</dt>
              <dd>{apiStatus.source}</dd>
            </div>
            <div>
              <dt>{ui.groupStageDataSource}</dt>
              <dd>{(apiStatus.groupStageDataSources ?? ["Manual group fallback"]).join(" + ")}</dd>
            </div>
            <div>
              <dt>{ui.requestsToday}</dt>
              <dd>{apiStatus.requestCountToday}/{apiStatus.dailyLimit}</dd>
            </div>
            <div>
              <dt>{ui.usageClose}</dt>
              <dd>{apiStatus.usageCloseToLimit ? ui.yes : ui.no}</dd>
            </div>
            <div>
              <dt>{ui.todaysScheduledMatches}</dt>
              <dd>{apiStatus.todaysScheduledMatches}</dd>
            </div>
            <div>
              <dt>{ui.lastEndpoint}</dt>
              <dd>{apiStatus.lastEndpoint}</dd>
            </div>
            <div>
              <dt>{ui.exactApiError}</dt>
              <dd>{apiStatus.lastError || ui.none}</dd>
            </div>
            <div className="debug-wide">
              <dt>{ui.groupValidation}</dt>
              <dd>
                {groupValidationWarnings.length === 0 ? (
                  <span className="success-text">{ui.validationOk}</span>
                ) : (
                  <ul className="debug-warning-list">
                    {groupValidationWarnings.map((warning) => (
                      <li key={warning}>{warning}</li>
                    ))}
                  </ul>
                )}
              </dd>
            </div>
          </dl>
        </div>
      </div>
      <p className="rule-note">
        {ui.adminDataNote}
      </p>
    </section>
  );
}
