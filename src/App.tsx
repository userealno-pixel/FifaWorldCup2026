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
import {
  deleteParticipant,
  fetchParticipants,
  insertParticipant,
  mapParticipantRow,
  supabase,
  updateParticipant,
  type ParticipantRow,
  type StoredParticipant,
} from "./services/supabase";
import { TournamentBracket } from "./components/TournamentBracket";

type Tab =
  | "schedule"
  | "bracket"
  | "groupStage"
  | "knockoutStage"
  | "participants"
  | "adminPanel";

type Team = AppTeam;
type Match = AppMatch;
type MatchStatus = AppMatchStatus;

type Participant = StoredParticipant;

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
  participantCount: "מספר משתתפים",
  liveMatches: "משחקים חיים",
  activeTeams: "קבוצות פעילות",
  nextMatch: "המשחק הבא",
  startsIn: "מתחיל בעוד",
  noUpcomingMatch: "אין משחק קרוב זמין",
  participants: "משתתפים",
  eliminated: "הודחו",
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
  participantsLoading: "טוען משתתפים...",
  databaseError: "שגיאת חיבור למסד הנתונים",
  databaseNotReady: "Supabase עדיין לא מחובר. יש להגדיר VITE_SUPABASE_URL ו-VITE_SUPABASE_ANON_KEY.",
  supabaseConnected: "Supabase מחובר",
  supabaseNotConnected: "Supabase לא מחובר",
  realtimeActive: "סנכרון חי פעיל",
  realtimeInactive: "סנכרון חי לא פעיל",
  supabaseLoadFailed: "טעינת המשתתפים מ-Supabase נכשלה.",
  supabaseSaveFailed: "שמירת המשתתף ב-Supabase נכשלה.",
  supabaseDeleteFailed: "מחיקת המשתתף מ-Supabase נכשלה.",
  name: "שם",
  winnerPick: "בחירת זוכה",
  status: "סטטוס",
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
  adminDataNote: "המשתתפים נשמרים ב-Supabase. לפני פרודקשן יש להחליף את ההגנה המקומית בהרשאות מנהל אמיתיות עם Supabase Auth או Firebase Auth.",
} as const;

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

function formatScore(match: Match) {
  return match.homeScore === null || match.awayScore === null
    ? ui.pending
    : `${match.homeScore} - ${match.awayScore}`;
}

function getMatchLabel(match: Match) {
  return `${match.home} vs ${match.away}`;
}

function getTeamFlag(teamName: string) {
  return FLAG_BY_TEAM[teamName] ?? "🏳";
}

function getTeamLogo(teamName: string, teams: Team[], matchLogo?: string) {
  return matchLogo || teams.find((team) => team.name === teamName)?.logo || "";
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

function formatCountdown(ms: number) {
  const safeMs = Math.max(0, ms);
  const totalMinutes = Math.floor(safeMs / 60_000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) return `${days} ימים ${hours} שעות`;
  if (hours > 0) return `${hours} שעות ${minutes} דקות`;
  return `${minutes} דקות`;
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

function sortParticipantsByCreatedAt(participants: Participant[]) {
  return [...participants].sort(
    (first, second) =>
      new Date(first.createdAt).getTime() - new Date(second.createdAt).getTime(),
  );
}

function upsertParticipant(current: Participant[], nextParticipant: Participant) {
  const participantExists = current.some((participant) => participant.id === nextParticipant.id);

  if (!participantExists) {
    return sortParticipantsByCreatedAt([...current, nextParticipant]);
  }

  return sortParticipantsByCreatedAt(
    current.map((participant) =>
      participant.id === nextParticipant.id ? nextParticipant : participant,
    ),
  );
}

export function App() {
  const [activeTab, setActiveTab] = useState<Tab>("schedule");
  const [teams, setTeams] = useState<Team[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [participantsLoading, setParticipantsLoading] = useState(true);
  const [participantsError, setParticipantsError] = useState("");
  const [participantsRealtimeActive, setParticipantsRealtimeActive] = useState(false);
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

    async function loadParticipants() {
      setParticipantsLoading(true);
      setParticipantsError("");

      try {
        const storedParticipants = await fetchParticipants();
        if (!isMounted) return;
        setParticipants(storedParticipants);
      } catch (error) {
        if (!isMounted) return;
        const message = error instanceof Error ? error.message : ui.databaseNotReady;
        setParticipants([]);
        setParticipantsError(`${ui.supabaseLoadFailed} ${message}`);
      } finally {
        if (isMounted) setParticipantsLoading(false);
      }
    }

    loadParticipants();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!supabase) {
      setParticipantsRealtimeActive(false);
      return;
    }

    function handleRealtimeInsertOrUpdate(payload: { new: unknown }) {
      console.log("Supabase participants realtime payload", payload);

      const row = payload.new as ParticipantRow | null;
      if (!row?.id) return;

      setParticipants((current) =>
        upsertParticipant(current, mapParticipantRow(row)),
      );
    }

    function handleRealtimeDelete(payload: { old: unknown }) {
      console.log("Supabase participants realtime payload", payload);

      const oldRow = payload.old as Partial<ParticipantRow> | null;
      if (!oldRow?.id) return;

      setParticipants((current) =>
        current.filter((participant) => participant.id !== oldRow.id),
      );
    }

    const realtimeClient = supabase;
    const channel = realtimeClient
      .channel("participants-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "participants" },
        handleRealtimeInsertOrUpdate,
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "participants" },
        handleRealtimeInsertOrUpdate,
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "participants" },
        handleRealtimeDelete,
      )
      .subscribe((status) => {
        setParticipantsRealtimeActive(status === "SUBSCRIBED");

        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          console.error("Supabase participants realtime disconnected", { status });
        }
      });

    return () => {
      setParticipantsRealtimeActive(false);
      realtimeClient.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    if (!supabase) return;

    let isMounted = true;

    async function syncParticipantsFromSupabase() {
      try {
        const storedParticipants = await fetchParticipants();
        if (!isMounted) return;
        setParticipants(sortParticipantsByCreatedAt(storedParticipants));
      } catch (error) {
        console.error("Supabase participants fallback sync failed", error);
      }
    }

    const intervalId = window.setInterval(syncParticipantsFromSupabase, 5_000);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
    };
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
    () => participants.filter((participant) => participant.status === "active"),
    [participants],
  );
  const eliminatedParticipants = useMemo(
    () => participants.filter((participant) => participant.status === "eliminated"),
    [participants],
  );
  const liveMatches = matches.filter((match) => match.status === "live");
  const activeTeams = teams.filter((team) => team.status !== "eliminated");
  const nextMatch = useMemo(
    () =>
      matches
        .filter((match) => match.status !== "final" && match.timestamp * 1000 >= now - 15 * 60_000)
        .sort((first, second) => first.timestamp - second.timestamp)[0],
    [matches, now],
  );
  const nextRefreshInMs = apiStatus.nextRefreshAt
    ? new Date(apiStatus.nextRefreshAt).getTime() - now
    : 0;
  const participantsSyncActive = Boolean(supabase) || participantsRealtimeActive;

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
        <div className="hero-content">
          <div className="hero-copy">
            <p className="eyebrow">FIFA World Cup 2026</p>
            <h1 id="page-title">תחרות מונדיאל מתח עליון</h1>
            <p>מעקב חי אחר משחקי המונדיאל, המשתתפים והקבוצות שנבחרו לזכייה בטורניר.</p>
          </div>

          <div className="hero-stats" aria-label="סטטוס תחרות">
            <HeroStat label={ui.participantCount} value={participants.length} />
            <HeroStat
              isLive={liveMatches.length > 0}
              label={ui.liveMatches}
              value={liveMatches.length}
            />
            <HeroStat label={ui.activeTeams} value={activeTeams.length} />
          </div>
        </div>

        <NextMatchCard match={nextMatch} now={now} teams={teams} />
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
          teams={teams}
        />
      )}
      {activeTab === "bracket" && (
        <TournamentBracket matches={matches} teams={teams} />
      )}
      {activeTab === "groupStage" && (
        <GroupStageView apiStatus={apiStatus} matches={matches} teams={teams} />
      )}
      {activeTab === "knockoutStage" && (
        <KnockoutStageView apiStatus={apiStatus} matches={matches} teams={teams} />
      )}
      {activeTab === "participants" && (
        <ParticipantsView
          activeParticipants={activeParticipants}
          error={participantsError}
          eliminatedParticipants={eliminatedParticipants}
          loading={participantsLoading}
        />
      )}
      {activeTab === "adminPanel" && (
        <AdminPanel
          adminLoggedIn={adminLoggedIn}
          loginError={loginError}
          matches={matches}
          onLogin={handleLogin}
          participants={participants}
          participantsError={participantsError}
          participantsLoading={participantsLoading}
          participantsRealtimeActive={participantsSyncActive}
          apiStatus={apiStatus}
          nextRefreshInMs={nextRefreshInMs}
          setAdminLoggedIn={setAdminLoggedIn}
          setParticipantsError={setParticipantsError}
          setMatches={setMatches}
          setParticipants={setParticipants}
          setTeams={setTeams}
          teams={teams}
        />
      )}
    </main>
  );
}

function HeroStat({
  isLive = false,
  label,
  value,
}: {
  isLive?: boolean;
  label: string;
  value: number | string;
}) {
  return (
    <article className="hero-stat-card">
      <span className={isLive ? "live-pulse" : "stat-dot"} />
      <div>
        <p>{label}</p>
        <strong>{value}</strong>
      </div>
    </article>
  );
}

function NextMatchCard({
  match,
  now,
  teams,
}: {
  match?: Match;
  now: number;
  teams: Team[];
}) {
  if (!match) {
    return (
      <aside className="next-match-card">
        <p className="eyebrow">{ui.nextMatch}</p>
        <strong>{ui.noUpcomingMatch}</strong>
      </aside>
    );
  }

  const kickoffMs = match.timestamp * 1000;

  return (
    <aside className="next-match-card" aria-label={ui.nextMatch}>
      <div className="next-match-top">
        <p className="eyebrow">{ui.nextMatch}</p>
        <span className={`pill ${match.status}`}>{translateStatus(match.status)}</span>
      </div>
      <div className="next-match-teams">
        <TeamIdentity
          logo={getTeamLogo(match.home, teams, match.homeLogo)}
          name={match.home}
        />
        <b>{formatScore(match)}</b>
        <TeamIdentity
          logo={getTeamLogo(match.away, teams, match.awayLogo)}
          name={match.away}
        />
      </div>
      <div className="next-match-meta">
        <span>{formatMatchDateTime(match)}</span>
        <strong>{ui.startsIn}: {formatCountdown(kickoffMs - now)}</strong>
      </div>
    </aside>
  );
}

function MatchScheduleView({
  apiStatus,
  matches,
  teams,
}: {
  apiStatus: ApiFootballStatus;
  matches: Match[];
  teams: Team[];
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
          <div className="match-time-row">
            <span>{formatMatchDateTime(match)}</span>
            <span>{translateStatusText(match.statusText)}</span>
          </div>
          <div className="scoreboard">
            <TeamScore
              logo={getTeamLogo(match.home, teams, match.homeLogo)}
              team={match.home}
              score={match.homeScore}
            />
            <span className="time">{formatScore(match)}</span>
            <TeamScore
              logo={getTeamLogo(match.away, teams, match.awayLogo)}
              team={match.away}
              score={match.awayScore}
            />
          </div>
          <p className="muted">
            {ui.localTime} · {match.stadium}, {match.city}
          </p>
        </article>
      ))}
    </section>
  );
}

function TeamScore({
  logo,
  team,
  score,
}: {
  logo?: string;
  team: string;
  score: number | null;
}) {
  return (
    <div className="team-score">
      <TeamIdentity logo={logo} name={team} />
      <span>{score ?? "-"}</span>
    </div>
  );
}

function TeamIdentity({
  logo,
  name,
}: {
  logo?: string;
  name: string;
}) {
  return (
    <span className="team-identity">
      {logo ? (
        <img alt="" src={logo} />
      ) : (
        <span className="emoji-flag" aria-hidden="true">{getTeamFlag(name)}</span>
      )}
      <strong>{name}</strong>
    </span>
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
                <h2>{toHebrewGroupName(group)}</h2>
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
                          <td>
                            <TeamIdentity logo={team.logo} name={team.name} />
                          </td>
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
                  <CompactMatch match={match} key={match.id} teams={teams} />
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
  teams,
}: {
  apiStatus: ApiFootballStatus;
  matches: Match[];
  teams: Team[];
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
                      <TeamScore
                        logo={getTeamLogo(match.home, teams, match.homeLogo)}
                        team={match.home}
                        score={match.homeScore}
                      />
                      <span className="time">{formatScore(match)}</span>
                      <TeamScore
                        logo={getTeamLogo(match.away, teams, match.awayLogo)}
                        team={match.away}
                        score={match.awayScore}
                      />
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

function CompactMatch({ match, teams }: { match: Match; teams: Team[] }) {
  return (
    <article className="fixture-row">
      <div className="compact-fixture-teams">
        <TeamIdentity logo={getTeamLogo(match.home, teams, match.homeLogo)} name={match.home} />
        <b>{formatScore(match)}</b>
        <TeamIdentity logo={getTeamLogo(match.away, teams, match.awayLogo)} name={match.away} />
      </div>
      <span>{translateRound(match.round)} · {translateStatusText(match.statusText)}</span>
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

function toHebrewGroupName(group: string) {
  const match = group.match(/Group\s+([A-L])/i);

  return match ? `בית ${match[1].toUpperCase()}` : group;
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
  error,
  eliminatedParticipants,
  loading,
}: {
  activeParticipants: Participant[];
  error: string;
  eliminatedParticipants: Participant[];
  loading: boolean;
}) {
  if (loading) {
    return <p className="empty-state">{ui.participantsLoading}</p>;
  }

  if (error) {
    return (
      <section className="table-panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">{ui.databaseError}</p>
            <h2>{ui.participants}</h2>
          </div>
        </div>
        <p className="empty-state">{error}</p>
      </section>
    );
  }

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
                <th>{ui.status}</th>
              </tr>
            </thead>
            <tbody>
              {participants.map((participant) => (
                <tr key={participant.id}>
                  <td>{participant.name}</td>
                  <td>{participant.selectedChampionTeam}</td>
                  <td>{statusLabel}</td>
                </tr>
              ))}
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
  participantsError,
  participantsLoading,
  participantsRealtimeActive,
  setAdminLoggedIn,
  setMatches,
  setParticipants,
  setParticipantsError,
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
  participantsError: string;
  participantsLoading: boolean;
  participantsRealtimeActive: boolean;
  setAdminLoggedIn: (value: boolean) => void;
  setMatches: React.Dispatch<React.SetStateAction<Match[]>>;
  setParticipants: React.Dispatch<React.SetStateAction<Participant[]>>;
  setParticipantsError: React.Dispatch<React.SetStateAction<string>>;
  setTeams: React.Dispatch<React.SetStateAction<Team[]>>;
  teams: Team[];
}) {
  const firstTeamName = teams[0]?.name ?? "";
  const firstMatchId = matches[0]?.id ?? 0;
  const [adminPasswordInput, setAdminPasswordInput] = useState("");
  const [participantName, setParticipantName] = useState("");
  const [participantPick, setParticipantPick] = useState(firstTeamName);
  const [editingParticipantId, setEditingParticipantId] = useState<string | null>(null);
  const [participantSaving, setParticipantSaving] = useState(false);
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

  async function saveParticipant(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!participantName.trim() || participantSaving) return;

    const participantStatus = teams.find((team) => team.name === participantPick)?.status === "eliminated"
      ? "eliminated"
      : "active";

    setParticipantSaving(true);
    setParticipantsError("");

    try {
      if (editingParticipantId !== null) {
        const updatedParticipant = await updateParticipant(editingParticipantId, {
          name: participantName.trim(),
          selectedChampionTeam: participantPick,
          status: participantStatus,
        });
        setParticipants((current) =>
          current.map((participant) =>
            participant.id === editingParticipantId ? updatedParticipant : participant,
          ),
        );
        setEditingParticipantId(null);
      } else {
        const newParticipant = await insertParticipant(
          participantName.trim(),
          participantPick,
        );
        setParticipants((current) => upsertParticipant(current, newParticipant));
      }

      setParticipantName("");
      setParticipantPick(firstTeamName);
    } catch (error) {
      const message = error instanceof Error ? error.message : ui.databaseNotReady;
      setParticipantsError(`${ui.supabaseSaveFailed} ${message}`);
    } finally {
      setParticipantSaving(false);
    }
  }

  function editParticipant(participant: Participant) {
    setEditingParticipantId(participant.id);
    setParticipantName(participant.name);
    setParticipantPick(participant.selectedChampionTeam);
  }

  async function removeParticipant(id: string) {
    setParticipantsError("");

    try {
      await deleteParticipant(id);
      setParticipants((current) => current.filter((participant) => participant.id !== id));
    } catch (error) {
      const message = error instanceof Error ? error.message : ui.databaseNotReady;
      setParticipantsError(`${ui.supabaseDeleteFailed} ${message}`);
    }
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

  async function markEliminated(teamName: string) {
    setParticipantsError("");

    setTeams((current) =>
      current.map((team) =>
        team.name === teamName ? { ...team, status: "eliminated" } : team,
      ),
    );

    const participantsToEliminate = participants.filter(
      (participant) =>
        participant.selectedChampionTeam === teamName && participant.status !== "eliminated",
    );

    if (participantsToEliminate.length === 0) return;

    try {
      const updatedParticipants = await Promise.all(
        participantsToEliminate.map((participant) =>
          updateParticipant(participant.id, { status: "eliminated" }),
        ),
      );
      const updatedById = new Map(
        updatedParticipants.map((participant) => [participant.id, participant]),
      );

      setParticipants((current) =>
        current.map((participant) => updatedById.get(participant.id) ?? participant),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : ui.databaseNotReady;
      setParticipantsError(`${ui.supabaseSaveFailed} ${message}`);
    }
  }

  return (
    <section className="admin-layout" aria-labelledby="admin-heading">
      <div className="section-heading">
        <div>
          <p className="eyebrow">{ui.adminOnly}</p>
          <h2 id="admin-heading">{ui.adminPanel}</h2>
        </div>
        <span className={`status-badge ${supabase ? "active" : "eliminated"}`}>
          {supabase ? ui.supabaseConnected : ui.supabaseNotConnected}
        </span>
        <span className={`status-badge ${participantsRealtimeActive ? "active" : "eliminated"}`}>
          {participantsRealtimeActive ? ui.realtimeActive : ui.realtimeInactive}
        </span>
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
          <button type="submit" disabled={teams.length === 0 || participantsLoading || participantSaving}>
            {participantSaving ? ui.loading : ui.saveParticipant}
          </button>
          {participantsError ? <p className="error-text">{participantsError}</p> : null}
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
          <button type="button" disabled={teams.length === 0 || participantsLoading} onClick={() => void markEliminated(teamToEliminate)}>
            {ui.markEliminated}
          </button>
          <p className="rule-note">{ui.eliminationRule}</p>
        </div>

        <div className="admin-card audit-card">
          <h3>{ui.manageParticipants}</h3>
          {participantsLoading ? (
            <p className="muted">{ui.participantsLoading}</p>
          ) : participants.length === 0 ? (
            <p className="muted">{ui.noParticipants}</p>
          ) : (
            <ul>
              {participants.map((participant) => (
                <li key={participant.id}>
                  <span>{participant.name} · {participant.selectedChampionTeam}</span>
                  <div className="inline-actions">
                    <button type="button" onClick={() => editParticipant(participant)}>{ui.edit}</button>
                    <button type="button" onClick={() => void removeParticipant(participant.id)}>{ui.delete}</button>
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
