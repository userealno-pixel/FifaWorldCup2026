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
type Lang = "he" | "ru" | "en";

type Participant = {
  id: number;
  name: string;
  country: string;
  winnerPick: string;
  points: number;
};

type MatchPrediction = {
  id: number;
  matchId: number;
  prediction: string;
  confidence: number;
};

const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD ?? "123456";

// Local-only protection for this prototype. Production admin access must move
// to real server-side auth such as Firebase Auth or Supabase Auth before launch.
// Keep the local test password out of the UI. Configure VITE_ADMIN_PASSWORD for deployments.

const navItems: { id: Tab; labelKey: keyof Translations }[] = [
  { id: "schedule", labelKey: "matchSchedule" },
  { id: "bracket", labelKey: "tournamentBracket" },
  { id: "groupStage", labelKey: "groupStage" },
  { id: "knockoutStage", labelKey: "knockoutStage" },
  { id: "participants", labelKey: "participantsTable" },
  { id: "finalPrediction", labelKey: "finalPrediction" },
  { id: "adminPanel", labelKey: "adminPanel" },
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

const translations = {
  he: {
    publicDashboard: "דשבורד ציבורי",
    matchSchedule: "לוח משחקים",
    tournamentBracket: "תרשים הטורניר",
    groupStage: "שלב הבתים",
    knockoutStage: "שלב הנוקאאוט",
    participantsTable: "טבלת משתתפים",
    finalPrediction: "תחזית לזוכה",
    adminPanel: "פאנל ניהול",
    appTitle: "פלטפורמת תחזיות לקריאה בלבד",
    appIntro: "משתמשים ציבוריים יכולים לצפות בלוח המשחקים, תוצאות חיות, משתתפים ותחזיות. שינויים מנוהלים רק דרך פאנל המנהל.",
    platformSnapshot: "סטטוס מערכת",
    matchesLoaded: "משחקים נטענו",
    live: "חי",
    teamsEliminated: "נבחרות הודחו",
    teamsActive: "נבחרות פעילות",
    loadedFromApi: "נטען מ-API-Football",
    participants: "משתתפים",
    eliminated: "הודחו",
    winnerPredictions: "תחזיות לזוכה",
    adminManaged: "מנוהל על ידי מנהל",
    liveScores: "תוצאות חיות",
    loading: "טוען",
    match: "משחק",
    connected: "מחובר",
    offline: "לא מחובר",
    lastUpdated: "עודכן לאחרונה",
    nextRefreshIn: "רענון הבא בעוד",
    refreshInterval: "תדירות רענון",
    usageClose: "שימוש קרוב למגבלה היומית",
    requestsToday: "בקשות היום",
    nextFixtures: "המשחקים הקרובים",
    officialSchedulePreview: "תצוגת לוח משחקים רשמי",
    readOnly: "קריאה בלבד",
    loadingFixtures: "טוען נתוני מונדיאל 2026...",
    matches: "משחקים",
    noApiData: "אין נתוני API",
    worldCupSchedule: "לוח משחקי מונדיאל 2026",
    adminPrediction: "תחזית מנהל",
    noPredictionAdded: "לא נוספה תחזית",
    localTime: "שעון ישראל",
    standingsAndFixtures: "טבלה ומשחקים",
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
    out: "הודחה",
    active: "פעיל",
    standingsUnavailable: "טבלת הבית עדיין לא זמינה.",
    fixturesNotPublished: "המשחקים הרשמיים עדיין לא פורסמו ב-API-Football.",
    advances: "עולה",
    fixtures: "משחקים",
    fixturesTbd: "משחקים יפורסמו בהמשך",
    tbd: "ייקבע בהמשך",
    groupLabel: "בית",
    roundOf32: "שלב 32 האחרונות",
    roundOf16: "שמינית הגמר",
    quarterFinals: "רבע הגמר",
    semiFinals: "חצי הגמר",
    thirdPlaceMatch: "משחק על המקום השלישי",
    tournamentBracketTitle: "תרשים הטורניר",
    winner: "הזוכה",
    worldCupWinner: "הזוכה במונדיאל 2026",
    apiFootball: "API-Football",
    apiConnected: "API-Football מחובר",
    apiReadyToConnect: "API-Football מוכן להתחברות",
    apiKeyNotConnected: "API key is not connected yet",
    apiUnavailable: "API-Football אינו זמין כרגע",
    noWinnerPredictions: "עדיין אין תחזיות לזוכה",
    activeParticipants: "משתתפים פעילים",
    eliminatedParticipants: "משתתפים שהודחו",
    noParticipants: "אין משתתפים עדיין. מנהלים יכולים להוסיף משתתפים לאחר התחברות.",
    name: "שם",
    country: "מדינה",
    winnerPick: "בחירת זוכה",
    points: "נקודות",
    adminAccess: "גישת מנהל",
    password: "סיסמה",
    enterAdminPassword: "הזן סיסמת מנהל",
    login: "התחברות",
    logout: "התנתקות",
    incorrectPassword: "סיסמת מנהל שגויה.",
    adminLoggedIn: "המנהל מחובר.",
    adminPasswordHelp: "יש להזין סיסמת מנהל כדי להמשיך.",
    protected: "מוגן",
    adminPanelLocked: "פאנל הניהול נעול",
    useAdminLogin: "יש להתחבר לפני ביצוע שינויים.",
    adminOnly: "מנהל בלבד",
    addParticipant: "הוספת משתתף",
    editParticipant: "עריכת משתתף",
    teamsUnavailable: "מפתח API לא מחובר, לכן הנבחרות לא זמינות.",
    matchesUnavailable: "מפתח API לא מחובר, לכן המשחקים לא זמינים.",
    saveParticipant: "שמירת משתתף",
    addMatchPrediction: "הוספת תחזית משחק",
    prediction: "תחזית",
    confidence: "ביטחון",
    savePrediction: "שמירת תחזית",
    manualScoreUpdate: "עדכון תוצאה ידני",
    home: "בית",
    away: "חוץ",
    status: "סטטוס",
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
    language: "שפה",
  },
  ru: {
    publicDashboard: "Панель",
    matchSchedule: "Расписание матчей",
    tournamentBracket: "Сетка турнира",
    groupStage: "Групповой этап",
    knockoutStage: "Плей-офф",
    participantsTable: "Участники",
    finalPrediction: "Прогноз победителя",
    adminPanel: "Панель админа",
    appTitle: "Платформа прогнозов только для просмотра",
    appIntro: "Публичные пользователи могут только смотреть расписание, live-счёт, участников и прогнозы. Изменения доступны только администратору.",
    platformSnapshot: "Статус платформы",
    matchesLoaded: "матчей загружено",
    live: "live",
    teamsEliminated: "команд выбыло",
    teamsActive: "Активные команды",
    loadedFromApi: "Загружено из API-Football",
    participants: "Участники",
    eliminated: "выбыло",
    winnerPredictions: "Прогнозы победителя",
    adminManaged: "Управляет админ",
    liveScores: "Live-счёт",
    loading: "Загрузка",
    match: "Матч",
    connected: "Подключено",
    offline: "Офлайн",
    lastUpdated: "Обновлено",
    nextRefreshIn: "Следующее обновление через",
    refreshInterval: "Интервал обновления",
    usageClose: "Близко к дневному лимиту",
    requestsToday: "запросов сегодня",
    nextFixtures: "Ближайшие матчи",
    officialSchedulePreview: "Официальное расписание",
    readOnly: "Только просмотр",
    loadingFixtures: "Загрузка данных ЧМ-2026...",
    matches: "Матчи",
    noApiData: "Нет данных API",
    worldCupSchedule: "Расписание ЧМ-2026",
    adminPrediction: "Прогноз админа",
    noPredictionAdded: "Прогноз не добавлен",
    localTime: "время Израиля",
    standingsAndFixtures: "Таблица и матчи",
    advancing: "проходят дальше",
    rank: "Место",
    team: "Команда",
    pts: "Очки",
    pld: "Игры",
    wins: "Поб.",
    draws: "Нич.",
    losses: "Пор.",
    gf: "ЗМ",
    ga: "ПМ",
    gd: "РМ",
    advance: "Проход",
    pending: "Ожидает",
    scheduled: "Запланирован",
    final: "Завершён",
    finished: "Завершён",
    out: "Выбыла",
    active: "Активен",
    standingsUnavailable: "Таблица группы пока недоступна.",
    fixturesNotPublished: "Официальные матчи ещё не опубликованы API-Football.",
    advances: "Проходит",
    fixtures: "матчей",
    fixturesTbd: "Матчи TBD",
    tbd: "TBD",
    groupLabel: "Группа",
    roundOf32: "Раунд 32",
    roundOf16: "1/8 финала",
    quarterFinals: "Четвертьфиналы",
    semiFinals: "Полуфиналы",
    thirdPlaceMatch: "Матч за 3-е место",
    tournamentBracketTitle: "Сетка турнира",
    winner: "Победитель",
    worldCupWinner: "Победитель ЧМ-2026",
    apiFootball: "API-Football",
    apiConnected: "API-Football подключён",
    apiReadyToConnect: "API-Football готов к подключению",
    apiKeyNotConnected: "API key is not connected yet",
    apiUnavailable: "API-Football сейчас недоступен",
    noWinnerPredictions: "Прогнозов победителя пока нет",
    activeParticipants: "Активные участники",
    eliminatedParticipants: "Выбывшие участники",
    noParticipants: "Участников пока нет. Админ может добавить их после входа.",
    name: "Имя",
    country: "Страна",
    winnerPick: "Выбор победителя",
    points: "Очки",
    adminAccess: "Доступ админа",
    password: "Пароль",
    enterAdminPassword: "Введите пароль администратора",
    login: "Войти",
    logout: "Выйти",
    incorrectPassword: "Неверный пароль администратора.",
    adminLoggedIn: "Администратор вошёл.",
    adminPasswordHelp: "Введите пароль администратора, чтобы продолжить.",
    protected: "Защищено",
    adminPanelLocked: "Панель админа закрыта",
    useAdminLogin: "Сначала войдите как администратор.",
    adminOnly: "Только админ",
    addParticipant: "Добавить участника",
    editParticipant: "Редактировать участника",
    teamsUnavailable: "API-ключ не подключён, команды недоступны.",
    matchesUnavailable: "API-ключ не подключён, матчи недоступны.",
    saveParticipant: "Сохранить участника",
    addMatchPrediction: "Добавить прогноз матча",
    prediction: "Прогноз",
    confidence: "Уверенность",
    savePrediction: "Сохранить прогноз",
    manualScoreUpdate: "Ручное обновление счёта",
    home: "Дом",
    away: "Гости",
    status: "Статус",
    updateScore: "Обновить счёт",
    eliminateTeam: "Исключить команду",
    markEliminated: "Исключить",
    eliminationRule: "Участники с этим выбором автоматически выбывают.",
    manageParticipants: "Управление участниками",
    edit: "Ред.",
    delete: "Удалить",
    apiDebugStatus: "API статус",
    baseUrl: "Base URL",
    header: "Header",
    apiKeyLoaded: "API ключ из .env",
    yes: "Да",
    no: "Нет",
    liveEndpointChecked: "Live endpoint проверен",
    todaysScheduledMatches: "Матчи сегодня",
    lastEndpoint: "Последний endpoint",
    nextRefresh: "След. обновление",
    dataSource: "Источник",
    groupStageDataSource: "Источник группового этапа",
    groupValidation: "Проверка групп",
    validationOk: "Проблем в группах не найдено.",
    duplicateTeamGroupWarning: "Команда указана более чем в одной группе",
    groupSizeWarning: "В группе неверное количество команд",
    wrongMatchGroupWarning: "Матч привязан к неверной группе",
    exactApiError: "Точная ошибка API",
    none: "Нет",
    adminDataNote: "Данные админа сейчас хранятся локально. Для production нужен Firebase/Supabase/backend.",
    language: "Язык",
  },
  en: {
    publicDashboard: "Public Dashboard",
    matchSchedule: "Match Schedule",
    tournamentBracket: "Tournament Bracket",
    groupStage: "Group Stage",
    knockoutStage: "Knockout Stage",
    participantsTable: "Participants",
    finalPrediction: "Final Prediction",
    adminPanel: "Admin Panel",
    appTitle: "Read-only prediction platform",
    appIntro: "Public users can view schedule data, live scores, participants, and predictions. Admin changes live behind a protected panel.",
    platformSnapshot: "Platform snapshot",
    matchesLoaded: "matches loaded",
    live: "live",
    teamsEliminated: "teams eliminated",
    teamsActive: "Teams active",
    loadedFromApi: "Loaded from API-Football",
    participants: "Participants",
    eliminated: "eliminated",
    winnerPredictions: "Winner predictions",
    adminManaged: "Admin managed",
    liveScores: "Live scores",
    loading: "Loading",
    match: "Match",
    connected: "Connected",
    offline: "Offline",
    lastUpdated: "Last updated",
    nextRefreshIn: "Next refresh in",
    refreshInterval: "Refresh interval",
    usageClose: "Usage close to daily limit",
    requestsToday: "requests today",
    nextFixtures: "Next fixtures",
    officialSchedulePreview: "Official schedule preview",
    readOnly: "Read only",
    loadingFixtures: "Loading World Cup 2026 data...",
    matches: "Matches",
    noApiData: "No API data",
    worldCupSchedule: "World Cup 2026 match schedule",
    adminPrediction: "Admin prediction",
    noPredictionAdded: "No prediction added",
    localTime: "Israel time",
    standingsAndFixtures: "Standings and fixtures",
    advancing: "advancing",
    rank: "Rank",
    team: "Team",
    pts: "Pts",
    pld: "Pld",
    wins: "W",
    draws: "D",
    losses: "L",
    gf: "GF",
    ga: "GA",
    gd: "GD",
    advance: "Advance",
    pending: "Pending",
    scheduled: "Scheduled",
    final: "Final",
    finished: "Finished",
    out: "Out",
    active: "Active",
    standingsUnavailable: "Standings are not available yet.",
    fixturesNotPublished: "Official fixtures are not published by API-Football yet.",
    advances: "Advances",
    fixtures: "fixtures",
    fixturesTbd: "Fixtures TBD",
    tbd: "TBD",
    groupLabel: "Group",
    roundOf32: "Round of 32",
    roundOf16: "Round of 16",
    quarterFinals: "Quarter-finals",
    semiFinals: "Semi-finals",
    thirdPlaceMatch: "Third place match",
    tournamentBracketTitle: "Tournament bracket",
    winner: "Winner",
    worldCupWinner: "World Cup 2026 winner",
    apiFootball: "API-Football",
    apiConnected: "API-Football connected",
    apiReadyToConnect: "API-Football ready to connect",
    apiKeyNotConnected: "API key is not connected yet",
    apiUnavailable: "API-Football is not available right now",
    noWinnerPredictions: "No winner predictions yet",
    activeParticipants: "Active participants",
    eliminatedParticipants: "Eliminated participants",
    noParticipants: "No participants yet. Admins can add participants after login.",
    name: "Name",
    country: "Country",
    winnerPick: "Winner pick",
    points: "Points",
    adminAccess: "Admin access",
    password: "Password",
    enterAdminPassword: "Enter admin password",
    login: "Login",
    logout: "Logout",
    incorrectPassword: "Incorrect admin password.",
    adminLoggedIn: "Admin is logged in.",
    adminPasswordHelp: "Enter the admin password to continue.",
    protected: "Protected",
    adminPanelLocked: "Admin panel locked",
    useAdminLogin: "Please log in before making changes.",
    adminOnly: "Admin only",
    addParticipant: "Add participant",
    editParticipant: "Edit participant",
    teamsUnavailable: "API key is not connected, so teams are not available.",
    matchesUnavailable: "API key is not connected, so matches are not available.",
    saveParticipant: "Save participant",
    addMatchPrediction: "Add match prediction",
    prediction: "Prediction",
    confidence: "Confidence",
    savePrediction: "Save prediction",
    manualScoreUpdate: "Manual score update",
    home: "Home",
    away: "Away",
    status: "Status",
    updateScore: "Update score",
    eliminateTeam: "Eliminate team",
    markEliminated: "Mark eliminated",
    eliminationRule: "Participants with this winner pick move to eliminated automatically.",
    manageParticipants: "Manage participants",
    edit: "Edit",
    delete: "Delete",
    apiDebugStatus: "API debug status",
    baseUrl: "Base URL",
    header: "Header",
    apiKeyLoaded: "API key loaded from .env",
    yes: "Yes",
    no: "No",
    liveEndpointChecked: "Live endpoint checked",
    todaysScheduledMatches: "Today's scheduled matches",
    lastEndpoint: "Last endpoint",
    nextRefresh: "Next refresh",
    dataSource: "Data source",
    groupStageDataSource: "Group stage data source",
    groupValidation: "Group validation",
    validationOk: "No group issues found.",
    duplicateTeamGroupWarning: "Team appears in more than one group",
    groupSizeWarning: "Group has the wrong number of teams",
    wrongMatchGroupWarning: "Match belongs to wrong group",
    exactApiError: "Exact API error",
    none: "None",
    adminDataNote: "Admin data is kept in local React state for this version. Persist it with Firebase, Supabase, or your backend before production.",
    language: "Language",
  },
} as const;

function formatScore(match: Match, t: Translations) {
  return match.homeScore === null || match.awayScore === null
    ? t.pending
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

type Translations = { [Key in keyof typeof translations.en]: string };

function formatDateTime(value: string, lang: Lang) {
  if (!value) return translations[lang].pending;

  return new Intl.DateTimeFormat(lang === "he" ? "he-IL" : lang === "ru" ? "ru-RU" : "en-US", {
    dateStyle: "medium",
    timeStyle: "medium",
    timeZone: "Asia/Jerusalem",
  }).format(new Date(value));
}

function formatMatchDateTime(match: Match, lang: Lang) {
  const date = new Date(match.timestamp * 1000);

  if (Number.isNaN(date.getTime())) {
    return `${match.date} · ${match.localTime}`;
  }

  return new Intl.DateTimeFormat(lang === "he" ? "he-IL" : lang === "ru" ? "ru-RU" : "en-US", {
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

function translateStatus(status: MatchStatus, t: Translations) {
  if (status === "live") return t.live;
  if (status === "final") return t.final;
  return t.scheduled;
}

function translateStatusText(statusText: string, t: Translations) {
  const normalized = statusText.toLowerCase();

  if (normalized.includes("not started") || normalized.includes("scheduled")) return t.scheduled;
  if (normalized.includes("finished") || normalized.includes("final")) return t.finished;
  if (normalized.includes("live") || normalized.includes("progress")) return t.live;
  return statusText;
}

function translateRound(round: string, t: Translations) {
  const normalized = normalizeRoundLabel(round);

  if (normalized === "Round of 32") return t.roundOf32;
  if (normalized === "Round of 16") return t.roundOf16;
  if (normalized === "Quarter-finals") return t.quarterFinals;
  if (normalized === "Semi-finals") return t.semiFinals;
  if (normalized === "Third place match") return t.thirdPlaceMatch;
  if (normalized === "Final") return t.final;
  if (round.toLowerCase().includes("group")) return t.groupStage;
  return round;
}

function translateApiMessage(message: string, t: Translations) {
  if (message === "API-Football connected") return t.apiConnected;
  if (message === "API-Football ready to connect") return t.apiReadyToConnect;
  if (message === "API key is not connected yet") return t.apiKeyNotConnected;
  if (message === "API-Football is not available right now") return t.apiUnavailable;
  return message;
}

export function App() {
  const [activeTab, setActiveTab] = useState<Tab>("schedule");
  const [language, setLanguage] = useState<Lang>("he");
  const [teams, setTeams] = useState<Team[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [matchPredictions, setMatchPredictions] = useState<MatchPrediction[]>([]);
  const [adminLoggedIn, setAdminLoggedIn] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [apiStatus, setApiStatus] = useState<ApiFootballStatus>(
    createApiFootballStatus({ loading: true }),
  );
  const [now, setNow] = useState(Date.now());

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
  const t = translations[language];
  const isRtl = language === "he";

  function handleLogin(password: string) {
    if (password === ADMIN_PASSWORD) {
      setAdminLoggedIn(true);
      setLoginError("");
      setActiveTab("adminPanel");
      return;
    }

    setLoginError(t.incorrectPassword);
  }

  return (
    <main className="app-shell" dir={isRtl ? "rtl" : "ltr"} lang={language}>
      <section className="hero" aria-labelledby="page-title">
        <div className="hero-copy">
          <p className="eyebrow">FIFA World Cup 2026</p>
          <h1 id="page-title">{t.appTitle}</h1>
          <p>{t.appIntro}</p>
        </div>

        <div className="hero-panel" aria-label="Platform snapshot">
          <span className="status-dot" />
          <div>
            <strong>{matches.length} {t.matchesLoaded}</strong>
            <span>{liveMatches.length} {t.live} · {eliminatedTeams.length} {t.teamsEliminated}</span>
          </div>
        </div>
      </section>

      <div className="language-switcher" aria-label={t.language}>
        <span>{t.language}</span>
        <button className={language === "he" ? "active" : ""} type="button" onClick={() => setLanguage("he")}>
          Hebrew
        </button>
        <button className={language === "ru" ? "active" : ""} type="button" onClick={() => setLanguage("ru")}>
          Русский
        </button>
        <button className={language === "en" ? "active" : ""} type="button" onClick={() => setLanguage("en")}>
          English
        </button>
      </div>

      <nav className="tabs" aria-label="Prediction platform sections">
        {navItems.map((item) => (
          <button
            key={item.id}
            className={activeTab === item.id ? "active" : ""}
            type="button"
            onClick={() => setActiveTab(item.id)}
          >
            {t[item.labelKey]}
          </button>
        ))}
      </nav>

      {activeTab === "schedule" && (
        <MatchScheduleView
          apiStatus={apiStatus}
          lang={language}
          matches={matches}
          matchPredictions={matchPredictions}
          t={t}
        />
      )}
      {activeTab === "bracket" && (
        <TournamentBracket matches={matches} teams={teams} />
      )}
      {activeTab === "groupStage" && (
        <GroupStageView apiStatus={apiStatus} lang={language} matches={matches} teams={teams} t={t} />
      )}
      {activeTab === "knockoutStage" && (
        <KnockoutStageView apiStatus={apiStatus} lang={language} matches={matches} t={t} />
      )}
      {activeTab === "participants" && (
        <ParticipantsView
          activeParticipants={activeParticipants}
          eliminatedParticipants={eliminatedParticipants}
          t={t}
        />
      )}
      {activeTab === "finalPrediction" && (
        <FinalPredictionView
          activeParticipants={activeParticipants}
          eliminatedParticipants={eliminatedParticipants}
          t={t}
          teams={teams}
        />
      )}
      {activeTab === "adminPanel" && (
        <AdminPanel
          adminLoggedIn={adminLoggedIn}
          lang={language}
          loginError={loginError}
          matchPredictions={matchPredictions}
          matches={matches}
          onLogin={handleLogin}
          participants={participants}
          apiStatus={apiStatus}
          nextRefreshInMs={nextRefreshInMs}
          setAdminLoggedIn={setAdminLoggedIn}
          setMatchPredictions={setMatchPredictions}
          setMatches={setMatches}
          setParticipants={setParticipants}
          setTeams={setTeams}
          teams={teams}
          t={t}
        />
      )}
    </main>
  );
}

function MatchScheduleView({
  apiStatus,
  lang,
  matches,
  matchPredictions,
  t,
}: {
  apiStatus: ApiFootballStatus;
  lang: Lang;
  matches: Match[];
  matchPredictions: MatchPrediction[];
  t: Translations;
}) {
  if (matches.length === 0) {
    return (
      <section className="table-panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">{t.matches}</p>
            <h2>{t.worldCupSchedule}</h2>
          </div>
          <span className="status-badge eliminated">{t.noApiData}</span>
        </div>
        <p className="empty-state">
          {apiStatus.loading ? t.loadingFixtures : translateApiMessage(apiStatus.message, t)}
        </p>
      </section>
    );
  }

  return (
    <section className="content-grid matches-grid">
      {matches.map((match) => {
        const prediction = matchPredictions.find((item) => item.matchId === match.id);

        return (
          <article className="match-card" key={match.id}>
            <div className="card-topline">
              <span className={`pill ${match.status}`}>{translateStatus(match.status, t)}</span>
              <span>{translateRound(match.round, t)}</span>
            </div>
            <div className="scoreboard">
              <TeamScore team={match.home} score={match.homeScore} />
              <span className="time">{formatScore(match, t)}</span>
              <TeamScore team={match.away} score={match.awayScore} />
            </div>
            <div className="prediction-row">
              <div>
                <span>{t.adminPrediction}</span>
                <strong>{prediction?.prediction ?? t.noPredictionAdded}</strong>
              </div>
              <div className="confidence" aria-label={`${prediction?.confidence ?? 0}% confidence`}>
                <span style={{ width: `${prediction?.confidence ?? 0}%` }} />
              </div>
            </div>
            <p className="muted">
              {formatMatchDateTime(match, lang)} · {t.localTime} · {translateStatusText(match.statusText, t)}
            </p>
            <p className="muted">
              {match.stadium}, {match.city}
            </p>
          </article>
        );
      })}
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
  lang,
  matches,
  t,
  teams,
}: {
  apiStatus: ApiFootballStatus;
  lang: Lang;
  matches: Match[];
  t: Translations;
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
    return <ApiEmptyPanel apiStatus={apiStatus} title={t.groupStage} t={t} />;
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
                <p className="eyebrow">{t.groupStage}</p>
                <h2>{group}</h2>
              </div>
              <span className="status-badge active">
                {groupTeams.filter((team) => team.advanced).length} {t.advancing}
              </span>
            </div>

            <div className="group-layout">
              {groupTeams.length > 0 ? (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>{t.rank}</th>
                        <th>{t.team}</th>
                        <th>{t.pts}</th>
                        <th>{t.pld}</th>
                        <th>{t.wins}</th>
                        <th>{t.draws}</th>
                        <th>{t.losses}</th>
                        <th>{t.gf}</th>
                        <th>{t.ga}</th>
                        <th>{t.gd}</th>
                        <th>{t.advance}</th>
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
                              {team.advanced ? t.advancing : t.pending}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="empty-state">{t.standingsUnavailable}</p>
              )}

              <div className="mini-fixtures">
                {fixtures.map((match) => (
                  <CompactMatch lang={lang} match={match} key={match.id} t={t} />
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
  lang,
  matches,
  t,
}: {
  apiStatus: ApiFootballStatus;
  lang: Lang;
  matches: Match[];
  t: Translations;
}) {
  const knockoutMatches = getOrderedKnockoutMatches(matches);

  if (matches.length === 0) {
    return <ApiEmptyPanel apiStatus={apiStatus} title={t.knockoutStage} t={t} />;
  }

  return (
    <section className="stacked-panels">
      {KNOCKOUT_ROUND_ORDER.map((round) => {
        const roundMatches = knockoutMatches.filter((match) => normalizeRoundLabel(match.round) === round);

        return (
          <section className="table-panel" key={round}>
            <div className="section-heading">
              <div>
                <p className="eyebrow">{t.knockoutStage}</p>
                <h2>{translateRound(round, t)}</h2>
              </div>
              <span className="status-badge active">{roundMatches.length} {t.fixtures}</span>
            </div>

            {roundMatches.length === 0 ? (
              <p className="empty-state">{t.fixturesNotPublished}</p>
            ) : (
              <div className="content-grid matches-grid knockout-round-list">
                {roundMatches.map((match) => (
                  <article className="match-card" key={match.id}>
                    <div className="card-topline">
                      <span className={`pill ${match.status}`}>{translateStatus(match.status, t)}</span>
                      <span>{translateRound(match.round, t)}</span>
                    </div>
                    <div className="scoreboard">
                      <TeamScore team={match.home} score={match.homeScore} />
                      <span className="time">{formatScore(match, t)}</span>
                      <TeamScore team={match.away} score={match.awayScore} />
                    </div>
                    <p className="muted">
                      {formatMatchDateTime(match, lang)} · {t.localTime} · {translateStatusText(match.statusText, t)}
                    </p>
                    <p className="muted">
                      {t.advances}: {getAdvancingTeam(match) ?? t.tbd}
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

function CompactMatch({
  lang,
  match,
  t,
}: {
  lang: Lang;
  match: Match;
  t: Translations;
}) {
  return (
    <article className="fixture-row">
      <strong>{getMatchLabel(match)}</strong>
      <span>{formatScore(match, t)} · {translateStatusText(match.statusText, t)}</span>
      <small>{formatMatchDateTime(match, lang)} · {t.localTime}</small>
    </article>
  );
}

function ApiEmptyPanel({
  apiStatus,
  t,
  title,
}: {
  apiStatus: ApiFootballStatus;
  t: Translations;
  title: string;
}) {
  return (
    <section className="table-panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">{t.apiFootball}</p>
          <h2>{title}</h2>
        </div>
        <span className="status-badge eliminated">{t.noApiData}</span>
      </div>
      <p className="empty-state">
        {apiStatus.loading ? t.loadingFixtures : translateApiMessage(apiStatus.message, t)}
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

function validateGroupStageData(teams: Team[], matches: Match[], t: Translations) {
  const warnings: string[] = [];
  const teamGroups = new Map<string, Set<string>>();

  teams
    .filter((team) => /^Group\s+[A-L]$/i.test(team.group))
    .forEach((team) => {
      teamGroups.set(team.name, new Set([...(teamGroups.get(team.name) ?? []), team.group]));
    });

  teamGroups.forEach((groups, teamName) => {
    if (groups.size > 1) {
      warnings.push(`${t.duplicateTeamGroupWarning}: ${teamName} (${Array.from(groups).join(", ")})`);
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
      warnings.push(`${t.groupSizeWarning}: ${group} (${groupTeams.length}/4)`);
    }
  });

  matches
    .filter((match) => match.stage === "group")
    .forEach((match) => {
      const homeGroup = teams.find((team) => team.name === match.home)?.group;
      const awayGroup = teams.find((team) => team.name === match.away)?.group;

      if (!homeGroup || !awayGroup || homeGroup !== awayGroup || match.group !== homeGroup) {
        warnings.push(
          `${t.wrongMatchGroupWarning}: ${getMatchLabel(match)} (${match.group}; ${homeGroup ?? t.pending}/${awayGroup ?? t.pending})`,
        );
      }
    });

  return warnings;
}

function ParticipantsView({
  activeParticipants,
  eliminatedParticipants,
  t,
}: {
  activeParticipants: Participant[];
  eliminatedParticipants: Participant[];
  t: Translations;
}) {
  return (
    <section className="stacked-panels">
      <ParticipantSection participants={activeParticipants} status="active" t={t} title={t.activeParticipants} />
      <ParticipantSection participants={eliminatedParticipants} status="eliminated" t={t} title={t.eliminatedParticipants} />
    </section>
  );
}

function ParticipantSection({
  title,
  participants,
  status,
  t,
}: {
  title: string;
  participants: Participant[];
  status: "active" | "eliminated";
  t: Translations;
}) {
  const statusLabel = status === "active" ? t.active : t.eliminated;

  return (
    <section className="table-panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">{t.participants}</p>
          <h2>{title}</h2>
        </div>
        <span className={`status-badge ${status}`}>{participants.length} {statusLabel}</span>
      </div>

      {participants.length === 0 ? (
        <p className="empty-state">{t.noParticipants}</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{t.name}</th>
                <th>{t.country}</th>
                <th>{t.winnerPick}</th>
                <th>{t.points}</th>
              </tr>
            </thead>
            <tbody>
              {participants.map((participant) => (
                <tr key={participant.id}>
                  <td>{participant.name}</td>
                  <td>{participant.country}</td>
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
  t,
  teams,
}: {
  activeParticipants: Participant[];
  eliminatedParticipants: Participant[];
  t: Translations;
  teams: Team[];
}) {
  const participants = [...activeParticipants, ...eliminatedParticipants];

  return (
    <section className="table-panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">{t.winnerPredictions}</p>
          <h2>{t.finalPrediction}</h2>
        </div>
        <span className="status-badge active">{t.readOnly}</span>
      </div>

      {participants.length === 0 ? (
        <p className="empty-state">{t.noParticipants}</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{t.name}</th>
                <th>{t.country}</th>
                <th>{t.winnerPick}</th>
                <th>{t.status}</th>
              </tr>
            </thead>
            <tbody>
              {participants.map((participant) => {
                const pickedTeam = teams.find((team) => team.name === participant.winnerPick);
                const eliminated = pickedTeam?.status === "eliminated";

                return (
                  <tr key={participant.id}>
                    <td>{participant.name}</td>
                    <td>{participant.country}</td>
                    <td>{participant.winnerPick}</td>
                    <td>
                      <span className={`status-badge ${eliminated ? "eliminated" : "active"}`}>
                        {eliminated ? t.eliminated : t.active}
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
  lang,
  loginError,
  matchPredictions,
  matches,
  nextRefreshInMs,
  onLogin,
  participants,
  setAdminLoggedIn,
  setMatchPredictions,
  setMatches,
  setParticipants,
  setTeams,
  teams,
  t,
}: {
  apiStatus: ApiFootballStatus;
  adminLoggedIn: boolean;
  lang: Lang;
  loginError: string;
  matchPredictions: MatchPrediction[];
  matches: Match[];
  nextRefreshInMs: number;
  onLogin: (password: string) => void;
  participants: Participant[];
  setAdminLoggedIn: (value: boolean) => void;
  setMatchPredictions: React.Dispatch<React.SetStateAction<MatchPrediction[]>>;
  setMatches: React.Dispatch<React.SetStateAction<Match[]>>;
  setParticipants: React.Dispatch<React.SetStateAction<Participant[]>>;
  setTeams: React.Dispatch<React.SetStateAction<Team[]>>;
  teams: Team[];
  t: Translations;
}) {
  const firstTeamName = teams[0]?.name ?? "";
  const firstMatchId = matches[0]?.id ?? 0;
  const [adminPasswordInput, setAdminPasswordInput] = useState("");
  const [participantName, setParticipantName] = useState("");
  const [participantCountry, setParticipantCountry] = useState("");
  const [participantPick, setParticipantPick] = useState(firstTeamName);
  const [editingParticipantId, setEditingParticipantId] = useState<number | null>(null);
  const [selectedMatchId, setSelectedMatchId] = useState(firstMatchId);
  const [matchPrediction, setMatchPrediction] = useState("");
  const [matchConfidence, setMatchConfidence] = useState(50);
  const [scoreMatchId, setScoreMatchId] = useState(firstMatchId);
  const [homeScore, setHomeScore] = useState("");
  const [awayScore, setAwayScore] = useState("");
  const [scoreStatus, setScoreStatus] = useState<MatchStatus>("scheduled");
  const [teamToEliminate, setTeamToEliminate] = useState(firstTeamName);
  const groupValidationWarnings = useMemo(
    () => validateGroupStageData(teams, matches, t),
    [matches, t, teams],
  );

  useEffect(() => {
    if (!participantPick && firstTeamName) setParticipantPick(firstTeamName);
    if (!teamToEliminate && firstTeamName) setTeamToEliminate(firstTeamName);
    if (!selectedMatchId && firstMatchId) setSelectedMatchId(firstMatchId);
    if (!scoreMatchId && firstMatchId) setScoreMatchId(firstMatchId);
  }, [
    firstMatchId,
    firstTeamName,
    participantPick,
    scoreMatchId,
    selectedMatchId,
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
        <p className="eyebrow">{t.protected}</p>
        <h2>{t.adminPanel}</h2>
        <form className="admin-card" onSubmit={submitLogin}>
          <label>
            {t.password}
            <input
              type="password"
              value={adminPasswordInput}
              onChange={(event) => setAdminPasswordInput(event.target.value)}
              placeholder={t.enterAdminPassword}
            />
          </label>
          {loginError ? <p className="error-text">{loginError}</p> : null}
          <button type="submit">{t.login}</button>
        </form>
      </section>
    );
  }

  function saveParticipant(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!participantName.trim() || !participantCountry.trim()) return;

    if (editingParticipantId !== null) {
      setParticipants((current) =>
        current.map((participant) =>
          participant.id === editingParticipantId
            ? {
                ...participant,
                name: participantName.trim(),
                country: participantCountry.trim(),
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
          country: participantCountry.trim(),
          winnerPick: participantPick,
          points: 0,
        },
      ]);
    }

    setParticipantName("");
    setParticipantCountry("");
    setParticipantPick(firstTeamName);
  }

  function editParticipant(participant: Participant) {
    setEditingParticipantId(participant.id);
    setParticipantName(participant.name);
    setParticipantCountry(participant.country);
    setParticipantPick(participant.winnerPick);
  }

  function deleteParticipant(id: number) {
    setParticipants((current) => current.filter((participant) => participant.id !== id));
  }

  function saveMatchPrediction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!matchPrediction.trim()) return;

    setMatchPredictions((current) => [
      ...current.filter((prediction) => prediction.matchId !== selectedMatchId),
      {
        id: Date.now(),
        matchId: selectedMatchId,
        prediction: matchPrediction.trim(),
        confidence: matchConfidence,
      },
    ]);
    setMatchPrediction("");
    setMatchConfidence(50);
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
          <p className="eyebrow">{t.adminOnly}</p>
          <h2 id="admin-heading">{t.adminPanel}</h2>
        </div>
        <button className="secondary-button" type="button" onClick={() => setAdminLoggedIn(false)}>
          {t.logout}
        </button>
      </div>

      <div className="admin-grid">
        <form className="admin-card" onSubmit={saveParticipant}>
          <h3>{editingParticipantId === null ? t.addParticipant : t.editParticipant}</h3>
          {teams.length === 0 ? (
            <p className="empty-state">{t.teamsUnavailable}</p>
          ) : null}
          <label>
            {t.name}
            <input value={participantName} onChange={(event) => setParticipantName(event.target.value)} />
          </label>
          <label>
            {t.country}
            <input value={participantCountry} onChange={(event) => setParticipantCountry(event.target.value)} />
          </label>
          <label>
            {t.winnerPick}
            <select value={participantPick} onChange={(event) => setParticipantPick(event.target.value)}>
              {teams.map((team) => (
                <option key={team.name}>{team.name}</option>
              ))}
            </select>
          </label>
          <button type="submit" disabled={teams.length === 0}>{t.saveParticipant}</button>
        </form>

        <form className="admin-card" onSubmit={saveMatchPrediction}>
          <h3>{t.addMatchPrediction}</h3>
          {matches.length === 0 ? (
            <p className="empty-state">{t.matchesUnavailable}</p>
          ) : null}
          <label>
            {t.match}
            <select value={selectedMatchId} onChange={(event) => setSelectedMatchId(Number(event.target.value))}>
              {matches.map((match) => (
                <option key={match.id} value={match.id}>{getMatchLabel(match)}</option>
              ))}
            </select>
          </label>
          <label>
            {t.prediction}
            <input value={matchPrediction} onChange={(event) => setMatchPrediction(event.target.value)} />
          </label>
          <label>
            {t.confidence}
            <input type="number" min="0" max="100" value={matchConfidence} onChange={(event) => setMatchConfidence(Number(event.target.value))} />
          </label>
          <button type="submit" disabled={matches.length === 0}>{t.savePrediction}</button>
        </form>

        <form className="admin-card" onSubmit={updateScore}>
          <h3>{t.manualScoreUpdate}</h3>
          {matches.length === 0 ? (
            <p className="empty-state">{t.matchesUnavailable}</p>
          ) : null}
          <label>
            {t.match}
            <select value={scoreMatchId} onChange={(event) => setScoreMatchId(Number(event.target.value))}>
              {matches.map((match) => (
                <option key={match.id} value={match.id}>{getMatchLabel(match)}</option>
              ))}
            </select>
          </label>
          <div className="score-inputs">
            <label>
              {t.home}
              <input type="number" min="0" value={homeScore} onChange={(event) => setHomeScore(event.target.value)} />
            </label>
            <label>
              {t.away}
              <input type="number" min="0" value={awayScore} onChange={(event) => setAwayScore(event.target.value)} />
            </label>
          </div>
          <label>
            {t.status}
            <select value={scoreStatus} onChange={(event) => setScoreStatus(event.target.value as MatchStatus)}>
              <option value="scheduled">{t.scheduled}</option>
              <option value="live">{t.live}</option>
              <option value="final">{t.final}</option>
            </select>
          </label>
          <button type="submit" disabled={matches.length === 0}>{t.updateScore}</button>
        </form>

        <div className="admin-card">
          <h3>{t.eliminateTeam}</h3>
          {teams.length === 0 ? (
            <p className="empty-state">{t.teamsUnavailable}</p>
          ) : null}
          <label>
            {t.team}
            <select value={teamToEliminate} onChange={(event) => setTeamToEliminate(event.target.value)}>
              {teams.map((team) => (
                <option key={team.name}>{team.name}</option>
              ))}
            </select>
          </label>
          <button type="button" disabled={teams.length === 0} onClick={() => markEliminated(teamToEliminate)}>
            {t.markEliminated}
          </button>
          <p className="rule-note">{t.eliminationRule}</p>
        </div>

        <div className="admin-card audit-card">
          <h3>{t.manageParticipants}</h3>
          {participants.length === 0 ? (
            <p className="muted">{t.noParticipants}</p>
          ) : (
            <ul>
              {participants.map((participant) => (
                <li key={participant.id}>
                  <span>{participant.name} · {participant.winnerPick}</span>
                  <div className="inline-actions">
                    <button type="button" onClick={() => editParticipant(participant)}>{t.edit}</button>
                    <button type="button" onClick={() => deleteParticipant(participant.id)}>{t.delete}</button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="admin-card api-debug-card">
          <h3>{t.apiDebugStatus}</h3>
          <dl className="debug-list">
            <div>
              <dt>{t.baseUrl}</dt>
              <dd>{apiStatus.baseUrl}</dd>
            </div>
            <div>
              <dt>{t.header}</dt>
              <dd>{apiStatus.headerName}</dd>
            </div>
            <div>
              <dt>{t.apiKeyLoaded}</dt>
              <dd>{apiStatus.apiKeyLoaded ? t.yes : t.no}</dd>
            </div>
            <div>
              <dt>{t.loading}</dt>
              <dd>{apiStatus.loading ? t.yes : t.no}</dd>
            </div>
            <div>
              <dt>{t.lastUpdated}</dt>
              <dd>{formatDateTime(apiStatus.lastUpdatedAt, lang)}</dd>
            </div>
            <div>
              <dt>{t.nextRefresh}</dt>
              <dd>{formatDuration(nextRefreshInMs)}</dd>
            </div>
            <div>
              <dt>{t.refreshInterval}</dt>
              <dd>{formatDuration(apiStatus.refreshIntervalMs)}</dd>
            </div>
            <div>
              <dt>{t.connected}</dt>
              <dd>{apiStatus.connected ? t.yes : t.no}</dd>
            </div>
            <div>
              <dt>{t.liveEndpointChecked}</dt>
              <dd>{apiStatus.liveEndpointChecked ? t.yes : t.no}</dd>
            </div>
            <div>
              <dt>{t.dataSource}</dt>
              <dd>{apiStatus.source}</dd>
            </div>
            <div>
              <dt>{t.groupStageDataSource}</dt>
              <dd>{(apiStatus.groupStageDataSources ?? ["Manual group fallback"]).join(" + ")}</dd>
            </div>
            <div>
              <dt>{t.requestsToday}</dt>
              <dd>{apiStatus.requestCountToday}/{apiStatus.dailyLimit}</dd>
            </div>
            <div>
              <dt>{t.usageClose}</dt>
              <dd>{apiStatus.usageCloseToLimit ? t.yes : t.no}</dd>
            </div>
            <div>
              <dt>{t.todaysScheduledMatches}</dt>
              <dd>{apiStatus.todaysScheduledMatches}</dd>
            </div>
            <div>
              <dt>{t.lastEndpoint}</dt>
              <dd>{apiStatus.lastEndpoint}</dd>
            </div>
            <div>
              <dt>{t.exactApiError}</dt>
              <dd>{apiStatus.lastError || t.none}</dd>
            </div>
            <div className="debug-wide">
              <dt>{t.groupValidation}</dt>
              <dd>
                {groupValidationWarnings.length === 0 ? (
                  <span className="success-text">{t.validationOk}</span>
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
        {t.adminDataNote}
      </p>
    </section>
  );
}
