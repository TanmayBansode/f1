// F1 data transformer — converts raw scraped rows into the 2026.json schema
// Pure functions, no side effects

import type { RawDriverRow, ScrapeResult, ResultType } from "./f1-scraper";
import { RACE_POINTS, SPRINT_POINTS, FASTEST_LAP_BONUS, getDriverById } from "./f1-driver-registry";

// ─────────────────────────────────────────────────────────────────────────────
// Types that match 2026.json
// ─────────────────────────────────────────────────────────────────────────────

export interface RaceResultEntry {
  position: number;
  driverNumber: number | null;
  driverId: string;
  driver: string;
  team: string;
  startingGrid: number | null;
  laps: number;
  time: string;
  points: number;
  fastestLapTime?: string | null;
  setFastestLap?: boolean;
  status?: string;
}

export interface QualifyingResultEntry {
  position: number;
  driverNumber: number | null;
  driverId: string;
  driver: string;
  team: string;
  q1: string | null;
  q2: string | null;
  q3: string | null;
  laps: number;
}

export interface SprintResultEntry {
  position: number;
  driverNumber: number | null;
  driverId: string;
  driver: string;
  team: string;
  startingGrid: number | null;
  laps: number;
  time: string;
  points: number;
  status?: string;
}

export interface DriverResultEntry {
  round: number;
  position: number;
  points: number;
  cumulativePoints: number;
  grid?: number | null;
  fastestLapTime?: string;
  setFastestLap?: boolean;
  status?: string;
}

export interface DriverUpdate {
  driverId: string;
  driverName: string;
  pointsEarned: number;
  newCumulativePoints: number;
  previousCumulativePoints: number;
  newEntry: DriverResultEntry;
  found: boolean; // whether driver exists in current JSON
}

export interface ConstructorUpdate {
  teamId: string;
  teamName: string;
  previousPoints: number;
  pointsAdded: number;
  newPoints: number;
}

export interface RaceEntry {
  round: number;
  name: string;
  shortName: string;
  date: string;
  type: "race" | "qualifying" | "sprint" | "sprint-qualifying"; // adjusted below
  circuit: string;
  location: string;
}

export interface TransformResult {
  raceEntry: RaceEntry;
  raceDetailUpdate: RaceDetailUpdate;
  driverUpdates: DriverUpdate[];
  constructorUpdates: ConstructorUpdate[];
  validationErrors: string[];
  warnings: string[];
  computedPoints: Record<string, number>; // driverId → points
}

export interface RaceDetailUpdate {
  round: number;
  type: ResultType;
  raceResults?: RaceResultEntry[];
  qualifyingResults?: QualifyingResultEntry[];
  sprintResults?: SprintResultEntry[];
  sprintQualifyingResults?: QualifyingResultEntry[];
}

// ─────────────────────────────────────────────────────────────────────────────
// GP metadata lookup (circuit + location by GP name)
// ─────────────────────────────────────────────────────────────────────────────

const GP_META: Record<string, { circuit: string; location: string }> = {
  Australia: { circuit: "Albert Park Circuit", location: "Melbourne, Australia" },
  China: { circuit: "Shanghai International Circuit", location: "Shanghai, China" },
  Japan: { circuit: "Suzuka International Racing Course", location: "Suzuka, Japan" },
  Bahrain: { circuit: "Bahrain International Circuit", location: "Sakhir, Bahrain" },
  "Saudi Arabia": { circuit: "Jeddah Corniche Circuit", location: "Jeddah, Saudi Arabia" },
  Miami: { circuit: "Miami International Autodrome", location: "Miami, USA" },
  "Emilia Romagna": { circuit: "Autodromo Enzo e Dino Ferrari", location: "Imola, Italy" },
  Monaco: { circuit: "Circuit de Monaco", location: "Monte Carlo, Monaco" },
  Canada: { circuit: "Circuit Gilles Villeneuve", location: "Montreal, Canada" },
  Spain: { circuit: "Circuit de Barcelona-Catalunya", location: "Barcelona, Spain" },
  Austria: { circuit: "Red Bull Ring", location: "Spielberg, Austria" },
  "Great Britain": { circuit: "Silverstone Circuit", location: "Silverstone, UK" },
  Hungary: { circuit: "Hungaroring", location: "Budapest, Hungary" },
  Belgium: { circuit: "Circuit de Spa-Francorchamps", location: "Spa, Belgium" },
  Netherlands: { circuit: "Circuit Zandvoort", location: "Zandvoort, Netherlands" },
  Italy: { circuit: "Autodromo Nazionale Monza", location: "Monza, Italy" },
  Azerbaijan: { circuit: "Baku City Circuit", location: "Baku, Azerbaijan" },
  Singapore: { circuit: "Marina Bay Street Circuit", location: "Singapore" },
  "United States": { circuit: "Circuit of the Americas", location: "Austin, USA" },
  Mexico: { circuit: "Autodromo Hermanos Rodriguez", location: "Mexico City, Mexico" },
  "Sao Paulo": { circuit: "Autodromo Jose Carlos Pace", location: "São Paulo, Brazil" },
  "Las Vegas": { circuit: "Las Vegas Strip Circuit", location: "Las Vegas, USA" },
  Qatar: { circuit: "Lusail International Circuit", location: "Lusail, Qatar" },
  "Abu Dhabi": { circuit: "Yas Marina Circuit", location: "Abu Dhabi, UAE" },
};

export function resolveGpMeta(gpName: string): { circuit: string; location: string } {
  if (GP_META[gpName]) return GP_META[gpName];
  // Partial match
  const key = Object.keys(GP_META).find((k) =>
    gpName.toLowerCase().includes(k.toLowerCase()) || k.toLowerCase().includes(gpName.toLowerCase())
  );
  return key ? GP_META[key] : { circuit: "Unknown Circuit", location: "Unknown Location" };
}

// ─────────────────────────────────────────────────────────────────────────────
// Main transformer
// ─────────────────────────────────────────────────────────────────────────────

export function transform(
  scrape: ScrapeResult,
  currentJson: F1SeasonData,
  overrides: TransformOverrides
): TransformResult {
  const validationErrors: string[] = [];
  const warnings: string[] = [...scrape.parseWarnings];

  // Determine next round number
  const existingRounds = currentJson.races.map((r) => r.round as number);
  const newRound = overrides.roundNumber ?? (existingRounds.length > 0 ? Math.max(...existingRounds) + 1 : 1);

  // Check duplicate
  if (existingRounds.includes(newRound)) {
    validationErrors.push(`Round ${newRound} already exists in the JSON. Change the round number.`);
  }

  // Check unknown drivers
  if (scrape.unknownDrivers.length > 0) {
    validationErrors.push(`Unknown drivers: ${scrape.unknownDrivers.join(", ")} — cannot proceed without resolving.`);
  }

  const gpMeta = resolveGpMeta(scrape.gpName);
  const gpName = overrides.gpName || scrape.gpName;

  // Build races[] entry
  const raceEntry = buildRaceEntry(newRound, scrape.type, gpName, overrides, gpMeta);

  // Build raceDetails entry
  const raceDetailUpdate = buildRaceDetail(newRound, scrape.type, scrape.rows, overrides);

  // Compute points (override scrape's points which may be wrong)
  const computedPoints = computePointsMap(scrape.type, scrape.rows);

  // Driver updates
  const driverUpdates = buildDriverUpdates(newRound, scrape.type, scrape.rows, computedPoints, currentJson);

  // Constructor updates
  const constructorUpdates = buildConstructorUpdates(driverUpdates, currentJson);

  // Validate points
  if (scrape.type === "race") {
    const totalComputed = Object.values(computedPoints).reduce((a, b) => a + b, 0);
    if (totalComputed === 0) {
      warnings.push("No points computed — verify race results are correct.");
    }
  }

  return {
    raceEntry,
    raceDetailUpdate,
    driverUpdates,
    constructorUpdates,
    validationErrors,
    warnings,
    computedPoints,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function buildRaceEntry(
  round: number,
  type: ResultType,
  gpName: string,
  overrides: TransformOverrides,
  gpMeta: { circuit: string; location: string }
): RaceEntry {
  const typeMap: Record<ResultType, { suffix: string; shortSuffix: string; raceType: RaceEntry["type"] }> = {
    race: { suffix: "Grand Prix", shortSuffix: "", raceType: "race" },
    qualifying: { suffix: "Grand Prix Qualifying", shortSuffix: "-Q", raceType: "qualifying" },
    sprint: { suffix: "Grand Prix Sprint", shortSuffix: "-S", raceType: "sprint" },
    "sprint-qualifying": { suffix: "Grand Prix Sprint Qualifying", shortSuffix: "-SQ", raceType: "sprint-qualifying" as "qualifying" },
  };

  const meta = typeMap[type];
  const country = gpNameToCountryAbbr(gpName);
  const name = `${gpName} ${meta.suffix}`;
  const shortName = `${country}${meta.shortSuffix}`;

  return {
    round,
    name,
    shortName,
    date: overrides.date || new Date().toISOString().split("T")[0],
    type: meta.raceType,
    circuit: overrides.circuit || gpMeta.circuit,
    location: overrides.location || gpMeta.location,
  };
}

function gpNameToCountryAbbr(gpName: string): string {
  const abbrs: Record<string, string> = {
    Australia: "AUS", China: "CHN", Japan: "JPN", Bahrain: "BHR",
    "Saudi Arabia": "KSA", Miami: "MIA", "Emilia Romagna": "EMR",
    Monaco: "MON", Canada: "CAN", Spain: "ESP", Austria: "AUT",
    "Great Britain": "GBR", Hungary: "HUN", Belgium: "BEL",
    Netherlands: "NLD", Italy: "ITA", Azerbaijan: "AZE",
    Singapore: "SGP", "United States": "USA", Mexico: "MEX",
    "Sao Paulo": "BRA", "Las Vegas": "LVG", Qatar: "QAT", "Abu Dhabi": "ABD",
  };
  const key = Object.keys(abbrs).find(
    (k) => gpName.toLowerCase().includes(k.toLowerCase()) || k.toLowerCase().includes(gpName.toLowerCase())
  );
  return key ? abbrs[key] : gpName.slice(0, 3).toUpperCase();
}

function buildRaceDetail(
  round: number,
  type: ResultType,
  rows: RawDriverRow[],
  overrides: TransformOverrides
): RaceDetailUpdate {
  const detail: RaceDetailUpdate = { round, type };

  if (type === "race") {
    detail.raceResults = rows
      .filter((r) => r.driverId)
      .map((r, i): RaceResultEntry => {
        const pos = r.position ?? i + 1;
        const timeStr = r.timeOrStatus || "";
        const isDnf = timeStr === "DNF";
        const isDns = timeStr === "DNS";
        return {
          position: pos,
          driverNumber: r.driverNumber,
          driverId: r.driverId!,
          driver: getDriverById(r.driverId!)?.name || r.driverName,
          team: resolveTeamName(r.team, r.driverId!),
          startingGrid: overrides.startingGrids?.[r.driverId!] ?? null,
          laps: r.laps ?? 0,
          time: timeStr,
          points: r.points ?? 0,
          fastestLapTime: r.fastestLap || undefined,
          setFastestLap: r.setFastestLap || false,
          ...(isDnf || isDns ? { status: timeStr } : {}),
        };
      });
  } else if (type === "qualifying") {
    detail.qualifyingResults = rows
      .filter((r) => r.driverId)
      .map((r, i): QualifyingResultEntry => ({
        position: r.position ?? i + 1,
        driverNumber: r.driverNumber,
        driverId: r.driverId!,
        driver: getDriverById(r.driverId!)?.name || r.driverName,
        team: resolveTeamName(r.team, r.driverId!),
        q1: r.q1 || null,
        q2: r.q2 || null,
        q3: r.q3 || null,
        laps: r.laps ?? 0,
      }));
  } else if (type === "sprint") {
    detail.sprintResults = rows
      .filter((r) => r.driverId)
      .map((r, i): SprintResultEntry => {
        const timeStr = r.timeOrStatus || "";
        const isDnf = timeStr === "DNF";
        const isDns = timeStr === "DNS";
        return {
          position: r.position ?? i + 1,
          driverNumber: r.driverNumber,
          driverId: r.driverId!,
          driver: getDriverById(r.driverId!)?.name || r.driverName,
          team: resolveTeamName(r.team, r.driverId!),
          startingGrid: null,
          laps: r.laps ?? 0,
          time: timeStr,
          points: r.points ?? 0,
          ...(isDnf || isDns ? { status: timeStr } : {}),
        };
      });
  } else if (type === "sprint-qualifying") {
    detail.sprintQualifyingResults = rows
      .filter((r) => r.driverId)
      .map((r, i): QualifyingResultEntry => ({
        position: r.position ?? i + 1,
        driverNumber: r.driverNumber,
        driverId: r.driverId!,
        driver: getDriverById(r.driverId!)?.name || r.driverName,
        team: resolveTeamName(r.team, r.driverId!),
        q1: r.q1 || null,
        q2: null,
        q3: null,
        laps: r.laps ?? 0,
      }));
  }

  return detail;
}

function resolveTeamName(scrapedTeam: string, driverId: string): string {
  // Prefer the canonical team name from the driver registry
  const driver = getDriverById(driverId);
  if (driver) return driver.team;
  return scrapedTeam;
}

function computePointsMap(type: ResultType, rows: RawDriverRow[]): Record<string, number> {
  const pts: Record<string, number> = {};
  const pointsScale = type === "sprint" ? SPRINT_POINTS : type === "race" ? RACE_POINTS : [];

  for (const row of rows) {
    if (!row.driverId) continue;
    // Only scoring positions get points
    const pos = row.position;
    if (pos !== null && pos >= 1 && pos <= pointsScale.length) {
      pts[row.driverId] = pointsScale[pos - 1];
    } else {
      pts[row.driverId] = 0;
    }
    // Fastest lap bonus (only in full race, only if in top 10)
    if (type === "race" && row.setFastestLap) {
      const currentPts = pts[row.driverId] ?? 0;
      if ((row.position ?? 99) <= 10) {
        pts[row.driverId] = currentPts + FASTEST_LAP_BONUS;
      }
    }
  }
  return pts;
}

function buildDriverUpdates(
  round: number,
  type: ResultType,
  rows: RawDriverRow[],
  computedPoints: Record<string, number>,
  currentJson: F1SeasonData
): DriverUpdate[] {
  const updates: DriverUpdate[] = [];

  // Only race and sprint affect standings
  const affectsPoints = type === "race" || type === "sprint";

  for (const row of rows) {
    if (!row.driverId) continue;

    const driverId = row.driverId;
    const pointsEarned = affectsPoints ? (computedPoints[driverId] ?? 0) : 0;

    // Find current driver in JSON
    const currentDriver = currentJson.drivers?.find((d) => d.id === driverId);
    const previousCumulative = currentDriver?.results?.length
      ? currentDriver.results[currentDriver.results.length - 1].cumulativePoints ?? 0
      : 0;
    const newCumulative = previousCumulative + pointsEarned;

    const newEntry: DriverResultEntry = {
      round,
      position: row.position ?? 99,
      points: pointsEarned,
      cumulativePoints: newCumulative,
      ...(type === "race" ? {
        grid: row.startingGrid ?? null,
        ...(row.fastestLap ? { fastestLapTime: row.fastestLap } : {}),
        ...(row.setFastestLap ? { setFastestLap: true } : {}),
        ...((row.timeOrStatus === "DNF" || row.timeOrStatus === "DNS") ? { status: row.timeOrStatus } : {}),
      } : {}),
      ...((type === "sprint" && (row.timeOrStatus === "DNF" || row.timeOrStatus === "DNS"))
        ? { status: row.timeOrStatus }
        : {}),
    };

    updates.push({
      driverId,
      driverName: getDriverById(driverId)?.name || row.driverName,
      pointsEarned,
      newCumulativePoints: newCumulative,
      previousCumulativePoints: previousCumulative,
      newEntry,
      found: !!currentDriver,
    });
  }

  return updates;
}

function buildConstructorUpdates(
  driverUpdates: DriverUpdate[],
  currentJson: F1SeasonData
): ConstructorUpdate[] {
  // Group driver points by team
  const teamPoints: Record<string, number> = {};
  for (const update of driverUpdates) {
    const driver = getDriverById(update.driverId);
    if (!driver) continue;
    teamPoints[driver.teamId] = (teamPoints[driver.teamId] ?? 0) + update.pointsEarned;
  }

  return (currentJson.constructors || []).map((constructor) => {
    const added = teamPoints[constructor.id] ?? 0;
    return {
      teamId: constructor.id,
      teamName: constructor.name,
      previousPoints: constructor.points,
      pointsAdded: added,
      newPoints: constructor.points + added,
    };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Apply transform result to produce the updated full JSON
// ─────────────────────────────────────────────────────────────────────────────

export function applyToJson(current: F1SeasonData, result: TransformResult): F1SeasonData {
  const updated: F1SeasonData = JSON.parse(JSON.stringify(current)); // deep clone

  // 1. Add to races[] — cast to the typed race entry shape
  updated.races.push(result.raceEntry as unknown as { round: number } & Record<string, unknown>);
  updated.races.sort((a, b) => a.round - b.round);

  // 2. Add/update raceDetails[]
  const existingDetailIdx = updated.raceDetails.findIndex((d) => (d.round as number) === result.raceDetailUpdate.round);
  const detailPayload = buildDetailPayload(result.raceDetailUpdate);
  if (existingDetailIdx >= 0) {
    updated.raceDetails[existingDetailIdx] = {
      ...updated.raceDetails[existingDetailIdx],
      ...detailPayload,
    };
  } else {
    updated.raceDetails.push(detailPayload as { round: number } & Record<string, unknown>);
    updated.raceDetails.sort((a, b) => a.round - b.round);
  }

  // 3. Update driver results
  for (const update of result.driverUpdates) {
    const driverIdx = updated.drivers.findIndex((d) => d.id === update.driverId);
    if (driverIdx >= 0) {
      // Remove any existing entry for this round, then add new
      updated.drivers[driverIdx].results = updated.drivers[driverIdx].results.filter(
        (r) => r.round !== result.raceDetailUpdate.round
      );
      updated.drivers[driverIdx].results.push(update.newEntry);
      updated.drivers[driverIdx].results.sort((a, b) => a.round - b.round);
    }
  }

  // 4. Update constructor points
  for (const cu of result.constructorUpdates) {
    const cIdx = updated.constructors.findIndex((c) => c.id === cu.teamId);
    if (cIdx >= 0) {
      updated.constructors[cIdx].points = cu.newPoints;
    }
  }

  return updated;
}

function buildDetailPayload(detail: RaceDetailUpdate): Record<string, unknown> {
  const payload: Record<string, unknown> = { round: detail.round };
  if (detail.raceResults) payload["raceResults"] = detail.raceResults;
  if (detail.qualifyingResults) payload["qualifyingResults"] = detail.qualifyingResults;
  if (detail.sprintResults) payload["sprintResults"] = detail.sprintResults;
  if (detail.sprintQualifyingResults) payload["sprintQualifyingResults"] = detail.sprintQualifyingResults;
  return payload;
}

// ─────────────────────────────────────────────────────────────────────────────
// Types for the full 2026.json structure (minimal for what we need)
// ─────────────────────────────────────────────────────────────────────────────

export interface F1SeasonData {
  year: number;
  races: Array<{ round: number } & Record<string, unknown>>;
  raceDetails: Array<{ round: number } & Record<string, unknown>>;
  drivers: Array<{
    id: string;
    name: string;
    number: number;
    team: string;
    teamId: string;
    teamColor: string;
    results: Array<DriverResultEntry>;
    photo: string;
  }>;
  constructors: Array<{
    id: string;
    name: string;
    color: string;
    points: number;
  }>;
  teams: Array<Record<string, unknown>>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Overrides that the admin UI can provide
// ─────────────────────────────────────────────────────────────────────────────

export interface TransformOverrides {
  roundNumber?: number;
  gpName?: string;
  date?: string;
  circuit?: string;
  location?: string;
  startingGrids?: Record<string, number>; // driverId → grid position
  fastestLapDriverId?: string; // override fastest lap winner
}
