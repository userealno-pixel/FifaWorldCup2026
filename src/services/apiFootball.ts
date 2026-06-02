import {
  getGroupSortValue,
  getManualGroupForFixture,
  getManualGroupForTeam,
} from "../data/worldCupGroups";

export const API_FOOTBALL_BASE_URL = "https://v3.football.api-sports.io";

const WORLD_CUP_LEAGUE_ID = 1;
const WORLD_CUP_SEASON = 2026;
const API_USAGE_STORAGE_KEY = "api-football-usage";
const API_CACHE_STORAGE_KEY = "api-football-world-cup-2026-cache-v4";
const DEFAULT_DAILY_LIMIT = 100;

export type AppMatchStatus = "scheduled" | "live" | "final";
export type AppStage = "group" | "knockout";

export type AppTeam = {
  name: string;
  group: string;
  status: "active" | "eliminated";
  rank?: number;
  points?: number;
  played?: number;
  wins?: number;
  draws?: number;
  losses?: number;
  goalsFor?: number;
  goalsAgainst?: number;
  goalDifference?: number;
  advanced?: boolean;
};

export type AppMatch = {
  id: number;
  group: string;
  groupSource: "api" | "manual" | "unknown";
  round: string;
  stage: AppStage;
  home: string;
  away: string;
  stadium: string;
  city: string;
  date: string;
  localTime: string;
  timestamp: number;
  status: AppMatchStatus;
  statusText: string;
  elapsed: number | null;
  homeScore: number | null;
  awayScore: number | null;
  homeWinner: boolean | null;
  awayWinner: boolean | null;
};

export type ApiFootballStatus = {
  baseUrl: string;
  headerName: "x-apisports-key";
  apiKeyLoaded: boolean;
  connected: boolean;
  loading: boolean;
  lastEndpoint: string;
  lastError: string;
  lastUpdatedAt: string;
  message: string;
  source: "world-cup-2026" | "none";
  liveEndpointChecked: boolean;
  nextRefreshAt: string;
  refreshIntervalMs: number;
  requestCountToday: number;
  dailyLimit: number;
  usageCloseToLimit: boolean;
  todaysScheduledMatches: number;
  groupStageDataSources: ("API group data" | "Local calculated standings" | "Manual group fallback")[];
  retryCount: number;
};

export type ApiFootballSyncResult = {
  fixtures: AppMatch[];
  teams: AppTeam[];
  status: ApiFootballStatus;
};

type CachedApiFootballSyncResult = ApiFootballSyncResult & {
  cachedAt: string;
};

type ApiFootballFixture = {
  fixture: {
    id: number;
    date: string;
    timestamp: number;
    status: {
      elapsed: number | null;
      long: string;
      short: string;
    };
    venue?: {
      name?: string;
      city?: string;
    };
  };
  league?: {
    name?: string;
    round?: string;
  };
  teams: {
    home: {
      name: string;
      winner: boolean | null;
    };
    away: {
      name: string;
      winner: boolean | null;
    };
  };
  goals: {
    home: number | null;
    away: number | null;
  };
};

type ApiFootballStanding = {
  rank: number;
  group: string;
  points: number;
  all: {
    played: number;
    goals: {
      for: number;
      against: number;
    };
  };
  team: {
    name: string;
  };
};

type ApiFootballStandingsPayload = {
  league: {
    standings: ApiFootballStanding[][];
  };
};

type ApiFootballTeam = {
  team: {
    name: string;
  };
};

type ApiFootballResponse<T> = {
  errors?: unknown;
  response?: T[];
};

class ApiFootballError extends Error {
  constructor(
    message: string,
    readonly endpoint: string,
  ) {
    super(message);
  }
}

export function createApiFootballStatus(
  overrides: Partial<ApiFootballStatus> = {},
): ApiFootballStatus {
  const usage = getUsageState();

  return {
    baseUrl: API_FOOTBALL_BASE_URL,
    headerName: "x-apisports-key",
    apiKeyLoaded: Boolean(getApiKey()),
    connected: false,
    loading: false,
    lastEndpoint: "not requested",
    lastError: "",
    lastUpdatedAt: "",
    message: getApiKey() ? "API-Football ready to connect" : "API key is not connected yet",
    source: "none",
    liveEndpointChecked: false,
    nextRefreshAt: "",
    refreshIntervalMs: 0,
    requestCountToday: usage.count,
    dailyLimit: usage.limit,
    usageCloseToLimit: isUsageCloseToLimit(usage.count, usage.limit),
    todaysScheduledMatches: 0,
    groupStageDataSources: ["Manual group fallback"],
    retryCount: 0,
    ...overrides,
  };
}

function getApiKey() {
  return import.meta.env.VITE_API_FOOTBALL_KEY?.trim();
}

function getDailyLimit() {
  const configuredLimit = Number(import.meta.env.VITE_API_FOOTBALL_DAILY_LIMIT);
  return Number.isFinite(configuredLimit) && configuredLimit > 0
    ? configuredLimit
    : DEFAULT_DAILY_LIMIT;
}

function getTodayKey() {
  return new Date().toISOString().slice(0, 10);
}

function getUsageState() {
  const limit = getDailyLimit();

  try {
    const raw = window.localStorage.getItem(API_USAGE_STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as { date: string; count: number }) : null;

    if (parsed?.date === getTodayKey()) {
      return { count: parsed.count, limit };
    }
  } catch {
    return { count: 0, limit };
  }

  return { count: 0, limit };
}

function recordApiRequest() {
  const usage = getUsageState();
  const nextUsage = { date: getTodayKey(), count: usage.count + 1 };
  window.localStorage.setItem(API_USAGE_STORAGE_KEY, JSON.stringify(nextUsage));

  return {
    count: nextUsage.count,
    limit: usage.limit,
  };
}

function canMakeApiRequest() {
  const usage = getUsageState();
  return usage.count < usage.limit;
}

function isUsageCloseToLimit(count: number, limit: number) {
  return limit > 0 && count / limit >= 0.8;
}

export function getSharedApiCache() {
  try {
    const raw = window.localStorage.getItem(API_CACHE_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as CachedApiFootballSyncResult) : null;
  } catch {
    return null;
  }
}

function saveSharedApiCache(result: ApiFootballSyncResult) {
  const cached: CachedApiFootballSyncResult = {
    ...result,
    cachedAt: new Date().toISOString(),
  };

  window.localStorage.setItem(API_CACHE_STORAGE_KEY, JSON.stringify(cached));
}

function delay(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function requestApiFootball<T>(
  path: string,
  params: Record<string, string | number>,
  attempt = 0,
): Promise<{ endpoint: string; response: T[] }> {
  const apiKey = getApiKey();
  const url = new URL(`${API_FOOTBALL_BASE_URL}${path}`);
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, String(value));
  });
  const endpoint = `${path}?${url.searchParams.toString()}`;

  if (!apiKey) {
    throw new ApiFootballError("API key is not connected yet", endpoint);
  }

  if (!canMakeApiRequest()) {
    throw new ApiFootballError("API request limit reached for today", endpoint);
  }

  try {
    const response = await fetch(url, {
      headers: {
        "x-apisports-key": apiKey,
      },
    });
    recordApiRequest();

    const payload = (await response.json()) as ApiFootballResponse<T>;

    if (!response.ok) {
      throw new ApiFootballError(
        getPayloadError(payload) || `HTTP ${response.status}: ${response.statusText}`,
        endpoint,
      );
    }

    const apiError = getPayloadError(payload);
    if (apiError) {
      throw new ApiFootballError(apiError, endpoint);
    }

    return {
      endpoint,
      response: payload.response ?? [],
    };
  } catch (error) {
    const apiError =
      error instanceof ApiFootballError
        ? error
        : new ApiFootballError("API-Football request failed", endpoint);

    console.error("[API-Football]", {
      baseUrl: API_FOOTBALL_BASE_URL,
      endpoint: apiError.endpoint,
      header: "x-apisports-key",
      message: apiError.message,
      originalError: error,
    });

    if (attempt < 2 && apiError.message !== "API key is not connected yet") {
      await delay(750 * (attempt + 1));
      return requestApiFootball<T>(path, params, attempt + 1);
    }

    throw apiError;
  }
}

export async function getWorldCupFixtures() {
  const fixtures = await requestApiFootball<ApiFootballFixture>("/fixtures", {
    league: WORLD_CUP_LEAGUE_ID,
    season: WORLD_CUP_SEASON,
  });

  return {
    endpoint: fixtures.endpoint,
    fixtures: fixtures.response.map(normalizeFixture).sort((a, b) => a.timestamp - b.timestamp),
  };
}

export async function getLiveFixtures() {
  const fixtures = await requestApiFootball<ApiFootballFixture>("/fixtures", {
    league: WORLD_CUP_LEAGUE_ID,
    season: WORLD_CUP_SEASON,
    live: "all",
  });

  return {
    endpoint: fixtures.endpoint,
    fixtures: fixtures.response.map(normalizeFixture),
  };
}

export async function getTeams() {
  const teams = await requestApiFootball<ApiFootballTeam>("/teams", {
    league: WORLD_CUP_LEAGUE_ID,
    season: WORLD_CUP_SEASON,
  });

  return {
    endpoint: teams.endpoint,
    teams: teams.response.map((item) => ({
      name: item.team.name,
      group: getManualGroupForTeam(item.team.name) || "TBD",
      status: "active" as const,
    })),
  };
}

export async function getWorldCupStandings() {
  const standings = await requestApiFootball<ApiFootballStandingsPayload>("/standings", {
    league: WORLD_CUP_LEAGUE_ID,
    season: WORLD_CUP_SEASON,
  });
  const rows = standings.response.flatMap((item) => item.league.standings).flat();

  return {
    endpoint: standings.endpoint,
    teams: rows.map((row) => ({
      name: row.team.name,
      group: normalizeGroupName(row.group),
      status: "active" as const,
      rank: row.rank,
      points: row.points,
      played: row.all.played,
      wins: 0,
      draws: 0,
      losses: 0,
      goalsFor: row.all.goals.for,
      goalsAgainst: row.all.goals.against,
      goalDifference: row.all.goals.for - row.all.goals.against,
      advanced: row.rank <= 2,
    })),
  };
}

export async function syncFixturesWithApp(): Promise<ApiFootballSyncResult> {
  if (!getApiKey()) {
    return {
      fixtures: [],
      teams: [],
      status: createApiFootballStatus({
        message: "API key is not connected yet",
        lastError: "API key is not connected yet",
      }),
    };
  }

  try {
    let liveFixtures: Awaited<ReturnType<typeof getLiveFixtures>> = {
      endpoint: "/fixtures?league=1&season=2026&live=all",
      fixtures: [],
    };
    let liveError = "";

    try {
      liveFixtures = await getLiveFixtures();
    } catch (error) {
      liveError = error instanceof Error ? error.message : "Live fixtures endpoint failed";
      console.error("[API-Football live endpoint test]", error);
    }

    const [worldCupFixtures, apiTeams, standingsTeams] = await Promise.all([
      getWorldCupFixtures(),
      getTeams(),
      getWorldCupStandings().catch((error) => {
        console.error("[API-Football standings]", error);
        return { endpoint: "/standings?league=1&season=2026", teams: [] };
      }),
    ]);
    const fixtures = mergeLiveFixtures(worldCupFixtures.fixtures, liveFixtures.fixtures);
    const teams = mergeTeamData(apiTeams.teams, standingsTeams.teams, fixtures);
    const groupStageDataSources = getGroupStageDataSources(standingsTeams.teams, fixtures);
    const result = {
      fixtures,
      teams,
      status: createApiFootballStatus({
        connected: true,
        lastEndpoint: worldCupFixtures.endpoint,
        lastError: liveError,
        lastUpdatedAt: new Date().toISOString(),
        liveEndpointChecked: true,
        message: liveError || "API-Football connected",
        source: "world-cup-2026",
        todaysScheduledMatches: countTodaysScheduledMatches(fixtures),
        groupStageDataSources,
      }),
    };

    saveSharedApiCache(result);
    return result;
  } catch (error) {
    const apiError =
      error instanceof ApiFootballError
        ? error
        : new ApiFootballError("API-Football is not available right now", "unknown");
    const cached = getSharedApiCache();

    console.error("[API-Football sync]", apiError.message);

    return {
      fixtures: cached?.fixtures ?? [],
      teams: cached?.teams ?? [],
      status: createApiFootballStatus({
        lastEndpoint: apiError.endpoint,
        lastError: apiError.message,
        lastUpdatedAt: cached?.status.lastUpdatedAt ?? "",
        message: apiError.message,
        retryCount: 1,
        source: cached?.status.source ?? "none",
      }),
    };
  }
}

function getPayloadError<T>(payload: ApiFootballResponse<T>) {
  if (!payload.errors) return "";

  if (typeof payload.errors === "string") return payload.errors;
  if (Array.isArray(payload.errors)) return payload.errors.join(", ");
  if (typeof payload.errors === "object") {
    const values = Object.values(payload.errors as Record<string, unknown>)
      .flat()
      .filter(Boolean)
      .map(String);

    return values.join(", ");
  }

  return String(payload.errors);
}

function normalizeFixture(item: ApiFootballFixture): AppMatch {
  const date = new Date(item.fixture.date);
  const round = normalizeRound(item.league?.round ?? item.league?.name);
  const groupInfo = getFixtureGroupInfo(item.teams.home.name, item.teams.away.name, round);

  return {
    id: item.fixture.id,
    group: groupInfo.group,
    groupSource: groupInfo.source,
    round,
    stage: groupInfo.group !== "Knockout" ? "group" : "knockout",
    home: item.teams.home.name,
    away: item.teams.away.name,
    stadium: item.fixture.venue?.name ?? "Venue TBD",
    city: item.fixture.venue?.city ?? "City TBD",
    date: Number.isNaN(date.getTime()) ? "Date TBD" : date.toISOString().slice(0, 10),
    localTime: Number.isNaN(date.getTime())
      ? "Time TBD"
      : date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    timestamp: item.fixture.timestamp ?? Math.floor(date.getTime() / 1000),
    status: normalizeStatus(item.fixture.status.short),
    statusText: item.fixture.status.long,
    elapsed: item.fixture.status.elapsed,
    homeScore: item.goals.home,
    awayScore: item.goals.away,
    homeWinner: item.teams.home.winner,
    awayWinner: item.teams.away.winner,
  };
}

function mergeLiveFixtures(fixtures: AppMatch[], liveFixtures: AppMatch[]) {
  const liveById = new Map(liveFixtures.map((fixture) => [fixture.id, fixture]));

  return fixtures.map((fixture) => liveById.get(fixture.id) ?? fixture);
}

function mergeTeamData(apiTeams: AppTeam[], standingsTeams: AppTeam[], fixtures: AppMatch[]) {
  const teamMap = new Map<string, AppTeam>();

  apiTeams.forEach((team) =>
    teamMap.set(team.name, {
      ...team,
      group: getManualGroupForTeam(team.name) || normalizeGroupName(team.group),
    }),
  );
  fixtures.forEach((fixture) => {
    const homeGroup = getManualGroupForTeam(fixture.home) || fixture.group;
    const awayGroup = getManualGroupForTeam(fixture.away) || fixture.group;

    if (!teamMap.has(fixture.home)) {
      teamMap.set(fixture.home, { name: fixture.home, group: homeGroup, status: "active" });
    }
    if (!teamMap.has(fixture.away)) {
      teamMap.set(fixture.away, { name: fixture.away, group: awayGroup, status: "active" });
    }
  });
  standingsTeams.forEach((team) => {
    const apiGroup = normalizeGroupName(team.group);
    const group = apiGroup.startsWith("Group") ? apiGroup : getManualGroupForTeam(team.name) || apiGroup;

    teamMap.set(team.name, { ...(teamMap.get(team.name) ?? team), ...team, group });
  });

  return calculateLocalStandings(Array.from(teamMap.values()), fixtures);
}

function calculateLocalStandings(teams: AppTeam[], fixtures: AppMatch[]) {
  const standings = new Map<string, AppTeam>();

  teams.forEach((team) => {
    const normalizedGroup = normalizeGroupName(team.group);
    const group = isRealGroupName(normalizedGroup)
      ? normalizedGroup
      : getManualGroupForTeam(team.name) || normalizedGroup;

    standings.set(team.name, {
      ...team,
      group,
      rank: 0,
      points: 0,
      played: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      goalDifference: 0,
      advanced: false,
    });
  });

  fixtures
    .filter((fixture) => fixture.stage === "group")
    .forEach((fixture) => {
      const fixtureGroup = getManualGroupForFixture(fixture.home, fixture.away) || fixture.group;
      const homeTeam = standings.get(fixture.home) ?? {
        name: fixture.home,
        group: fixtureGroup,
        status: "active" as const,
        rank: 0,
        points: 0,
        played: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        goalDifference: 0,
        advanced: false,
      };
      const awayTeam = standings.get(fixture.away) ?? {
        name: fixture.away,
        group: fixtureGroup,
        status: "active" as const,
        rank: 0,
        points: 0,
        played: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        goalDifference: 0,
        advanced: false,
      };

      standings.set(fixture.home, { ...homeTeam, group: getManualGroupForTeam(fixture.home) || fixtureGroup });
      standings.set(fixture.away, { ...awayTeam, group: getManualGroupForTeam(fixture.away) || fixtureGroup });

      if (fixture.homeScore === null || fixture.awayScore === null || fixture.status === "scheduled") {
        return;
      }

      applyMatchResult(standings, fixture.home, fixture.homeScore, fixture.awayScore);
      applyMatchResult(standings, fixture.away, fixture.awayScore, fixture.homeScore);
    });

  const groupedTeams = new Map<string, AppTeam[]>();

  Array.from(standings.values()).forEach((team) => {
    groupedTeams.set(team.group, [...(groupedTeams.get(team.group) ?? []), team]);
  });

  groupedTeams.forEach((groupTeams) => {
    groupTeams
      .sort(compareStandingRows)
      .forEach((team, index) => {
        team.rank = index + 1;
        team.advanced = index < 2;
      });
  });

  return Array.from(standings.values()).sort((a, b) => {
    if (a.group !== b.group) return getGroupSortValue(a.group) - getGroupSortValue(b.group);
    return compareStandingRows(a, b);
  });
}

function applyMatchResult(
  standings: Map<string, AppTeam>,
  teamName: string,
  goalsFor: number,
  goalsAgainst: number,
) {
  const team = standings.get(teamName);
  if (!team) return;

  const won = goalsFor > goalsAgainst;
  const drawn = goalsFor === goalsAgainst;
  const points = won ? 3 : drawn ? 1 : 0;

  standings.set(teamName, {
    ...team,
    played: (team.played ?? 0) + 1,
    wins: (team.wins ?? 0) + (won ? 1 : 0),
    draws: (team.draws ?? 0) + (drawn ? 1 : 0),
    losses: (team.losses ?? 0) + (!won && !drawn ? 1 : 0),
    goalsFor: (team.goalsFor ?? 0) + goalsFor,
    goalsAgainst: (team.goalsAgainst ?? 0) + goalsAgainst,
    goalDifference: (team.goalDifference ?? 0) + goalsFor - goalsAgainst,
    points: (team.points ?? 0) + points,
  });
}

function compareStandingRows(a: AppTeam, b: AppTeam) {
  return (
    (b.points ?? 0) - (a.points ?? 0) ||
    (b.goalDifference ?? 0) - (a.goalDifference ?? 0) ||
    (b.goalsFor ?? 0) - (a.goalsFor ?? 0) ||
    a.name.localeCompare(b.name)
  );
}

function countTodaysScheduledMatches(fixtures: AppMatch[]) {
  const today = new Date().toISOString().slice(0, 10);

  return fixtures.filter((fixture) => fixture.date === today && fixture.status !== "final").length;
}

function normalizeRound(round?: string) {
  if (!round) return "TBD";
  return round
    .replace("Group Stage - ", "Group ")
    .replace("Group Stage", "Group Stage")
    .replace("3rd Place Final", "Third place match");
}

function normalizeGroupName(group: string) {
  const manualGroup = getManualGroupForTeam(group);
  if (manualGroup) return manualGroup;

  const letterMatch = group.match(/Group\s+([A-L])/i);
  if (letterMatch) return `Group ${letterMatch[1].toUpperCase()}`;

  return group;
}

function getGroupStageDataSources(standingsTeams: AppTeam[], fixtures: AppMatch[]) {
  const sources = new Set<"API group data" | "Local calculated standings" | "Manual group fallback">();

  if (standingsTeams.length > 0) {
    sources.add("API group data");
  } else {
    sources.add("Local calculated standings");
  }

  if (fixtures.some((fixture) => fixture.stage === "group" && fixture.groupSource === "manual")) {
    sources.add("Manual group fallback");
  }

  return Array.from(sources);
}

function getFixtureGroupInfo(homeTeam: string, awayTeam: string, round: string) {
  const groupFromRound = normalizeGroupName(round);
  if (isRealGroupName(groupFromRound)) return { group: groupFromRound, source: "api" as const };

  const manualGroup = getManualGroupForFixture(homeTeam, awayTeam);
  if (manualGroup) return { group: manualGroup, source: "manual" as const };

  return {
    group: round.toLowerCase().includes("group") ? "Group Stage" : "Knockout",
    source: "unknown" as const,
  };
}

function isRealGroupName(group: string) {
  return /^Group\s+[A-L]$/i.test(group);
}

function normalizeStatus(status: string): AppMatchStatus {
  if (["1H", "2H", "HT", "ET", "P", "BT", "LIVE"].includes(status)) {
    return "live";
  }

  if (["FT", "AET", "PEN"].includes(status)) {
    return "final";
  }

  return "scheduled";
}
