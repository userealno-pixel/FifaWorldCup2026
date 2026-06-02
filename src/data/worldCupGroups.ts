export const WORLD_CUP_2026_GROUPS = {
  "Group A": ["Mexico", "South Africa", "South Korea", "Czechia"],
  "Group B": ["Canada", "Bosnia and Herzegovina", "Qatar", "Switzerland"],
  "Group C": ["Brazil", "Morocco", "Haiti", "Scotland"],
  "Group D": ["United States", "Paraguay", "Australia", "Türkiye"],
  "Group E": ["Germany", "Curaçao", "Ivory Coast", "Ecuador"],
  "Group F": ["Netherlands", "Japan", "Tunisia", "Sweden"],
  "Group G": ["Belgium", "Egypt", "Iran", "New Zealand"],
  "Group H": ["Spain", "Cape Verde", "Saudi Arabia", "Uruguay"],
  "Group I": ["France", "Senegal", "Norway", "Iraq"],
  "Group J": ["Argentina", "Algeria", "Austria", "Jordan"],
  "Group K": ["Portugal", "Uzbekistan", "Colombia", "DR Congo"],
  "Group L": ["England", "Croatia", "Ghana", "Panama"],
} as const;

const TEAM_NAME_ALIASES: Record<string, string> = {
  "Bosnia & Herzegovina": "Bosnia and Herzegovina",
  "Cape Verde Islands": "Cape Verde",
  "Congo DR": "DR Congo",
  "Czech Republic": "Czechia",
  "Côte d'Ivoire": "Ivory Coast",
  "Korea Republic": "South Korea",
  "South Korea": "South Korea",
  "Turkey": "Türkiye",
  "Turkiye": "Türkiye",
  "Türkiye": "Türkiye",
  "USA": "United States",
  "United States": "United States",
};

export function normalizeTeamNameForGroups(teamName: string) {
  return TEAM_NAME_ALIASES[teamName] ?? teamName;
}

export function getManualGroupForTeam(teamName: string) {
  const normalizedName = normalizeTeamNameForGroups(teamName);

  return (
    Object.entries(WORLD_CUP_2026_GROUPS).find(([, teams]) =>
      teams.includes(normalizedName as never),
    )?.[0] ?? ""
  );
}

export function getManualGroupForFixture(homeTeam: string, awayTeam: string) {
  const homeGroup = getManualGroupForTeam(homeTeam);
  const awayGroup = getManualGroupForTeam(awayTeam);

  return homeGroup && homeGroup === awayGroup ? homeGroup : "";
}

export function getGroupSortValue(group: string) {
  const match = group.match(/Group\s+([A-L])/i);

  return match ? match[1].toUpperCase().charCodeAt(0) : 999;
}
